import { useState } from "react";
import { useApp } from "../app/AppContext";
import { LineTrend, SEQ_COLORS, StackedGeneric } from "../components/charts";
import { Async, PageSkeleton } from "../components/states";
import { ChartCard, KpiCard, Legend, PageHead, Select, fmt, pct, signed } from "../components/ui";
import { useData } from "../data/DataProvider";
import { AGE_GROUPS, EXPERIENCE_GROUPS } from "../data/selectors/composition";
import { useAsync } from "../hooks/useAsync";

export default function Dynamics() {
  const data = useData();
  const { filters, dictionaries } = useApp();
  const [subject, setSubject] = useState(dictionaries.subjects[0] ?? "");
  const dyn = useAsync(
    () => data.analytics.getDynamics(filters, subject || null),
    [data, filters.district, filters.year, subject],
  );
  const first = dictionaries.years[0];
  const last = dictionaries.years[dictionaries.years.length - 1];
  const categories = dictionaries.qualificationCategories;
  return (
    <div className="space-y-6">
      <PageHead
        title="Кадровая динамика"
        subtitle={`Изменение структуры педагогических кадров по срезам ${first}–${last} гг.`}
      />
      <Async state={dyn} skeleton={<PageSkeleton />}>
        {(d) => {
          const k0 = d.kpis[0];
          const kN = d.kpis[d.kpis.length - 1];
          const chg = kN.teacherCount - k0.teacherCount;
          const over60 = (y: (typeof d.ageStructure)[number]) => y.shares["60+"] ?? 0;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <KpiCard
                  label={`Педагогов, ${kN.year}`}
                  value={fmt(kN.teacherCount)}
                  spark={d.kpis.map((k) => k.teacherCount)}
                />
                <KpiCard
                  label={`Изменение ${k0.year}→${kN.year}`}
                  value={signed(chg) ?? "—"}
                  delta={k0.teacherCount ? signed((chg / k0.teacherCount) * 100, "%") : undefined}
                  deltaGood={chg >= 0}
                  deltaLabel="к первому срезу"
                />
                <KpiCard
                  label="Средний возраст"
                  value={fmt(kN.avgAge)}
                  unit="лет"
                  delta={signed((kN.avgAge ?? 0) - (k0.avgAge ?? 0), " г.")}
                  deltaLabel={`к ${k0.year}`}
                />
                <KpiCard
                  label="Средний пед. стаж"
                  value={fmt(kN.avgPedagogicalExperience)}
                  unit="лет"
                  delta={signed(
                    (kN.avgPedagogicalExperience ?? 0) - (k0.avgPedagogicalExperience ?? 0),
                    " г.",
                  )}
                  deltaLabel={`к ${k0.year}`}
                />
                <KpiCard
                  label="Доля до 35 лет"
                  value={pct(kN.under35Share)}
                  delta={signed((kN.under35Share ?? 0) - (k0.under35Share ?? 0), " п.п.")}
                  deltaLabel={`к ${k0.year}`}
                />
                <KpiCard
                  label="Доля 60+"
                  value={pct(over60(d.ageStructure[d.ageStructure.length - 1]))}
                  delta={signed(
                    over60(d.ageStructure[d.ageStructure.length - 1]) - over60(d.ageStructure[0]),
                    " п.п.",
                  )}
                  deltaLabel={`к ${k0.year}`}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Изменение численности педагогов" subtitle="Человек по срезам">
                  <LineTrend
                    data={d.kpis.map((k) => ({
                      x: k.year,
                      Педагогов: k.teacherCount,
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
                  title="Изменение возрастной структуры"
                  subtitle="Доля возрастных групп по срезам, %"
                >
                  <StackedGeneric
                    data={d.ageStructure.map((a) => ({
                      x: a.year,
                      ...a.shares,
                    }))}
                    keys={AGE_GROUPS.map((g, i) => ({
                      key: g,
                      color: SEQ_COLORS[i],
                      name: g,
                    }))}
                    unit="%"
                  />
                  <Legend
                    items={AGE_GROUPS.map((g, i) => ({
                      label: g,
                      color: SEQ_COLORS[i],
                    }))}
                  />
                </ChartCard>
                <ChartCard
                  title="Изменение стажевой структуры"
                  subtitle="Число педагогов по группам пед. стажа"
                >
                  <StackedGeneric
                    data={d.experienceStructure.map((a) => ({
                      x: a.year,
                      ...a.counts,
                    }))}
                    keys={EXPERIENCE_GROUPS.map((g, i) => ({
                      key: g,
                      color: SEQ_COLORS[i],
                      name: g,
                    }))}
                  />
                  <Legend
                    items={EXPERIENCE_GROUPS.map((g, i) => ({
                      label: g,
                      color: SEQ_COLORS[i],
                    }))}
                  />
                </ChartCard>
                <ChartCard
                  title="Динамика квалификационных категорий"
                  subtitle="Число педагогов по категориям"
                >
                  <StackedGeneric
                    data={d.categoryStructure.map((a) => ({
                      x: a.year,
                      ...a.counts,
                    }))}
                    keys={categories.map((c, i) => ({
                      key: c,
                      color: SEQ_COLORS[SEQ_COLORS.length - 1 - i] ?? SEQ_COLORS[0],
                      name: c,
                    }))}
                  />
                  <Legend
                    items={categories.map((c, i) => ({
                      label: c,
                      color: SEQ_COLORS[SEQ_COLORS.length - 1 - i] ?? SEQ_COLORS[0],
                    }))}
                  />
                </ChartCard>
              </div>
              <ChartCard
                title="Изменение предметной структуры"
                subtitle="Число педагогов, ведущих выбранный предмет, по срезам"
                right={
                  <Select
                    ariaLabel="Предмет"
                    value={subject}
                    onChange={setSubject}
                    options={dictionaries.subjects}
                  />
                }
              >
                <LineTrend
                  data={d.subjectTrend.map((p) => ({
                    x: p.year,
                    [subject]: p.value,
                  }))}
                  keys={[{ key: subject, color: "var(--chart-3)", name: subject }]}
                />
              </ChartCard>
            </>
          );
        }}
      </Async>
    </div>
  );
}
