import type { ForecastInput, ForecastResult } from "../../domain/forecast";
import { MOBILITY_CLASS_BY_KEY, MOBILITY_KEYS, type MobilityKey } from "../../domain/mobility";
import { AccessDeniedError, NotFoundError, ValidationError } from "../../data/contracts/errors";
import type { ForecastService } from "../../data/contracts/repositories";
import type { MockContext } from "../../data/mock/context";
import { studentsPerTeacher } from "../../data/selectors/composition";
import { toHeuristicFeatures } from "./featureMapping";
import { mockInferenceLog, type InMemoryInferenceLog } from "./inferenceLog";
import {
  FEATURE_SCHEMA_VERSION,
  MOCK_BASE_PROBABILITIES,
  MOCK_MODEL_VERSION,
  mockPredict,
} from "./mockModel";

import { validateForecastInput } from "./validation";

let seq = 0;

/** MOCK реализация ForecastService: валидация → разрешение школьных признаков → эвристика. */

export class MockForecastService implements ForecastService {
  constructor(
    private readonly ctx: MockContext,
    private readonly log: InMemoryInferenceLog = mockInferenceLog,
  ) {}
  resolveSchool(input: ForecastInput): ForecastResult["resolvedSchool"] {
    const s = input.school;
    if (s.mode === "manual") {
      return {
        district: s.district,
        buildingCount: s.buildingCount,
        studentCount: s.studentCount,
        teacherCount: s.teacherCount,
        studentsPerTeacher: studentsPerTeacher(s.studentCount, s.teacherCount),
      };
    }
    if (!this.ctx.canViewSchool(s.schoolId))
      throw new AccessDeniedError("Недостаточно прав для прогноза по этой школе");
    const school = this.ctx.index.schoolById.get(s.schoolId);
    if (!school) throw new NotFoundError("Школа не найдена");
    const years = this.ctx.index.ds.years.filter((y) => y <= input.referenceYear);
    const snap = years.length
      ? this.ctx.index.schoolYear(s.schoolId, years[years.length - 1])
      : undefined;
    return {
      district: school.district,
      buildingCount: snap?.buildingCount ?? null,
      studentCount: snap?.studentCount ?? null,
      teacherCount: snap?.teacherCount ?? null,
      studentsPerTeacher: snap ? studentsPerTeacher(snap.studentCount, snap.teacherCount) : null,
    };
  }
  /** Синхронный расчёт без задержки и журналирования (для агрегатов ModelService). */
  compute(input: ForecastInput): ForecastResult {
    const errors = validateForecastInput(input);
    if (errors.length) throw new ValidationError(errors);
    const resolvedSchool = this.resolveSchool(input);
    const { probabilities, contributions } = mockPredict(
      toHeuristicFeatures(input, resolvedSchool.studentsPerTeacher),
    );
    const top: MobilityKey = MOBILITY_KEYS.reduce(
      (a, k) => (probabilities[k] > probabilities[a] ? k : a),
      MOBILITY_KEYS[0],
    );
    return {
      requestId: `mock-${Date.now().toString(36)}-${(seq++).toString(36)}`,
      generatedAt: new Date().toISOString(),
      probabilities,
      predictedClass: MOBILITY_CLASS_BY_KEY[top],
      modelVersion: MOCK_MODEL_VERSION,
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      calibrated: false,
      isMock: true,
      explanation: {
        method: "mock-heuristic",
        baseProbabilities: MOCK_BASE_PROBABILITIES,
        contributions,
        note: "Вклады рассчитаны по заданной вручную эвристике и показывают формат будущего SHAP-объяснения. Они не отражают закономерности в данных.",
      },
      resolvedSchool,
      warnings: [
        "Модель не обучена: используется демонстрационная эвристика. Вероятности не откалиброваны и не являются прогнозом.",
      ],
    };
  }
  async predict(input: ForecastInput): Promise<ForecastResult> {
    const started = performance.now();
    const result = await this.ctx.respond(() => {
      this.ctx.require("forecast:use");
      return this.compute(input);
    });
    const latencyMs = Math.round(performance.now() - started);
    const predictedKey = MOBILITY_KEYS[result.predictedClass];
    this.log.append({
      requestId: result.requestId,
      timestamp: result.generatedAt,
      modelVersion: result.modelVersion,
      inputSchemaVersion: input.schemaVersion,
      probabilities: result.probabilities,
      predictedKey,
      latencyMs,
      actualOutcome: null,
    });
    return result;
  }
}
