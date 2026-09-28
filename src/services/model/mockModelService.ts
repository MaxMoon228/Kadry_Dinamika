import type { ModelService } from "../../data/contracts/repositories";
import type { GlobalFilters } from "../../data/contracts/dto";
import type { MockContext } from "../../data/mock/context";
import { AGE_GROUPS, ageGroupOf, UNKNOWN } from "../../data/selectors/composition";
import { MIN_GROUP_SIZE, emptyCounts, sharesOf } from "../../data/selectors/mobility";
import {
  MOBILITY_KEYS,
  MOBILITY_LABELS,
  type MobilityGroupRow,
  type MobilityKey,
} from "../../domain/mobility";

import type {
  ForecastOverview,
  GlobalFeatureImportance,
  InferenceMonitoringSummary,
  ModelMetadata,
  ModelMetrics,
} from "../../domain/model";

import { subjectsOf } from "../../domain/teacher";
import { snapshotToForecastInput } from "../forecast/featureMapping";
import { mockInferenceLog, type InMemoryInferenceLog } from "../forecast/inferenceLog";
import type { MockForecastService } from "../forecast/mockForecastService";
import { FEATURE_SCHEMA_VERSION, MOCK_MODEL_VERSION } from "../forecast/mockModel";
import { validateForecastInput } from "../forecast/validation";

const TARGET_CLASSES: ModelMetadata["targetClasses"] = [
  { code: 0, key: "stay", label: MOBILITY_LABELS.stay.full },
  { code: 1, key: "move", label: MOBILITY_LABELS.move.full },
  { code: 2, key: "leave", label: MOBILITY_LABELS.leave.full },
];

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

/** MOCK реализация ModelService. Модель не обучена — метрики пустые, агрегаты помечены isMock. */

