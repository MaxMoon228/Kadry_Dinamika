import type { MobilityProbabilities } from "../../domain/forecast";
import type { MobilityKey } from "../../domain/mobility";

/**
 * Запись журнала инференса. Входные признаки и идентификаторы педагогов НЕ сохраняются
 * (data minimization); фактический исход связывается позже по request_id на backend.
 */

export interface InferenceLogEntry {
  requestId: string;
  timestamp: string;
  modelVersion: string;
  inputSchemaVersion: string;
  probabilities: MobilityProbabilities;
  predictedKey: MobilityKey;
  latencyMs: number;
  actualOutcome: MobilityKey | null;
}

/** MOCK: журнал в памяти вкладки. В production — таблица inference_log в PostgreSQL. */

export class InMemoryInferenceLog {
  private entries: InferenceLogEntry[] = [];
  append(e: InferenceLogEntry): void {
    this.entries.push(e);
    if (this.entries.length > 500) this.entries.shift();
  }
  all(): readonly InferenceLogEntry[] {
    return this.entries;
  }
}

export const mockInferenceLog = new InMemoryInferenceLog();
