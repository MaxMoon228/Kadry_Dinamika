import { useId, useState, type CSSProperties, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountByGroup } from "../domain/common";
import { MOBILITY_KEYS, type MobilityGroupRow } from "../domain/mobility";
import { MOB } from "./mobility";

/** Все цвета — CSS-переменные темы: графики перекрашиваются при смене light/dark. */
const AXIS = { fontSize: 11.5, fill: "var(--chart-axis)" };
const GRID = "var(--chart-grid)";
const LABEL = { fontSize: 11, fill: "var(--chart-axis)" };

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
export const SEQ_COLORS = [
  "var(--seq-1)",
  "var(--seq-2)",
  "var(--seq-3)",
  "var(--seq-4)",
  "var(--seq-5)",
];

const tipStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--glow-border)",
  background: "var(--tooltip-bg)",
  color: "var(--tooltip-text)",
  boxShadow: "0 12px 32px -12px var(--glow-strong)",
  fontSize: 12.5,
  padding: "8px 10px",
};
const tipLabel: CSSProperties = { color: "var(--tooltip-text)", fontWeight: 600, marginBottom: 2 };
const tipItem: CSSProperties = { color: "var(--tooltip-text)" };
const cursor = { fill: "var(--chart-cursor)" };

const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("ru-RU") : String(v ?? ""));
const tipFormatter =
  (unit = "", name?: string) =>
  (v: unknown, n: unknown): [string, string] => [`${num(v)}${unit}`, name ?? String(n ?? "")];

type Series = { key: string; color: string; name: string };

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** Вертикальный градиент «цвет → второй цвет» для заливок столбцов. */
function BarGradient({
  id,
  from,
  to,
  horizontal,
}: {
  id: string;
  from: string;
  to: string;
  horizontal?: boolean;
}) {
  return (
    <linearGradient id={id} x1="0" y1={horizontal ? "0" : "1"} x2={horizontal ? "1" : "0"} y2="0">
      <stop offset="0%" stopColor={from} stopOpacity={0.85} />
      <stop offset="100%" stopColor={to} stopOpacity={1} />
    </linearGradient>
  );
}

function GlowFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-10%" y="-40%" width="120%" height="180%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

// ------------------------------------------------------------------ line / area

