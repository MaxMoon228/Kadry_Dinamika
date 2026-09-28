import type { Year } from "./common";
import type { MobilityGroupRow, MobilityKey } from "./mobility";

export type ModelStatus = "not_trained" | "mock" | "ready" | "deprecated";

export interface ModelMetadata {
  status: ModelStatus;
  modelVersion: string | null;
  algorithm: string | null;
  trainedAt: string | null;
  datasetVersion: string | null;
  featureSchemaVersion: string;
  gitCommit: string | null;
  hyperparameters: Record<string, string | number | boolean> | null;
  calibrationMethod: string | null;
  /** Годы среза признаков и годы наблюдения исхода в обучающей выборке. */
  training: { featureYears: Year[]; targetYears: Year[] } | null;
  targetClasses: { code: 0 | 1 | 2; key: MobilityKey; label: string }[];
  note: string;
}

export interface PerClassMetric {
  precision: number;
  recall: number;
  f1: number;
  f2: number;
  support: number;
}

export interface ModelMetrics {
  modelVersion: string | null;
  evaluatedOn: string | null;
  accuracy: number | null;
  balancedAccuracy: number | null;
  macroF1: number | null;
  weightedF1: number | null;
  logLoss: number | null;
  brierScore: number | null;
  expectedCalibrationError: number | null;
  rocAucOvr: number | null;
  perClass: Record<MobilityKey, PerClassMetric> | null;
  /** Строки — фактический класс, столбцы — предсказанный. */
  confusionMatrix: number[][] | null;
}

export interface GlobalFeatureImportance {
  isMock: boolean;
  method: "mean_abs_shap" | "permutation" | "mock-heuristic";
  items: { feature: string; label: string; importance: number }[];
}

/** Агрегированный прогноз по когорте (например, срез последнего года → следующий год). */

export interface ForecastOverview {
  isMock: boolean;
  modelVersion: string;
  referenceYear: Year;
  teacherCount: number;
  expected: Record<MobilityKey, number>;
  byGroup: MobilityGroupRow[];
  groupBy: string;
}

/** Сводка по журналу инференса (без персональных данных). */

export interface InferenceMonitoringSummary {
  isMock: boolean;
  requestCount: number;
  byModelVersion: { modelVersion: string; count: number }[];
  predictedClassCounts: Record<MobilityKey, number>;
  meanConfidence: number | null;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
  labelledCount: number;
  recent: {
    timestamp: string;
    modelVersion: string;
    predictedKey: MobilityKey;
    confidence: number;
    latencyMs: number;
  }[];
}
