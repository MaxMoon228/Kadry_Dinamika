import { useApp } from "../app/AppContext";
import { StackedBar, MobLegend } from "../components/mobility";
import { Async, PageSkeleton } from "../components/states";
import { ChartCard, KpiCard, PageHead, fmt } from "../components/ui";
import { useData } from "../data/DataProvider";
import { studentsPerTeacher } from "../data/selectors/composition";
import { useAsync } from "../hooks/useAsync";
import SchoolTable from "./SchoolTable";
import { periodCaption } from "./shared";

export default function Schools() {
  const data = useData();
  const { filters, navigate, dictionaries } = useApp();
  const list = useAsync(() => data.schools.list(filters), [data, filters.year, filters.district]);
  const period = dictionaries.periods.find((p) => p.toYear === filters.year) ?? null;
  return (
    <div className="space-y-6">
      <PageHead
        title="Школы"
        subtitle="Сравнение школ по кадровой структуре и трудовой мобильности"
      />
      <Async state={list} skeleton={<PageSkeleton />} isEmpty={(r) => r.length === 0}>
        {(rows) => {
          const totalT = rows.reduce((a, s) => a + s.teacherCount, 0);
          const totalS = rows.reduce((a, s) => a + (s.studentCount ?? 0), 0);
          const withMob = rows
            .filter((r) => r.mobility && !r.mobility.suppressed)
            .sort((a, b) => b.mobility!.shares.leave - a.mobility!.shares.leave);
          return (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Школ" value={fmt(rows.length)} />
                <KpiCard label="Педагогов" value={fmt(totalT)} />
                <KpiCard label="Учащихся" value={fmt(totalS)} />
                <KpiCard
                  label="Учащихся на педагога"
                  value={fmt(studentsPerTeacher(totalS, totalT))}
                />
              </div>
              <ChartCard
                title="Сравнение школ"
                subtitle={`Сортировка по клику на заголовок · ${filters.year} год · мобильность: ${periodCaption(period)}`}
              >
                <SchoolTable
                  rows={rows}
                  onOpen={(id) => navigate({ page: "school", id })}
                  extended
                />
              </ChartCard>
              <ChartCard
                title="Мобильность по школам"
                subtitle={`Доля исходов, % · ${periodCaption(period)} · клик открывает карточку школы`}
              >
                {withMob.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    Для выбранного года исход мобильности не наблюдается.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {withMob.slice(0, 12).map((s) => (
                      <div key={s.schoolId} className="flex items-center gap-3">
                        <button
                          onClick={() => navigate({ page: "school", id: s.schoolId })}
                          className="w-40 shrink-0 truncate text-left text-[12.5px] font-medium text-fg hover:text-accent"
                        >
                          {s.name}
                        </button>
                        <div className="flex-1">
                          <StackedBar m={s.mobility!.shares} height={16} />
                        </div>
                        <span className="tnum w-14 shrink-0 text-right text-[12px] font-medium text-leave-fg">
                          {fmt(s.mobility!.shares.leave)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <MobLegend />
                </div>
              </ChartCard>
            </>
          );
        }}
      </Async>
    </div>
  );
}
