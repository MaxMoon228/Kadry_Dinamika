import { useApp } from "../app/AppContext";
import { EmptyState } from "../components/states";
import { MOB } from "../components/mobility";
import {
  MOBILITY_KEYS,
  periodLabel,
  type MobilityDistribution,
  type MobilityGroupRow,
  type MobilityPeriod,
} from "../domain/mobility";

export function NoPeriodState({ year }: { year: number }) {
  const { dictionaries, setFilters } = useApp();
  const available = dictionaries.periods.map(periodLabel).join(", ");
  const latest = dictionaries.periods[dictionaries.periods.length - 1];
  return (
    <EmptyState
      title={`Исход мобильности для ${year} года не наблюдается`}
      note={`Статус «остался / перешёл / ушёл» определяется сравнением двух соседних срезов. Для ${year} года нет предыдущего среза. Доступные периоды: ${available || "нет"}.`}
      action={
        latest ? (
          <button
            className="text-[13px] font-medium text-accent hover:underline"
            onClick={() => setFilters({ year: latest.toYear })}
          >
            Показать период {periodLabel(latest)} →
          </button>
        ) : undefined
      }
    />
  );
}

export function periodCaption(p: MobilityPeriod | null | undefined): string {
  return p
    ? `Период ${periodLabel(p)} · исход педагогов среза ${p.fromYear} г.`
    : "Период не наблюдается";
}

/** Строки для MobStacked из набора распределений (по периодам). */

export function periodRows(list: MobilityDistribution[]): MobilityGroupRow[] {
  return list.map((d) => ({
    group: periodLabel(d.period),
    total: d.total,
    counts: d.counts,
    shares: d.shares,
    suppressed: d.total < 5,
  }));
}

export function mobilitySegments(d: MobilityDistribution) {
  return MOBILITY_KEYS.map((k) => ({
    label: MOB[k].label,
    value: d.shares[k],
    color: MOB[k].color,
    count: d.counts[k],
    icon: MOB[k].icon(11),
  }));
}

export function deltaPp(
  cur: MobilityDistribution | null,
  prev: MobilityDistribution | null,
  k: "stay" | "move" | "leave",
) {
  if (!cur || !prev) return undefined;
  const d = Math.round((cur.shares[k] - prev.shares[k]) * 10) / 10;
  return `${d > 0 ? "+" : ""}${d.toLocaleString("ru-RU")} п.п.`;
}
