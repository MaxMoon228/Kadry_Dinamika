import { useState } from "react";
import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import {
  AreaTrend,
  CHART_COLORS,
  ConcentricRadial,
  LineTrend,
  MarkerBar,
  MobStacked,
  RadialGauge,
  Waffle,
} from "../components/charts";

import { MOB, MobLegend } from "../components/mobility";
import { Async, PageSkeleton, Skeleton } from "../components/states";
import {
  Button,
  ChartCard,
  KpiCard,
  PageHead,
  Segmented,
  fmt,
  pct,
  signed,
} from "../components/ui";

import { useData } from "../data/DataProvider";
import { MOBILITY_KEYS } from "../domain/mobility";
import { useAsync } from "../hooks/useAsync";
import SchoolTable from "./SchoolTable";
import { NoPeriodState, deltaPp, mobilitySegments, periodCaption, periodRows } from "./shared";

export default function Overview() {
  const data = useData();
  const { filters, navigate, dictionaries } = useApp();
  const { scope, user } = useSession();
  const system = scope.kind === "system";
  const deps = [data, filters.year, filters.district];
  const summary = useAsync(() => data.dashboard.getSummary(filters), deps);
  const districts = useAsync(
    () => (system ? data.dashboard.getDistrictBreakdown(filters) : Promise.resolve(null)),
    [...deps, system],
  );
  const schools = useAsync(
    () => (system ? data.schools.list(filters) : Promise.resolve([])),
    [...deps, system],
  );
  const [split, setSplit] = useState<"district" | "period">(system ? "district" : "period");
  const note =
    user.role === "school_director"
      ? `Все показатели рассчитаны только по вашей школе: ${dictionaries.scopeSchool?.name ?? ""}.`
      : user.role === "analyst"
        ? "Приоритет: распределения, сегментация и связь признаков с мобильностью."
        : "Приоритет: сводная картина по округам и школам системы образования.";
  return (
    <div className="space-y-6">
      <PageHead
        title={system ? "Кадровая ситуация" : "Кадровая ситуация в школе"}
        subtitle="Сводная аналитика педагогического состава и трудовой мобильности"
        note={note}
      />
      <Async state={summary} skeleton={<PageSkeleton />}>
        {(s) => {
          const cur = s.current;
          const prev = s.previous;
          const mob = s.mobility;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {system && (
                  <KpiCard
                    label="Школ"
                    value={fmt(s.schoolCount)}
                    info="Количество образовательных организаций в выборке с учётом фильтра округа."
                  />
                )}
                <KpiCard
                  label="Педагогов"
                  value={fmt(cur.teacherCount)}
                  delta={prev ? signed(cur.teacherCount - prev.teacherCount) : undefined}
                  deltaGood={prev ? cur.teacherCount >= prev.teacherCount : null}
                  spark={s.trend.map((t) => t.teacherCount)}
                  info="Число уникальных педагогов в срезе выбранного года."
                />
                <KpiCard
                  label="Средний возраст"
                  value={fmt(cur.avgAge)}
                  unit="лет"
                  spark={s.trend.map((t) => t.avgAge ?? 0)}
                  info="Среднее по педагогам (не по школам)."
                />
                <KpiCard
                  label="Средний пед. стаж"
                  value={fmt(cur.avgPedagogicalExperience)}
                  unit="лет"
                  spark={s.trend.map((t) => t.avgPedagogicalExperience ?? 0)}
                  info="Поле «Стаж педагогической работы»."
                />
                <KpiCard
                  label="Учащихся на педагога"
                  value={fmt(cur.studentsPerTeacher)}
                  spark={s.trend.map((t) => t.studentsPerTeacher ?? 0)}
                  info="Derived: общая численность контингента / число педагогов в срезе."
                />
                {MOBILITY_KEYS.map((k) => (
                  <KpiCard
                    key={k}
                    label={MOB[k].label}
                    value={mob ? pct(mob.shares[k]) : "—"}
                    icon={<span style={{ color: MOB[k].fg }}>{MOB[k].icon(13)}</span>}
                    delta={deltaPp(mob, s.previousMobility, k)}
                    deltaGood={
                      mob && s.previousMobility
                        ? k === "stay"
                          ? mob.shares[k] >= s.previousMobility.shares[k]
                          : mob.shares[k] <= s.previousMobility.shares[k]
                        : null
                    }
                    deltaLabel="к пред. периоду"
                    spark={s.mobilityTrend.map((m) => m.shares[k])}
                    sparkColor={MOB[k].color}
                    info={`${periodCaption(mob?.period)}.`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Динамика численности педагогов"
                  subtitle={`${
                    system ? "Выбранный охват" : "Ваша школа"
                  } · ${dictionaries.years[0]}–${dictionaries.years[dictionaries.years.length - 1]}, человек`}
                >
                  <LineTrend
                    data={s.trend.map((t) => ({
                      x: t.year,
                      Педагогов: t.teacherCount,
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
                  subtitle={
                    split === "district"
                      ? `100% stacked · ${periodCaption(mob?.period)}`
                      : "100% stacked · по наблюдаемым периодам"
                  }
                  right={
                    system ? (
                      <Segmented
                        label="Разрез"
                        value={split}
                        onChange={setSplit}
                        options={[
                          { value: "district", label: "По округам" },
                          { value: "period", label: "По периодам" },
                        ]}
                      />
                    ) : undefined
                  }
                >
                  {split === "period" ? (
                    <MobStacked rows={periodRows(s.mobilityTrend)} />
                  ) : !mob ? (
                    <NoPeriodState year={filters.year} />
                  ) : (
                    <Async state={districts} skeleton={<Skeleton height={260} />}>
                      {(d) => (
                        <MobStacked
                          rows={(d?.rows ?? []).map((r) => ({
                            group: r.district,
                            total: r.mobility?.total ?? 0,
                            counts: r.mobility!.counts,
                            shares: r.mobility!.shares,
                            suppressed: (r.mobility?.total ?? 0) < 5,
                          }))}
                        />
                      )}
                    </Async>
                  )}
                  <div className="mt-3">
                    <MobLegend />
                  </div>
                </ChartCard>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <ChartCard
                  className="lg:col-span-5"
                  title="Индикаторы мобильности"
                  subtitle={periodCaption(mob?.period)}
                >
                  {mob ? (
                    <ConcentricRadial items={mobilitySegments(mob)} size={196} />
                  ) : (
                    <NoPeriodState year={filters.year} />
                  )}
                </ChartCard>
                <ChartCard
                  className="lg:col-span-7"
                  title="Состав педагогов"
                  subtitle={`Ключевые доли, % · ${filters.year} год · нажмите на показатель для детализации`}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <RadialGauge
                      value={cur.under35Share}
                      sub="до 35 лет"
                      label="Молодые педагоги"
                      hint="Доля педагогов младше 35 лет среди педагогов с известным возрастом"
                      color="var(--neon-cyan)"
                      color2="var(--neon-blue)"
                      size={132}
                      onClick={() => navigate({ page: "staff" })}
                    />
                    <RadialGauge
                      value={s.withCategoryShare}
                      sub="высш./перв."
                      label="С квал. категорией"
                      hint="Доля педагогов с высшей или первой квалификационной категорией"
                      color="var(--neon-violet)"
                      color2="var(--neon-indigo)"
                      size={132}
                      onClick={() => navigate({ page: "staff" })}
                    />
                    <RadialGauge
                      value={s.classTeacherShare}
                      sub="кл. рук."
                      label="Классные руководители"
                      hint="Доля педагогов, имеющих классное руководство"
                      color="var(--neon-pink)"
                      color2="var(--neon-violet)"
                      size={132}
                      onClick={() => navigate({ page: "staff" })}
                    />
                  </div>
                </ChartCard>
              </div>
              {system ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <ChartCard
                    className="lg:col-span-7"
                    title="Численность по округам"
                    subtitle="Накопленная численность педагогов по годам, человек"
                  >
                    <Async state={districts} skeleton={<Skeleton height={240} />}>
                      {(d) =>
                        d && (
                          <AreaTrend
                            height={240}
                            data={d.teacherTrend.map((t) => ({ x: t.year, ...t.byDistrict }))}
                            keys={d.rows.map((r, i) => ({
                              key: r.district,
                              name: r.district,
                              color: CHART_COLORS[i % CHART_COLORS.length],
                            }))}
                          />
                        )
                      }
                    </Async>
                  </ChartCard>
                  <ChartCard
                    className="lg:col-span-5"
                    title="Обеспеченность педагогами по округам"
                    subtitle="Учащихся на одного педагога · маркер — среднее по охвату"
                  >
                    <Async state={districts} skeleton={<Skeleton height={240} />}>
                      {(d) =>
                        d && (
                          <div className="space-y-3.5">
                            {d.rows.map((r, i) => (
                              <MarkerBar
                                key={r.district}
                                label={r.district}
                                value={r.studentsPerTeacher}
                                max={Math.max(
                                  20,
                                  ...d.rows.map((x) => (x.studentsPerTeacher ?? 0) * 1.15),
                                )}
                                target={d.systemStudentsPerTeacher}
                                color={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </div>
                        )
                      }
                    </Async>
                  </ChartCard>
                </div>
              ) : (
                <ChartCard
                  title="Структура мобильности (waffle)"
                  subtitle={`100 клеток = 100% · ${periodCaption(mob?.period)}`}
                >
                  {mob ? (
                    <Waffle segments={mobilitySegments(mob)} />
                  ) : (
                    <NoPeriodState year={filters.year} />
                  )}
                </ChartCard>
              )}
              {system ? (
                <ChartCard
                  title="Школы, требующие дополнительного анализа"
                  subtitle="Отсортировано по доле ушедших из системы · клик по строке открывает карточку школы"
                  right={
                    <Button variant="ghost" onClick={() => navigate({ page: "schools" })}>
                      Все школы →
                    </Button>
                  }
                >
                  <Async state={schools}>
                    {(rows) => (
                      <SchoolTable
                        rows={[...rows]
                          .sort(
                            (a, b) =>
                              (b.mobility?.shares.leave ?? -1) - (a.mobility?.shares.leave ?? -1),
                          )
                          .slice(0, 8)}
                        onOpen={(id) => navigate({ page: "school", id })}
                      />
                    )}
                  </Async>
                </ChartCard>
              ) : (
                scope.kind === "school" && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => navigate({ page: "school", id: scope.schoolId })}>
                      Открыть карточку школы →
                    </Button>
                    <Button variant="outline" onClick={() => navigate({ page: "staff" })}>
                      Педагогический состав
                    </Button>
                  </div>
                )
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
