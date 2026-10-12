import { useState } from "react";
import { useApp } from "../app/AppContext";
import { LoadScatter } from "../components/LoadScatter";
import { Async, Skeleton } from "../components/states";
import { ChartCard, Segmented, fmt, pct } from "../components/ui";
import type { LoadPoint } from "../data/contracts/dto";
import { useData } from "../data/DataProvider";
import { useAsync } from "../hooks/useAsync";

/**
 * «Нагрузка молодых педагогов» — интерактивный аналог графика «Критическая нагрузка»
 * из ноутбука «Неделя 5_НС_Учителя_Семинар»: стаж педагогической работы × число разных
 * предметов, выделены педагоги со стажем < 2 лет и ≥ 5 предметами.
 */

export default function LoadSection() {
  const data = useData();
  const { filters, navigate, setFilters } = useApp();
  const [range, setRange] = useState<"year" | "all">("year");
  const [scale, setScale] = useState<"young" | "full">("young");
  const scatter = useAsync(
    () => data.analytics.getLoadScatter(filters, range === "all"),
    [data, filters.year, filters.district, range],
  );
  const open = (p: LoadPoint) => {
    if (p.year !== filters.year) setFilters({ year: p.year });
    navigate({ page: "teacher", id: p.teacherId });
  };
  return (
    <ChartCard
      title="Нагрузка молодых педагогов"
      subtitle="Стаж педагогической работы × число разных предметов · наведите на точку — краткая карточка, клик — профиль педагога"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Шкала стажа"
            value={scale}
            onChange={setScale}
            options={[
              { value: "young", label: "0–10 лет" },
              { value: "full", label: "Весь стаж" },
            ]}
          />
          <Segmented
            label="Период"
            value={range}
            onChange={setRange}
            options={[
              { value: "year", label: `${filters.year} год` },
              { value: "all", label: "Все годы" },
            ]}
          />
        </div>
      }
    >
      <Async state={scatter} skeleton={<Skeleton height={420} />}>
        {(s) => {
          const t = s.thresholds;
          const share = s.total ? Math.round((s.criticalCount / s.total) * 1000) / 10 : null;
          const critical = s.points.filter((p) => p.critical);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Педагогов на графике" value={fmt(s.total)} />
                <Stat
                  label="Критическая нагрузка"
                  value={fmt(s.criticalCount)}
                  sub={share == null ? undefined : `${pct(share)} от всех`}
                  hot
                />
                <Stat
                  label="Ушли из системы · критические"
                  value={s.leaveShareCritical == null ? "—" : pct(s.leaveShareCritical)}
                  sub="по наблюдаемым исходам"
                  hot
                />
                <Stat
                  label="Ушли из системы · остальные"
                  value={s.leaveShareOther == null ? "—" : pct(s.leaveShareOther)}
                  sub="по наблюдаемым исходам"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-fg-2">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-indigo)] opacity-70" />
                  Педагоги
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rotate-45 bg-gradient-to-br from-[var(--neon-pink)] to-[var(--danger)] shadow-[0_0_8px_var(--neon-pink)]" />
                  Критическая нагрузка: стаж &lt; {t.maxExperienceExclusive} лет и ≥ {t.minSubjects}{" "}
                  предметов
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-4 rounded-[3px] border border-dashed border-[var(--danger)] bg-[var(--danger-soft)]" />
                  Зона риска
                </span>
              </div>
              {s.total === 0 ? (
                <p className="py-16 text-center text-[13px] text-muted">
                  Нет педагогов с заполненным стажем в выбранном охвате.
                </p>
              ) : (
                <LoadScatter
                  points={s.points}
                  thresholds={t}
                  xLimit={scale === "young" ? 10 : undefined}
                  onOpen={open}
                />
              )}
              {critical.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-medium text-muted">
                    Педагоги в зоне риска{critical.length > 12 ? ` (первые 12 из ${fmt(critical.length)})` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...critical]
                      .sort((a, b) => b.y - a.y || a.x - b.x)
                      .slice(0, 12)
                      .map((p) => (
                        <button
                          key={`${p.teacherId}|${p.year}`}
                          onClick={() => open(p)}
                          className="rounded-full border border-[var(--glow-border)] bg-surface px-2.5 py-1 font-mono text-[11.5px] text-fg-2 transition hover:border-[var(--danger)] hover:text-[var(--danger)] hover:shadow-[0_0_12px_-2px_var(--neon-pink)]"
                          title={`${p.schoolName} · стаж ${p.x} · предметов ${p.y}`}
                        >
                          {p.teacherId}
                          <span className="ml-1.5 text-muted">
                            {p.y} пр.{range === "all" ? ` · ${p.year}` : ""}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <p className="text-[11.5px] leading-snug text-muted">
                Методика — ноутбук «Неделя 5»: «уроки» — число разных предметов педагога в срезе
                (n_unique_subjects). Точки слегка разнесены, чтобы целые значения не сливались.
                Связь с уходом описательная, не причинная.
              </p>
            </div>
          );
        }}
      </Async>
    </ChartCard>
  );
}

function Stat({ label, value, sub, hot }: { label: string; value: string; sub?: string; hot?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        hot
          ? "border-[var(--glow-border)] bg-[linear-gradient(135deg,var(--danger-soft),transparent)]"
          : "border-line bg-surface-2"
      }`}
    >
      <div className="text-[11.5px] text-muted">{label}</div>
      <div
        className={`font-display text-[20px] font-semibold tnum ${hot ? "text-[var(--danger)]" : "text-fg"}`}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
