import type { IsoDate, SchoolId, Year } from "./common";
import type { MobilityClass, MobilityKey } from "./mobility";
import type { Gender } from "./teacher";

export const FORECAST_INPUT_SCHEMA_VERSION = "1.0";

/**
 * Школьные признаки: либо берутся сервером из справочника по schoolId (предпочтительно —
 * гарантирует консистентность train/inference), либо задаются вручную для сценарного анализа.
 */

export type ForecastSchoolInput =
  | { mode: "reference"; schoolId: SchoolId }
  | {
      mode: "manual";
      district: string;
      buildingCount: number;
      studentCount: number;
      teacherCount: number;
    };

export interface ForecastEducationInput {
  educationType: string;
  specialization: string | null;
  qualification: string | null;
  graduationYear: number | null;
}

/** Агрегаты по программам ПК/ПП на дату среза (сырые записи в запрос не передаются). */

export interface ForecastTrainingInput {
  programCount: number;
  totalHours: number;
  hasRetraining: boolean;
  lastDocumentDate: IsoDate | null;
}

export interface ForecastTeacherInput {
  gender: Gender | null;
  age: number;
  mainPosition: string | null;
  activityDirection: string | null;
  academicDegree: string | null;
  qualificationCategory: string | null;
  qualificationAssignedAt: IsoDate | null;
  totalExperienceYears: number;
  pedagogicalExperienceYears: number;
  subjects: string[];
  parallels: string[];
  isClassTeacher: boolean;
  preprofessionalDirection: string | null;
}

export interface ForecastInput {
  schemaVersion: typeof FORECAST_INPUT_SCHEMA_VERSION;
  /** Год среза признаков; прогноз относится к периоду referenceYear → referenceYear + 1. */
  referenceYear: Year;
  teacher: ForecastTeacherInput;
  education: ForecastEducationInput[];
  training: ForecastTrainingInput;
  school: ForecastSchoolInput;
}

export type MobilityProbabilities = Record<MobilityKey, number>;

export interface FeatureContribution {
  /** Canonical-имя признака (см. docs/DATA_DICTIONARY.md). */
  feature: string;
  label: string;
  /** Значение признака в человекочитаемом виде. */
  displayValue: string;
  /** Вклад в вероятность каждого класса, в долях (сумма по признакам ≈ probabilities − base). */
  impact: MobilityProbabilities;
}

export interface ForecastExplanation {
  method: "shap" | "coefficients" | "mock-heuristic";
  /** Базовые (средние по обучающей выборке) вероятности классов. */
  baseProbabilities: MobilityProbabilities;
  contributions: FeatureContribution[];
  note: string;
}

export interface ForecastResult {
  requestId: string;
  generatedAt: string;
  probabilities: MobilityProbabilities;
  predictedClass: MobilityClass;
  modelVersion: string;
  featureSchemaVersion: string;
  calibrated: boolean;
  /** true — результат получен не обученной моделью, а заглушкой. */
  isMock: boolean;
  explanation: ForecastExplanation;
  /** Школьные признаки, фактически использованные сервером. */
  resolvedSchool: {
    district: string;
    buildingCount: number | null;
    studentCount: number | null;
    teacherCount: number | null;
    studentsPerTeacher: number | null;
  };
  warnings: string[];
}
