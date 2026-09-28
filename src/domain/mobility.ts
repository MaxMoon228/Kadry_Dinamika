import type { SchoolId, TeacherId, Year } from "./common";

/**
 * Целевая переменная — трёхклассовый статус трудовой мобильности
 * (Приложение 1, «Целевая переменная»):
 * 0 — остался в своей школе; 1 — перешёл в другую школу; 2 — ушёл из системы образования.
 */

export type MobilityClass = 0 | 1 | 2;

export const MOBILITY_CLASSES: readonly MobilityClass[] = [0, 1, 2];

export type MobilityKey = "stay" | "move" | "leave";

export const MOBILITY_KEYS: readonly MobilityKey[] = ["stay", "move", "leave"];

export const MOBILITY_KEY_BY_CLASS: Record<MobilityClass, MobilityKey> = {
  0: "stay",
  1: "move",
  2: "leave",
};

export const MOBILITY_CLASS_BY_KEY: Record<MobilityKey, MobilityClass> = {
  stay: 0,
  move: 1,
  leave: 2,
};

export const MOBILITY_LABELS: Record<
  MobilityKey,
  {
    short: string;
    plural: string;
    full: string;
    forecast: string;
  }
> = {
  stay: {
    short: "Остался",
    plural: "Остались",
    full: "Остался в своей школе",
    forecast: "Останется в своей школе",
  },
  move: {
    short: "Перешёл",
    plural: "Перешли",
    full: "Перешёл в другую школу",
    forecast: "Перейдёт в другую школу",
  },
  leave: {
    short: "Ушёл из системы",
    plural: "Ушли из системы",
    full: "Ушёл из системы образования",
    forecast: "Уйдёт из системы образования",
  },
};

/**
 * Период наблюдения исхода: признаки берутся на срезе fromYear,
 * исход определяется по присутствию педагога в срезе toYear (= fromYear + 1).
 */

export interface MobilityPeriod {
  fromYear: Year;
  toYear: Year;
}

export function periodLabel(p: MobilityPeriod): string {
  return `${p.fromYear} → ${p.toYear}`;
}

/** Исход одного педагога за один период (строится ETL, не хранится в источнике). */

export interface MobilityOutcome {
  teacherId: TeacherId;
  period: MobilityPeriod;
  status: MobilityClass;
  fromSchoolId: SchoolId;
  /** Школа в toYear; null при status = 2. */
  toSchoolId: SchoolId | null;
}

export type MobilityCounts = Record<MobilityKey, number>;

/** Распределение исходов: абсолютные числа и доли в процентах (сумма долей = 100). */

export interface MobilityDistribution {
  period: MobilityPeriod;
  total: number;
  counts: MobilityCounts;
  shares: MobilityCounts;
}

export interface MobilityGroupRow {
  group: string;
  total: number;
  counts: MobilityCounts;
  shares: MobilityCounts;
  /** true, если группа слишком мала для публикации долей (защита от реидентификации). */
  suppressed: boolean;
}
