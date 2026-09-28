import type {
  MobilityClass,
  MobilityCounts,
  MobilityDistribution,
  MobilityGroupRow,
  MobilityOutcome,
  MobilityPeriod,
} from "../../domain/mobility";

import { MOBILITY_KEY_BY_CLASS } from "../../domain/mobility";

/** Минимальный размер группы для публикации долей (k-анонимность агрегатов). */

export const MIN_GROUP_SIZE = 5;

export function emptyCounts(): MobilityCounts {
  return { stay: 0, move: 0, leave: 0 };
}

export function countOutcomes(statuses: Iterable<MobilityClass>): MobilityCounts {
  const c = emptyCounts();
  for (const s of statuses) c[MOBILITY_KEY_BY_CLASS[s]]++;
  return c;
}

/**
 * Доли в процентах с одним знаком после запятой; сумма всегда ровно 100
 * (метод наибольшего остатка). Для пустой группы — нули.
 */

export function sharesOf(counts: MobilityCounts): MobilityCounts {
  const total = counts.stay + counts.move + counts.leave;
  if (total === 0) return emptyCounts();
  const keys = ["stay", "move", "leave"] as const;
  const raw = keys.map((k) => (counts[k] / total) * 1000);
  const floors = raw.map(Math.floor);
  let rest = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  for (const o of order) {
    if (rest <= 0) break;
    floors[o.i]++;
    rest--;
  }
  return { stay: floors[0] / 10, move: floors[1] / 10, leave: floors[2] / 10 };
}

export function distributionOf(
  outcomes: MobilityOutcome[],
  period: MobilityPeriod,
): MobilityDistribution {
  const counts = countOutcomes(outcomes.map((o) => o.status));
  return { period, total: outcomes.length, counts, shares: sharesOf(counts) };
}

export function groupRow(
  group: string,
  statuses: MobilityClass[],
  minGroupSize = MIN_GROUP_SIZE,
): MobilityGroupRow {
  const counts = countOutcomes(statuses);
  const suppressed = statuses.length < minGroupSize;
  return {
    group,
    total: statuses.length,
    counts: suppressed ? emptyCounts() : counts,
    shares: suppressed ? emptyCounts() : sharesOf(counts),
    suppressed,
  };
}

/** Распределение исходов по произвольной группировке. */

export function mobilityByGroup<T extends { status: MobilityClass }>(
  items: T[],
  keyFn: (item: T) => string,
  order?: readonly string[],
  minGroupSize = MIN_GROUP_SIZE,
): MobilityGroupRow[] {
  const map = new Map<string, MobilityClass[]>();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it.status);
  }
  const rows = [...map.entries()].map(([g, s]) => groupRow(g, s, minGroupSize));
  if (order) {
    const idx = (g: string) => (order.indexOf(g) === -1 ? order.length : order.indexOf(g));
    rows.sort((a, b) => idx(a.group) - idx(b.group));
  } else rows.sort((a, b) => b.total - a.total);
  return rows;
}

/** Период, в котором toYear = year (UI-соглашение: «мобильность за год Y» = переход Y−1 → Y). */

export function periodEndingIn(periods: MobilityPeriod[], year: number): MobilityPeriod | null {
  return periods.find((p) => p.toYear === year) ?? null;
}