export function LineTrend({
  data,
  keys,
  unit = "",
  height = 240,
}: {
  data: Record<string, number | string | null>[];
  keys: Series[];
  unit?: string;
  height?: number;
}) {
  const id = useSvgId("lt");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
        <defs>
          <GlowFilter id={`${id}-glow`} />
          {keys.map((k, i) => (
            <linearGradient key={k.key} id={`${id}-f${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={k.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={k.color} stopOpacity={0} />
            </linearGradient>
          ))}
          <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--neon-violet)" />
            <stop offset="100%" stopColor="var(--neon-blue)" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="x" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
        <RTooltip
          contentStyle={tipStyle}
          labelStyle={tipLabel}
          itemStyle={tipItem}
          formatter={tipFormatter(unit)}
        />
        {keys.map((k, i) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.name}
            stroke={keys.length === 1 ? `url(#${id}-s)` : k.color}
            strokeWidth={2.6}
            fill={`url(#${id}-f${i})`}
            filter={`url(#${id}-glow)`}
            dot={{ r: 3.5, fill: k.color, strokeWidth: 0 }}
            activeDot={{ r: 6, stroke: "var(--surface)", strokeWidth: 2, fill: k.color }}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Stacked area с интерактивной легендой: наведение подсвечивает серию, клик скрывает. */
export function AreaTrend({
  data,
  keys,
  height = 260,
  unit = "",
}: {
  data: Record<string, number | string>[];
  keys: Series[];
  height?: number;
  unit?: string;
}) {
  const id = useSvgId("at");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const toggle = (k: string) =>
    setHidden((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else if (n.size < keys.length - 1) n.add(k);
      return n;
    });
  const last = data[data.length - 1] ?? {};
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs>
            {keys.map((k, i) => (
              <linearGradient key={k.key} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={k.color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={k.color} stopOpacity={0.08} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="x" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
          <RTooltip
            contentStyle={tipStyle}
            labelStyle={tipLabel}
            itemStyle={tipItem}
            formatter={tipFormatter(unit)}
          />
          {keys.map((k, i) =>
            hidden.has(k.key) ? null : (
              <Area
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={k.name}
                stackId="1"
                stroke={k.color}
                strokeWidth={hover === k.key ? 3 : 1.6}
                strokeOpacity={hover && hover !== k.key ? 0.35 : 1}
                fill={`url(#${id}-${i})`}
                fillOpacity={hover && hover !== k.key ? 0.25 : 1}
                style={hover === k.key ? { filter: `drop-shadow(0 0 6px ${k.color})` } : undefined}
                onMouseEnter={() => setHover(k.key)}
                onMouseLeave={() => setHover(null)}
                isAnimationActive={false}
              />
            ),
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Серии графика">
        {keys.map((k) => {
          const off = hidden.has(k.key);
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={!off}
              onClick={() => toggle(k.key)}
              onMouseEnter={() => setHover(k.key)}
              onMouseLeave={() => setHover(null)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all ${
                off
                  ? "border-line text-faint line-through"
                  : "border-line bg-surface-2 text-fg-2 hover:border-[var(--glow-border)]"
              }`}
            >
              <span
                className="neon-dot h-2 w-2 rounded-full"
                style={{ background: k.color, color: k.color, opacity: off ? 0.3 : 1 }}
              />
              {k.name}
              {!off && <span className="tnum text-muted">{num(last[k.key])}</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Наведите на округ, чтобы выделить его; нажмите, чтобы скрыть или показать.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ bars

export function Histogram({
  data,
  color = "var(--chart-1)",
  height = 220,
  unit = "",
}: {
  data: CountByGroup[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const id = useSvgId("hg");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: -12 }}>
        <defs>
          <BarGradient id={id} from={color} to="var(--neon-blue)" />
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="group"
          tick={AXIS}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval={0}
        />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <RTooltip
          cursor={cursor}
          contentStyle={tipStyle}
          labelStyle={tipLabel}
          itemStyle={tipItem}
          formatter={tipFormatter(unit, "Педагогов")}
        />
        <Bar
          dataKey="value"
          fill={`url(#${id})`}
          radius={[6, 6, 0, 0]}
          maxBarSize={54}
          activeBar={{ style: { filter: "drop-shadow(0 0 8px var(--glow-strong))" } }}
        >
          <LabelList dataKey="value" position="top" style={LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HBars({
  data,
  color = "var(--chart-2)",
  height,
  unit = "",
  labelWidth = 150,
}: {
  data: CountByGroup[];
  color?: string;
  height?: number;
  unit?: string;
  labelWidth?: number;
}) {
  const id = useSvgId("hb");
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(160, data.length * 30 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
        <defs>
          <BarGradient id={id} from={color} to="var(--neon-cyan)" horizontal />
        </defs>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="group"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={labelWidth}
        />
        <RTooltip
          cursor={cursor}
          contentStyle={tipStyle}
          labelStyle={tipLabel}
          itemStyle={tipItem}
          formatter={tipFormatter(unit, "Педагогов")}
        />
        <Bar
          dataKey="value"
          fill={`url(#${id})`}
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
          activeBar={{ style: { filter: "drop-shadow(0 0 8px var(--glow-strong))" } }}
        >
          <LabelList dataKey="value" position="right" style={LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function flatten(rows: MobilityGroupRow[]) {
  return rows
    .filter((r) => !r.suppressed)
    .map((r) => ({ group: r.group, n: r.total, ...r.shares }));
}

function SuppressedNote({ rows }: { rows: MobilityGroupRow[] }) {
  const hidden = rows.filter((r) => r.suppressed);
  if (!hidden.length) return null;
  return (
    <p className="mt-2 text-[11.5px] text-muted">
      Скрыто групп с числом наблюдений меньше порога: {hidden.length} (
      {hidden.map((h) => h.group).join(", ")}).
    </p>
  );
}

function MobGradients({ id, horizontal }: { id: string; horizontal?: boolean }) {
  return (
    <>
      {MOBILITY_KEYS.map((k) => (
        <linearGradient
          key={k}
          id={`${id}-${k}`}
          x1="0"
          y1={horizontal ? "0" : "1"}
          x2={horizontal ? "1" : "0"}
          y2="0"
        >
          <stop offset="0%" stopColor={MOB[k].color} stopOpacity={0.78} />
          <stop offset="100%" stopColor={MOB[k].color} stopOpacity={1} />
        </linearGradient>
      ))}
    </>
  );
}

/** 100% stacked bars по трём исходам мобильности. */
export function MobStacked({
  rows,
  height = 260,
  horizontal,
}: {
  rows: MobilityGroupRow[];
  height?: number;
  horizontal?: boolean;
}) {
  const id = useSvgId("ms");
  const data = flatten(rows);
  const auto = horizontal ?? data.length > 7;
  const active = { style: { filter: "brightness(1.12) drop-shadow(0 0 6px var(--glow-strong))" } };
  return (
    <>
      <ResponsiveContainer
        width="100%"
        height={auto ? Math.max(180, data.length * 34 + 24) : height}
      >
        {auto ? (
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
          >
            <defs>
              <MobGradients id={id} horizontal />
            </defs>
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="group"
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={170}
            />
            <RTooltip
              cursor={cursor}
              contentStyle={tipStyle}
              labelStyle={tipLabel}
              itemStyle={tipItem}
              formatter={tipFormatter("%")}
            />
            {MOBILITY_KEYS.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                name={MOB[k].label}
                stackId="a"
                fill={`url(#${id}-${k})`}
                maxBarSize={22}
                radius={i === 0 ? [6, 0, 0, 6] : i === 2 ? [0, 6, 6, 0] : undefined}
                stroke="var(--surface)"
                strokeWidth={1}
                activeBar={active}
              />
            ))}
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
            <defs>
              <MobGradients id={id} />
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="group"
              tick={AXIS}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={44}
              unit="%"
              domain={[0, 100]}
            />
            <RTooltip
              cursor={cursor}
              contentStyle={tipStyle}
              labelStyle={tipLabel}
              itemStyle={tipItem}
              formatter={tipFormatter("%")}
            />
            {MOBILITY_KEYS.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                name={MOB[k].label}
                stackId="a"
                fill={`url(#${id}-${k})`}
                maxBarSize={48}
                radius={i === 2 ? [6, 6, 0, 0] : undefined}
                stroke="var(--surface)"
                strokeWidth={1}
                activeBar={active}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
      <SuppressedNote rows={rows} />
    </>
  );
}

export function StackedGeneric({
  data,
  keys,
  height = 240,
  unit = "",
}: {
  data: Record<string, number | string>[];
  keys: Series[];
  height?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="x" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <RTooltip
          cursor={cursor}
          contentStyle={tipStyle}
          labelStyle={tipLabel}
          itemStyle={tipItem}
          formatter={tipFormatter(unit)}
        />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.name}
            stackId="a"
            fill={k.color}
            maxBarSize={48}
            radius={i === keys.length - 1 ? [6, 6, 0, 0] : undefined}
            stroke="var(--surface)"
            strokeWidth={1}
            activeBar={{
              style: { filter: "brightness(1.15) drop-shadow(0 0 6px var(--glow-strong))" },
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ColoredBars({
  data,
  height,
}: {
  data: { group: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(160, data.length * 30 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="group"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={180}
        />
        <RTooltip
          cursor={cursor}
          contentStyle={tipStyle}
          labelStyle={tipLabel}
          itemStyle={tipItem}
          formatter={tipFormatter("", "Значение")}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
          <LabelList dataKey="value" position="right" style={LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------ radial

/**
 * Кольцевой индикатор доли. Интерактивный: при наведении кольцо подсвечивается,
 * при наличии onClick — кликабелен (клавиатура: Enter/Space).
 */
export function RadialGauge({
  value,
  label,
  sub,
  hint,
  color = "var(--chart-1)",
  color2 = "var(--neon-blue)",
  size = 120,
  onClick,
}: {
  value: number | null;
  label?: string;
  sub?: string;
  hint?: string;
  color?: string;
  color2?: string;
  size?: number;
  onClick?: () => void;
}) {
  const id = useSvgId("rg");
  const [hover, setHover] = useState(false);
  const stroke = Math.max(8, size / 11);
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      title={hint}
      className={`group flex w-full flex-col items-center rounded-xl px-2 py-3 text-center transition-colors ${onClick ? "cursor-pointer hover:bg-surface-2" : ""}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={hover ? stroke + 2 : stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (v / 100) * c}
            style={{
              transition: "stroke-dashoffset 0.7s ease, stroke-width 0.2s ease, filter 0.2s ease",
              filter: `drop-shadow(0 0 ${hover ? 8 : 4}px ${color})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="tnum font-display font-semibold text-fg"
            style={{ fontSize: size * 0.2 }}
          >
            {value == null ? "—" : `${Math.round(v)}%`}
          </span>
          {sub && <span className="text-[10.5px] text-muted">{sub}</span>}
        </div>
      </div>
      {label && <span className="mt-2 text-[12.5px] font-medium text-fg">{label}</span>}
      {hint && (
        <span
          className={`mt-1 max-w-[180px] text-[11px] leading-snug text-muted transition-opacity ${hover ? "opacity-100" : "opacity-70"}`}
        >
          {hint}
        </span>
      )}
      {onClick && (
        <span
          className={`mt-1 text-[11px] font-medium text-accent transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}
        >
          Подробнее →
        </span>
      )}
    </Tag>
  );
}

export interface RadialItem {
  label: string;
  value: number;
  color: string;
  count?: number;
  icon?: ReactNode;
}

/**
 * Концентрические кольца долей. Интерактивные: наведение на кольцо или строку легенды
 * выделяет исход, в центре показывается значение и число педагогов.
 */
export function ConcentricRadial({
  items,
  size = 200,
  caption,
}: {
  items: RadialItem[];
  size?: number;
  caption?: string;
}) {
  const id = useSvgId("cr");
  const [active, setActive] = useState<number | null>(null);
  const stroke = Math.max(12, size / 13);
  const gap = stroke * 0.45;
  const center = size / 2;
  const focus = active ?? 0;
  const cur = items[focus];
  const total = items.reduce((a, it) => a + (it.count ?? 0), 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        onMouseLeave={() => setActive(null)}
      >
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <defs>
            {items.map((it, i) => (
              <linearGradient key={i} id={`${id}-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={it.color} stopOpacity={0.7} />
                <stop offset="100%" stopColor={it.color} />
              </linearGradient>
            ))}
          </defs>
          {items.map((it, i) => {
            const r = center - stroke / 2 - 4 - i * (stroke + gap);
            const c = 2 * Math.PI * r;
            const dim = active != null && active !== i;
            return (
              <g key={i} onMouseEnter={() => setActive(i)} style={{ cursor: "pointer" }}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={`url(#${id}-${i})`}
                  strokeWidth={active === i ? stroke + 3 : stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c - (Math.max(it.value, 0.8) / 100) * c}
                  opacity={dim ? 0.3 : 1}
                  style={{
                    transition:
                      "stroke-dashoffset 0.7s ease, opacity 0.2s ease, stroke-width 0.2s ease",
                    filter:
                      active === i
                        ? `drop-shadow(0 0 8px ${it.color})`
                        : `drop-shadow(0 0 3px ${it.color})`,
                  }}
                />
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className="tnum font-display text-[24px] leading-none font-semibold"
            style={{ color: cur.color }}
          >
            {cur.value.toLocaleString("ru-RU")}%
          </span>
          <span className="mt-1 max-w-[90px] text-[10.5px] leading-tight text-muted">
            {cur.label}
          </span>
          {cur.count != null && (
            <span className="tnum mt-0.5 text-[10.5px] text-faint">
              {cur.count.toLocaleString("ru-RU")} чел.
            </span>
          )}
        </div>
      </div>
      <div className="w-full min-w-[160px] flex-1 space-y-1.5">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className={`w-full rounded-lg px-2.5 py-2 text-left transition-all ${active === i ? "bg-surface-2 ring-1 ring-[var(--glow-border)]" : "hover:bg-surface-2"}`}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md"
                style={{ background: it.color, color: "var(--surface)" }}
              >
                {it.icon}
              </span>
              <span className="flex-1 text-[12px] text-fg-2">{it.label}</span>
              <span className="tnum font-display text-[15px] font-semibold text-fg">
                {it.value.toLocaleString("ru-RU")}%
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${it.value}%`,
                  background: it.color,
                  boxShadow: `0 0 6px ${it.color}`,
                }}
              />
            </div>
          </button>
        ))}
        {(caption || total > 0) && (
          <p className="px-2.5 pt-1 text-[11px] text-faint">
            {caption ?? `Всего: ${total.toLocaleString("ru-RU")} педагогов`}
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ misc

export function Waffle({
  segments,
  cols = 10,
  rows = 10,
}: {
  segments: { label: string; value: number; color: string; icon?: ReactNode }[];
  cols?: number;
  rows?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const cells = cols * rows;
  const alloc: { color: string; label: string }[] = [];
  segments.forEach((s) => {
    const n = Math.round((s.value / total) * cells);
    for (let i = 0; i < n && alloc.length < cells; i++)
      alloc.push({ color: s.color, label: s.label });
  });
  while (alloc.length < cells) alloc.push({ color: segments[0].color, label: segments[0].label });
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        aria-hidden
        onMouseLeave={() => setActive(null)}
      >
        {alloc.map((c, i) => (
          <span
            key={i}
            onMouseEnter={() => setActive(c.label)}
            className="h-3.5 w-3.5 rounded-[3px] transition-all"
            style={{
              background: c.color,
              opacity: active && active !== c.label ? 0.25 : 1,
              boxShadow: active === c.label ? `0 0 6px ${c.color}` : undefined,
            }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div
            key={s.label}
            onMouseEnter={() => setActive(s.label)}
            onMouseLeave={() => setActive(null)}
            className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-[12.5px] transition-colors ${active === s.label ? "bg-surface-2" : ""}`}
          >
            <span className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
            <span className="text-fg-2">{s.label}</span>
            <span className="tnum ml-auto pl-3 font-semibold text-fg">
              {s.value.toLocaleString("ru-RU")}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarkerBar({
  label,
  value,
  max,
  target,
  color = "var(--chart-2)",
  suffix = "",
}: {
  label: string;
  value: number | null;
  max: number;
  target?: number | null;
  color?: string;
  suffix?: string;
}) {
  const pv = value == null ? 0 : Math.min(100, (value / max) * 100);
  const pt = target != null ? Math.min(100, (target / max) * 100) : null;
  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-fg-2">{label}</span>
        <span className="tnum font-semibold text-fg">
          {value == null ? "—" : value.toLocaleString("ru-RU")}
          {value != null && suffix}
        </span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-[var(--border-subtle)]">
        <div
          className="h-full rounded-full transition-[filter] group-hover:brightness-110"
          style={{
            width: `${pv}%`,
            background: `linear-gradient(90deg, ${color}, var(--neon-cyan))`,
            boxShadow: `0 0 8px -1px ${color}`,
            transition: "width 0.5s ease",
          }}
        />
        {pt != null && (
          <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pt}%` }}>
            <div className="h-3.5 w-[3px] -translate-x-1/2 rounded-full bg-fg" />
          </div>
        )}
      </div>
    </div>
  );
}

export function SparkBars({
  data,
  color = "var(--chart-2)",
  height = 60,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data) || 1;
  return (
    <div className="flex items-end gap-1" style={{ height }} aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[3px] transition-[filter] hover:brightness-125"
          style={{
            height: `${(v / max) * 100}%`,
            background: `linear-gradient(0deg, ${color}, var(--neon-blue))`,
            opacity: 0.6 + (v / max) * 0.4,
            boxShadow: `0 0 8px -2px ${color}`,
          }}
        />
      ))}
    </div>
  );
}
