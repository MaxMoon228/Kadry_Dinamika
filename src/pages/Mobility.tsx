import { useState } from "react";
import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import { ConcentricRadial, MobStacked, Waffle } from "../components/charts";
import { MOB, MobLegend, StackedBar } from "../components/mobility";
import { Async, PageSkeleton, Skeleton } from "../components/states";
import { ChartCard, KpiCard, PageHead, Select, Th, fmt, pct } from "../components/ui";
import type { MobilityDimension } from "../data/contracts/dto";
import { useData } from "../data/DataProvider";
import { MOBILITY_KEYS } from "../domain/mobility";
import { useAsync } from "../hooks/useAsync";
import { NoPeriodState, deltaPp, mobilitySegments, periodCaption, periodRows } from "./shared";

const DIMENSIONS: {
  value: MobilityDimension;
  label: string;
  systemOnly?: boolean;
}[] = [
  { value: "age_group", label: "Возрастная группа" },
  { value: "experience_group", label: "Педагогический стаж" },
  { value: "subject", label: "Предмет (основной)" },
  { value: "qualification_category", label: "Квалификационная категория" },
  { value: "class_teacher", label: "Классное руководство" },
  { value: "preprofessional", label: "Предпроф. классы" },
  { value: "has_training", label: "Прохождение ПК/ПП" },
  { value: "district", label: "Округ", systemOnly: true },
];

function Breakdown({
  dim,
  title,
  subtitle,
}: {
  dim: MobilityDimension;
  title: string;
  subtitle: string;
}) {
  const data = useData();
  const { filters } = useApp();
  const st = useAsync(
    () => data.analytics.getMobilityBreakdown(filters, dim),
    [data, filters.year, filters.district, dim],
  );
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <Async state={st} skeleton={<Skeleton height={240} />} isEmpty={(r) => r.length === 0}>
        {(rows) => <MobStacked rows={rows} />}
      </Async>
      <div className="mt-3">
        <MobLegend />
      </div>
    </ChartCard>
  );
}

export default function Mobility() {
  const data = useData();
  const { filters } = useApp();
  const { scope } = useSession();
  const [dim, setDim] = useState<MobilityDimension>("age_group");
  const overview = useAsync(
    () => data.analytics.getMobilityOverview(filters),
    [data, filters.year, filters.district],
  );
  const dims = DIMENSIONS.filter((d) => !d.systemOnly || scope.kind === "system");
  return (
    <div className="space-y-6">
      <PageHead
        title="Трудовая мобильность педагогов"
        subtitle="Какие группы педагогов чаще остаются, переходят между школами или уходят из системы образования"
      />
      <Async state={overview} skeleton={<PageSkeleton />}>
        {(o) => {
          if (!o.distribution) return <NoPeriodState year={filters.year} />;
          const mob = o.distribution;
          const prev = o.trend.find((t) => t.period.toYear === mob.period.fromYear) ?? null;
          return (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {MOBILITY_KEYS.map((k) => (
                  <KpiCard
                    key={k}
                    label={`Доля: ${MOB[k].label.toLowerCase()}`}
                    value={pct(mob.shares[k])}
                    icon={<span style={{ color: MOB[k].fg }}>{MOB[k].icon(13)}</span>}
                    delta={deltaPp(mob, prev, k)}
                    deltaLabel="к пред. периоду"
                    deltaGood={
                      prev
                        ? k === "stay"
                          ? mob.shares[k] >= prev.shares[k]
                          : mob.shares[k] <= prev.shares[k]
                        : null
                    }
                    spark={o.trend.map((t) => t.shares[k])}
                    sparkColor={MOB[k].color}
                    info={`${fmt(mob.counts[k])} из ${fmt(mob.total)} педагогов. ${periodCaption(mob.period)}.`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Соотношение исходов" subtitle={periodCaption(mob.period)}>
                  <ConcentricRadial items={mobilitySegments(mob)} />
                </ChartCard>
                <ChartCard title="Исходы по периодам" subtitle="Доли, % · все наблюдаемые периоды">
                  <MobStacked rows={periodRows(o.trend)} height={220} />
                  <div className="mt-3">
                    <MobLegend />
                  </div>
                </ChartCard>
              </div>
              <ChartCard
                title="Структура мобильности"
                subtitle={`100% stacked · ${periodCaption(mob.period)}`}
                right={
                  <Select
                    ariaLabel="Группировка"
                    value={dim}
                    onChange={setDim}
                    options={dims.map((d) => ({
                      value: d.value,
                      label: d.label,
                    }))}
                  />
                }
              >
                <BreakdownInline dim={dim} />
              </ChartCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Breakdown
                  dim="age_group"
                  title="Мобильность по возрасту"
                  subtitle="Доля исходов по возрастным группам, %"
                />
                <Breakdown
                  dim="experience_group"
                  title="Мобильность по педагогическому стажу"
                  subtitle="Доля исходов по группам стажа, %"
                />
                <Breakdown
                  dim="subject"
                  title="Мобильность по предметам"
                  subtitle="По основному (первому) предмету педагога, %"
                />
                <Breakdown
                  dim="qualification_category"
                  title="Мобильность по квалификационным категориям"
                  subtitle="Доля исходов, %"
                />
              </div>
              {scope.kind === "system" && (
                <Breakdown
                  dim="district"
                  title="Мобильность по округам"
                  subtitle="Доля исходов, %"
                />
              )}
              <ChartCard
                title="Группы с повышенной долей ухода из системы"
                subtitle="Наблюдаемая связь, без утверждения о причинности · группы меньше порога скрыты"
              >
                <div className="-mx-5 -mb-5 overflow-x-auto">
                  <table className="w-full text-[13px] text-fg">
                    <thead>
                      <tr>
                        <Th>Группа</Th>
                        <Th align="right">Педагогов</Th>
                        <Th align="right">Остались</Th>
                        <Th align="right">Перешли</Th>
                        <Th align="right">Ушли из системы</Th>
                        <Th>Структура</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.elevatedGroups.map((g) => (
                        <tr key={g.group} className="border-b border-line-2">
                          <td className="px-3 py-2.5 font-medium">{g.group}</td>
                          <td className="tnum px-3 py-2.5 text-right">{fmt(g.total)}</td>
                          <td className="tnum px-3 py-2.5 text-right text-fg-2">
                            {pct(g.shares.stay)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right text-fg-2">
                            {pct(g.shares.move)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right font-semibold text-leave-fg">
                            {pct(g.shares.leave)}
                          </td>
                          <td className="w-40 px-3 py-2.5">
                            <StackedBar m={g.shares} height={12} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
              <ChartCard
                title="Каждые 100 педагогов"
                subtitle={`Waffle · ${periodCaption(mob.period)}`}
              >
                <Waffle segments={mobilitySegments(mob)} />
              </ChartCard>
            </>
          );
        }}
      </Async>
    </div>
  );
}

function BreakdownInline({ dim }: { dim: MobilityDimension }) {
  const data = useData();
  const { filters } = useApp();
  const st = useAsync(
    () => data.analytics.getMobilityBreakdown(filters, dim),
    [data, filters.year, filters.district, dim],
  );
  return (
    <>
      <Async state={st} skeleton={<Skeleton height={260} />} isEmpty={(r) => r.length === 0}>
        {(rows) => <MobStacked rows={rows} />}
      </Async>
      <div className="mt-3">
        <MobLegend />
      </div>
    </>
  );
}
