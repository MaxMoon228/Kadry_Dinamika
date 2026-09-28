import type { ReactNode } from "react";
import {
  MOBILITY_KEY_BY_CLASS,
  MOBILITY_KEYS,
  MOBILITY_LABELS,
  type MobilityClass,
  type MobilityCounts,
  type MobilityKey,
} from "../domain/mobility";

/** Статусы различаются не только цветом: у каждого своя иконка и подпись. */

export const MOB: Record<
  MobilityKey,
  {
    color: string;
    soft: string;
    fg: string;
    label: string;
    icon: (size?: number) => ReactNode;
  }
> = {
  stay: {
    color: "var(--stay)",
    soft: "var(--stay-soft)",
    fg: "var(--stay-fg)",
    label: MOBILITY_LABELS.stay.plural,
    icon: (s = 12) => (
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    ),
  },
  move: {
    color: "var(--move)",
    soft: "var(--move-soft)",
    fg: "var(--move-fg)",
    label: MOBILITY_LABELS.move.plural,
    icon: (s = 12) => (
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
      </svg>
    ),
  },
  leave: {
    color: "var(--leave)",
    soft: "var(--leave-soft)",
    fg: "var(--leave-fg)",
    label: MOBILITY_LABELS.leave.plural,
    icon: (s = 12) => (
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14 4h5v16h-5M10 16l-4-4 4-4M6 12h10" />
      </svg>
    ),
  },
};

export function StatusBadge({
  status,
  label,
}: {
  status: MobilityClass | MobilityKey;
  label?: string;
}) {
  const key = typeof status === "number" ? MOBILITY_KEY_BY_CLASS[status] : status;
  const cfg = MOB[key];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap"
      style={{ background: cfg.soft, color: cfg.fg }}
    >
      {cfg.icon(12)}
      {label ?? MOBILITY_LABELS[key].short}
    </span>
  );
}

export function PendingBadge({ label = "Исход не наблюдается" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-muted">
      {label}
    </span>
  );
}

export function MobLegend({ prefix }: { prefix?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-fg-2">
      {prefix && <span className="text-muted">{prefix}</span>}
      {MOBILITY_KEYS.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-sm"
            style={{ background: MOB[k].color, color: "var(--surface)" }}
          >
            {MOB[k].icon(10)}
          </span>
          {MOB[k].label}
        </span>
      ))}
    </div>
  );
}

export function StackedBar({ m, height = 10 }: { m: MobilityCounts; height?: number }) {
  const title = MOBILITY_KEYS.map((k) => `${MOB[k].label}: ${m[k]}%`).join(" · ");
  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-surface-2"
      style={{ height }}
      role="img"
      aria-label={title}
      title={title}
    >
      {MOBILITY_KEYS.map((k, i) => (
        <div
          key={k}
          style={{
            width: `${m[k]}%`,
            background: MOB[k].color,
            marginLeft: i > 0 && m[k] > 0 ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}

export function ProbabilityBar({
  k,
  value,
  highlight,
}: {
  k: MobilityKey;
  value: number;
  highlight?: boolean;
}) {
  const cfg = MOB[k];
  const p = Math.round(value * 1000) / 10;
  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${highlight ? "bg-surface-2" : ""}`}
      style={highlight ? { boxShadow: `inset 0 0 0 1.5px ${cfg.color}` } : undefined}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
        <span
          className={`flex items-center gap-1.5 font-medium ${highlight ? "text-fg" : "text-fg-2"}`}
        >
          <span style={{ color: cfg.fg }}>{cfg.icon(13)}</span>
          {MOBILITY_LABELS[k].forecast}
          {highlight && (
            <span
              className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: cfg.soft, color: cfg.fg }}
            >
              наиболее вероятно
            </span>
          )}
        </span>
        <span className="tnum text-[15px] font-semibold" style={{ color: cfg.fg }}>
          {p.toLocaleString("ru-RU")}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${p}%`, background: cfg.color }}
        />
      </div>
    </div>
  );
}
