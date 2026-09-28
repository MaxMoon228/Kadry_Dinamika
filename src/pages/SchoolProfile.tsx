import { useState } from "react";
import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import {
  HBars,
  Histogram,
  LineTrend,
  MarkerBar,
  MobStacked,
  SparkBars,
} from "../components/charts";

import { MOB, MobLegend } from "../components/mobility";
import { Async, PageSkeleton } from "../components/states";
import { Badge, ChartCard, KpiCard, MiniStat, Tabs, fmt, pct } from "../components/ui";
import { useData } from "../data/DataProvider";
import { studentsPerTeacher } from "../data/selectors/composition";
import { useAsync } from "../hooks/useAsync";
import { periodRows } from "./shared";

type Tab = "overview" | "composition" | "subjects" | "education" | "training" | "mobility";

export default function SchoolProfile({ id }: { id: string }) {
  const data = useData();
  const { filters, navigate } = useApp();
  const { scope } = useSession();
  const profile = useAsync(
    () => data.schools.getProfile(id, filters.year),
    [data, id, filters.year],
  );
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      {scope.kind === "system" && (
        <button
          onClick={() => navigate({ page: "schools" })}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-accent"
        >
          ← Все школы
        </button>
      )}
      <Async state={profile} skeleton={<PageSkeleton />}>
        {(p) => {
          const snap = p.snapshots.find((s) => s.year === p.year);
          const spt = snap ? studentsPerTeacher(snap.studentCount, snap.teacherCount) : null;
          const lastMob = p.mobilityByPeriod.find((m) => m.period.toYear === p.year) ?? null;
          const c = p.composition;
          return (
            <>
              <div>
                <h2 className="grad-text text-[28px] font-semibold tracking-tight">
                  {p.school.name}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <Badge tone="accent">{p.school.district}</Badge>
                  <span>
                    · {fmt(snap?.buildingCount)} зд. · {fmt(snap?.studentCount)} учащихся ·{" "}
                    {fmt(c.teacherCount)} педагогов · {fmt(spt)} уч./педагог · {p.year} год
                  </span>
                </p>
              </div>
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "overview", label: "Обзор" },
                  { value: "composition", label: "Состав" },
                  { value: "subjects", label: "Предметы" },
                  { value: "education", label: "Образование" },
                  { value: "training", label: "Развитие" },
                  { value: "mobility", label: "Мобильность" },
                ]}
              />
              {tab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <KpiCard label="Педагогов" value={fmt(c.teacherCount)} />
                    <KpiCard label="Учащихся" value={fmt(snap?.studentCount)} />
                    <KpiCard label="Уч./педагог" value={fmt(spt)} />
                    <KpiCard label="Ср. возраст" value={fmt(c.avgAge)} unit="лет" />
                    <KpiCard
                      label="Ср. пед. стаж"
                      value={fmt(c.avgPedagogicalExperience)}
                      unit="лет"
                    />
                    <KpiCard
                      label="Ушли из системы"
                      value={lastMob && lastMob.total >= 5 ? pct(lastMob.shares.leave) : "—"}
                      icon={<span style={{ color: MOB.leave.fg }}>{MOB.leave.icon(13)}</span>}
                      info={
                        lastMob
                          ? `Период ${lastMob.period.fromYear} → ${lastMob.period.toYear}`
                          : "Период не наблюдается"
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ChartCard title="Динамика численности педагогов" subtitle="По срезам, человек">
                      <LineTrend
                        data={p.snapshots.map((s) => ({
                          x: s.year,
                          Педагогов: s.teacherCount,
                        }))}
                        keys={[
                          {
                            key: "Педагогов",
                            color: "var(--chart-1)",
                            name: "Педагогов",
                          },
                        ]}
                      />
                    </ChartCard>
                    <ChartCard
                      title="Структура трудовой мобильности"
                      subtitle="Доля исходов по периодам, %"
                    >
                      <MobStacked rows={periodRows(p.mobilityByPeriod)} />
                      <div className="mt-3">
                        <MobLegend />
                      </div>
                    </ChartCard>
                  </div>
                </div>
              )}
              {tab === "composition" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <ChartCard title="Возрастная структура" subtitle={`Число педагогов · ${p.year}`}>
                    <Histogram data={c.byAgeGroup} />
                  </ChartCard>
                  <ChartCard title="Педагогический стаж" subtitle={`Число педагогов · ${p.year}`}>
                    <Histogram data={c.byExperienceGroup} color="var(--chart-3)" />
                  </ChartCard>
                  <ChartCard
                    title="Квалификационные категории"
                    subtitle="Число педагогов"
                    className="lg:col-span-2"
                  >
                    <HBars data={c.byCategory} />
                  </ChartCard>
                </div>
              )}
              {tab === "subjects" && (
                <ChartCard
                  title="Педагоги по предметам"
                  subtitle="Педагог с несколькими предметами учитывается в каждом"
                >
                  <HBars data={c.bySubject} />
                </ChartCard>
              )}
              {tab === "education" && (
                <ChartCard
                  title="Структура образования"
                  subtitle="Типы образования (у педагога может быть несколько записей)"
                >
                  <HBars data={c.byEducationType} labelWidth={240} />
                </ChartCard>
              )}
              {tab === "training" && (
                <ChartCard
                  title="Повышение квалификации и переподготовка"
                  subtitle={`Документы, полученные до конца ${p.year} г.`}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MiniStat
                      label="Педагогов с ПК/ПП"
                      value={`${fmt(p.training.teachersWithTraining)} из ${fmt(p.training.teacherCount)}`}
                    />
                    <MiniStat label="Всего программ" value={fmt(p.training.programCount)} />
                    <MiniStat label="Всего часов" value={fmt(p.training.totalHours)} />
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="rounded-lg border border-line bg-surface-2 p-4">
                      <div className="mb-3 text-[12.5px] font-medium text-fg-2">
                        Полученные документы по годам
                      </div>
                      <SparkBars
                        data={p.training.documentsByYear.map((d) => d.value)}
                        height={64}
                      />
                      <div className="mt-2 flex justify-between text-[11px] text-muted">
                        {p.training.documentsByYear.map((d) => (
                          <span key={d.group}>
                            {d.group}: {d.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface-2 p-4">
                      <div className="mb-3 text-[12.5px] font-medium text-fg-2">
                        Программы по типу
                      </div>
                      <MarkerBar
                        label="ПК — повышение квалификации"
                        value={p.training.byType.ПК}
                        max={Math.max(1, p.training.programCount)}
                        color="var(--chart-2)"
                      />
                      <div className="h-3" />
                      <MarkerBar
                        label="ПП — профпереподготовка"
                        value={p.training.byType.ПП}
                        max={Math.max(1, p.training.programCount)}
                        color="var(--chart-1)"
                      />
                    </div>
                  </div>
                </ChartCard>
              )}
              {tab === "mobility" && (
                <ChartCard
                  title="Структура трудовой мобильности"
                  subtitle="Исходы педагогов школы по периодам (признаки — на начало периода)"
                >
                  <MobStacked rows={periodRows(p.mobilityByPeriod)} />
                  <div className="mt-3">
                    <MobLegend />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {p.mobilityByPeriod.map((m) => (
                      <div
                        key={m.period.fromYear}
                        className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-2"
                      >
                        <b className="text-fg">
                          {m.period.fromYear} → {m.period.toYear}
                        </b>
                        : остались {m.counts.stay}, перешли {m.counts.move}, ушли {m.counts.leave}{" "}
                        из {m.total}
                      </div>
                    ))}
                  </div>
                </ChartCard>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