export class MockModelService implements ModelService {
  constructor(
    private readonly ctx: MockContext,
    private readonly forecast: MockForecastService,
    private readonly log: InMemoryInferenceLog = mockInferenceLog,
  ) {}
  getMetadata(): Promise<ModelMetadata> {
    return this.ctx.respond(() => {
      this.ctx.require("model:view_summary");
      return {
        status: "mock",
        modelVersion: MOCK_MODEL_VERSION,
        algorithm: "Демонстрационная эвристика (не ML)",
        trainedAt: null,
        datasetVersion: null,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        gitCommit: null,
        hyperparameters: null,
        calibrationMethod: null,
        training: null,
        targetClasses: TARGET_CLASSES,
        note: "Реальная модель будет обучена после подключения датасета 2022–2024 гг. (docs/ML_TRAINING_PLAN.md).",
      };
    });
  }
  getMetrics(): Promise<ModelMetrics> {
    return this.ctx.respond(() => {
      this.ctx.require("model:view_technical");
      return {
        modelVersion: null,
        evaluatedOn: null,
        accuracy: null,
        balancedAccuracy: null,
        macroF1: null,
        weightedF1: null,
        logLoss: null,
        brierScore: null,
        expectedCalibrationError: null,
        rocAucOvr: null,
        perClass: null,
        confusionMatrix: null,
      };
    });
  }
  private cohort(filters: GlobalFilters) {
    const snaps = this.ctx.snapshots(filters.year, filters);
    return snaps.flatMap((s) => {
      const input = snapshotToForecastInput(
        s,
        this.ctx.index.trainingByTeacher.get(s.teacherId) ?? [],
        this.ctx.index.educationByTeacher.get(s.teacherId) ?? [],
      );

      // Записи с пропусками обязательных признаков не прогнозируются (как и на backend).
      if (validateForecastInput(input).length) return [];
      return [{ snap: s, result: this.forecast.compute(input) }];
    });
  }
  getGlobalImportance(): Promise<GlobalFeatureImportance | null> {
    return this.ctx.respond(() => {
      this.ctx.require("model:view_summary");
      const years = this.ctx.index.ds.years;
      const rows = this.cohort({
        year: years[years.length - 1],
        district: null,
      });
      const acc = new Map<string, { label: string; sum: number }>();
      for (const r of rows)
        for (const c of r.result.explanation.contributions) {
          const e = acc.get(c.feature) ?? { label: c.label, sum: 0 };
          e.sum += Math.abs(c.impact.stay) + Math.abs(c.impact.move) + Math.abs(c.impact.leave);
          acc.set(c.feature, e);
        }
      const items = [...acc.entries()].map(([feature, e]) => ({
        feature,
        label: e.label,
        importance: e.sum / Math.max(1, rows.length),
      }));
      const max = Math.max(...items.map((i) => i.importance), 1e-9);
      return {
        isMock: true,
        method: "mock-heuristic",
        items: items
          .map((i) => ({
            ...i,
            importance: Math.round((i.importance / max) * 100),
          }))
          .sort((a, b) => b.importance - a.importance),
      };
    });
  }
  getForecastOverview(
    filters: GlobalFilters,
    groupBy: "district" | "age_group" | "subject",
  ): Promise<ForecastOverview | null> {
    return this.ctx.respond(() => {
      this.ctx.require("forecast:use");
      if (groupBy === "district") this.ctx.require("system:view");
      const rows = this.cohort(filters);
      const keyOf = (s: (typeof rows)[number]["snap"]) =>
        groupBy === "district"
          ? (this.ctx.index.schoolById.get(s.schoolId)?.district ?? UNKNOWN)
          : groupBy === "age_group"
            ? ageGroupOf(s.age)
            : (subjectsOf(s)[0] ?? UNKNOWN);
      const groups = new Map<string, Record<MobilityKey, number>[]>();
      const expected = emptyCounts();
      for (const r of rows) {
        const k = keyOf(r.snap);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(r.result.probabilities);
        for (const m of MOBILITY_KEYS) expected[m] += r.result.probabilities[m];
      }
      const byGroup: MobilityGroupRow[] = [...groups.entries()].map(([group, ps]) => {
        const sum = emptyCounts();
        for (const p of ps) for (const m of MOBILITY_KEYS) sum[m] += p[m];
        const suppressed = ps.length < MIN_GROUP_SIZE;
        const counts = {
          stay: Math.round(sum.stay),
          move: Math.round(sum.move),
          leave: Math.round(sum.leave),
        };
        return {
          group,
          total: ps.length,
          counts: suppressed ? emptyCounts() : counts,
          shares: suppressed ? emptyCounts() : sharesOf(sum),
          suppressed,
        };
      });
      if (groupBy === "age_group")
        byGroup.sort(
          (a, b) => AGE_GROUPS.indexOf(a.group as never) - AGE_GROUPS.indexOf(b.group as never),
        );
      else byGroup.sort((a, b) => b.total - a.total);
      return {
        isMock: true,
        modelVersion: MOCK_MODEL_VERSION,
        referenceYear: filters.year,
        teacherCount: rows.length,
        expected: {
          stay: Math.round(expected.stay),
          move: Math.round(expected.move),
          leave: Math.round(expected.leave),
        },
        byGroup: groupBy === "subject" ? byGroup.slice(0, 10) : byGroup,
        groupBy,
      };
    });
  }
  getMonitoringSummary(): Promise<InferenceMonitoringSummary> {
    return this.ctx.respond(() => {
      this.ctx.require("model:monitoring");
      const entries = this.log.all();
      const counts = emptyCounts();
      const versions = new Map<string, number>();
      for (const e of entries) {
        counts[e.predictedKey]++;
        versions.set(e.modelVersion, (versions.get(e.modelVersion) ?? 0) + 1);
      }
      const lat = entries.map((e) => e.latencyMs).sort((a, b) => a - b);
      const conf = entries.map((e) =>
        Math.max(e.probabilities.stay, e.probabilities.move, e.probabilities.leave),
      );
      return {
        isMock: true,
        requestCount: entries.length,
        byModelVersion: [...versions.entries()].map(([modelVersion, count]) => ({
          modelVersion,
          count,
        })),
        predictedClassCounts: counts,
        meanConfidence: conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : null,
        latencyMsP50: percentile(lat, 50),
        latencyMsP95: percentile(lat, 95),
        labelledCount: entries.filter((e) => e.actualOutcome != null).length,
        recent: entries
          .slice(-10)
          .reverse()
          .map((e) => ({
            timestamp: e.timestamp,
            modelVersion: e.modelVersion,
            predictedKey: e.predictedKey,
            confidence: Math.max(e.probabilities.stay, e.probabilities.move, e.probabilities.leave),
            latencyMs: e.latencyMs,
          })),
      };
    });
  }
}
