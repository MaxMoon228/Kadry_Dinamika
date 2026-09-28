import { useState } from "react";
import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import { Histogram, MobStacked } from "../components/charts";
import { MOB, MobLegend } from "../components/mobility";
import { Async, Skeleton } from "../components/states";
import { ChartCard, PageHead, Select } from "../components/ui";
import type { MobilityDimension, NumericMetric, ScatterPoint } from "../data/contracts/dto";
import { useData } from "../data/DataProvider";
import { MOBILITY_KEY_BY_CLASS } from "../domain/mobility";
import { useAsync } from "../hooks/useAsync";
import { NoPeriodState, periodCaption } from "./shared";

const METRICS: { value: NumericMetric; label: string }[] = [
  { value: "age", label: "Возраст" },
  { value: "total_experience", label: "Общий стаж" },
  { value: "pedagogical_experience", label: "Педагогический стаж" },
  { value: "training_count", label: "Число программ ПК/ПП" },
  { value: "training_hours", label: "Часы ПК/ПП" },
];

export default function Analytics() {
  const data = useData();
  const { filters, dictionaries } = useApp();
  const { scope } = useSession();
  const [x, setX] = useState<NumericMetric>("pedagogical_experience");
  const [y, setY] = useState<NumericMetric>("age");
  const [seg, setSeg] = useState<MobilityDimension>("qualification_category");
  const period = dictionaries.periods.find((p) => p.toYear === filters.year) ?? null;
  const deps = [data, filters.year, filters.district];
  const scatter = useAsync(() => data.analytics.getScatter(filters, x, y, 400), [...deps, x, y]);
  const comp = useAsync(() => data.analytics.getComposition(filters), deps);
  const segRows = useAsync(() => data.analytics.getMobilityBreakdown(filters, seg), [...deps, seg]);
  const heat = useAsync(() => data.analytics.getHeatmap(filters), deps);
  const segOptions: { value: MobilityDimension; label: string }[] = [
    { value: "age_group", label: "По возрасту" },
    { value: "experience_group", label: "По стажу" },
    { value: "qualification_category", label: "По квалификации" },
    { value: "subject", label: "По предметам" },
    { value: "has_training", label: "По прохождению ПК/ПП" },
    ...(scope.kind === "system" ? [{ value: "district" as const, label: "По округам" }] : []),
  ];
  return (
    <div className="space-y-6">
      <PageHead
        title="Аналитика"
        subtitle="Сравнение показателей, распределения и связь признаков с мобильностью"
      />
      <ChartCard
        title="Сравнение показателей"
        subtitle={`Точечная диаграмма (выборка до 400 точек) · цвет — исход · ${
          period ? periodCaption(period) : `срез ${filters.year} г., исход не наблюдается`
        }`}
        right={
          <div className="flex flex-wrap gap-2">
            <Select ariaLabel="Ось X" value={x} onChange={setX} options={METRICS} />
            <Select ariaLabel="Ось Y" value={y} onChange={setY} options={METRICS} />
          </div>
        }
      >
        <Async state={scatter} skeleton={<Skeleton height={260} />} isEmpty={(d) => d.length === 0}>
          {(pts) => (
            <Scatter
              data={pts}
              xLabel={METRICS.find((m) => m.value === x)!.label}
              yLabel={METRICS.find((m) => m.value === y)!.label}
            />
          )}
        </Async>
        <div className="mt-3">
          <MobLegend />
        </div>
      </ChartCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Распределение возраста"
          subtitle={`Педагогов по возрастным группам · ${filters.year}`}
        >
          <Async state={comp} skeleton={<Skeleton height={220} />}>
            {(c) => <Histogram data={c.byAgeGroup} />}
          </Async>
        </ChartCard>
        <ChartCard
          title="Сегментация"
          subtitle="Доля исходов мобильности по группам, %"
          right={<Select ariaLabel="Сегмент" value={seg} onChange={setSeg} options={segOptions} />}
        >
          {period ? (
            <Async state={segRows} skeleton={<Skeleton height={240} />}>
              {(rows) => <MobStacked rows={rows} />}
            </Async>
          ) : (
            <NoPeriodState year={filters.year} />
          )}
          <div className="mt-3">
            <MobLegend />
          </div>
        </ChartCard>
      </div>
      <ChartCard
        title="Связь признаков с уходом из системы"
        subtitle="Доля ушедших из системы по возрасту × педагогическому стажу, % · ячейки с малым числом наблюдений скрыты"
      >
        {period ? (
          <Async state={heat} skeleton={<Skeleton height={260} />}>
            {(h) => (
              <div className="overflow-x-auto">
                <table className="border-separate" style={{ borderSpacing: 4 }}>
                  <thead>
                    <tr>
                      <th className="px-2 pb-1 text-left text-[11px] font-medium text-muted">
                        Стаж \ Возраст
                      </th>
                      {h.cols.map((c) => (
                        <th key={c} className="px-2 pb-1 text-[11px] font-medium text-muted">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {h.rows.map((r, ri) => (
                      <tr key={r}>
                        <td className="pr-2 text-right text-[11px] font-medium whitespace-nowrap text-muted">
                          {r}
                        </td>
                        {h.cols.map((c, ci) => {
                          const v = h.cells[ri][ci];
                          const a = v == null ? 0 : Math.min(1, v / 40);
                          return (
                            <td key={c}>
                              <div
                                className="flex h-11 w-16 items-center justify-center rounded-md text-[12px] font-semibold"
                                style={{
                                  background:
                                    v == null
                                      ? "var(--surface-secondary)"
                                      : `rgba(var(--heat-rgb), ${0.1 + a * 0.75})`,
                                  color:
                                    v == null
                                      ? "var(--text-faint)"
                                      : a > 0.45
                                        ? "#fff"
                                        : "var(--text-primary)",
                                }}
                                title={v == null ? `Меньше ${h.minGroupSize} наблюдений` : `${v}%`}
                              >
                                {v == null ? "—" : `${v.toLocaleString("ru-RU")}%`}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[11.5px] text-muted">
                  Тепловая карта используется вместо корреляционной матрицы, так как признаки
                  сгруппированы. «—» — меньше {h.minGroupSize} наблюдений (защита от
                  реидентификации).
                </p>
              </div>
            )}
          </Async>
        ) : (
          <NoPeriodState year={filters.year} />
        )}
      </ChartCard>
    </div>
  );
}

function Scatter({
  data,
  xLabel,
  yLabel,
}: {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
}) {
  const maxX = Math.max(...data.map((d) => d.x)) || 1;
  const maxY = Math.max(...data.map((d) => d.y)) || 1;
  const W = 640;
  const H = 260;
  const pad = 34;
  const ticks = (max: number) => [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 260 }}
      role="img"
      aria-label={`${xLabel} × ${yLabel}`}
    >
      {ticks(maxY).map((t) => {
        const yy = H - pad - (t / maxY) * (H - pad - 8);
        return (
          <g key={`y${t}`}>
            <line x1={pad} y1={yy} x2={W - 4} y2={yy} stroke="var(--chart-grid)" />
            <text x={pad - 6} y={yy + 3} textAnchor="end" fontSize={10} fill="var(--chart-axis)">
              {t}
            </text>
          </g>
        );
      })}
      {ticks(maxX).map((t) => (
        <text
          key={`x${t}`}
          x={pad + (t / maxX) * (W - pad - 8)}
          y={H - pad + 13}
          textAnchor="middle"
          fontSize={10}
          fill="var(--chart-axis)"
        >
          {t}
        </text>
      ))}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={pad + (d.x / maxX) * (W - pad - 8)}
          cy={H - pad - (d.y / maxY) * (H - pad - 8)}
          r={3.5}
          fill={d.status == null ? "var(--text-faint)" : MOB[MOBILITY_KEY_BY_CLASS[d.status]].color}
          fillOpacity={0.65}
        />
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={11} fill="var(--chart-axis)">
        {xLabel}
      </text>
      <text
        x={10}
        y={H / 2}
        transform={`rotate(-90 10 ${H / 2})`}
        textAnchor="middle"
        fontSize={11}
        fill="var(--chart-axis)"
      >
        {yLabel}
      </text>
    </svg>
  );
}
