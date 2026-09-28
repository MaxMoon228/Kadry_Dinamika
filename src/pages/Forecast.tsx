import { useState } from "react";
import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import { MobStacked } from "../components/charts";
import { MOB, MobLegend } from "../components/mobility";
import { Async, MockNotice, Skeleton } from "../components/states";
import { Badge, Button, Card, ChartCard, PageHead, Segmented, fmt } from "../components/ui";
import { useData } from "../data/DataProvider";
import { MOBILITY_KEYS } from "../domain/mobility";
import { useAsync } from "../hooks/useAsync";

type GroupBy = "district" | "age_group" | "subject";

export default function Forecast() {
  const data = useData();
  const { filters, navigate } = useApp();
  const { scope, can } = useSession();
  const [groupBy, setGroupBy] = useState<GroupBy>(
    scope.kind === "system" ? "district" : "age_group",
  );
  const meta = useAsync(() => data.model.getMetadata(), [data]);
  const importance = useAsync(() => data.model.getGlobalImportance(), [data]);
  const overview = useAsync(
    () => data.model.getForecastOverview(filters, groupBy),
    [data, filters.year, filters.district, groupBy],
  );
  const groupOptions: { value: GroupBy; label: string }[] = [
    ...(scope.kind === "system" ? [{ value: "district" as const, label: "Округа" }] : []),
    { value: "age_group", label: "Возраст" },
    { value: "subject", label: "Предметы" },
  ];
  return (
    <div className="space-y-6">
      <PageHead
        title="Прогноз трудовой мобильности"
        subtitle={`Ожидаемое распределение трёх исходов для педагогов среза ${filters.year} г. на период ${filters.year} → ${filters.year + 1}`}
        right={
          <Async state={meta} skeleton={<Skeleton className="h-7 w-48" />}>
            {(m) => (
              <div className="flex items-center gap-2">
                <Badge tone={m.status === "ready" ? "accent" : "warn"}>
                  {m.status === "ready"
                    ? "Модель готова"
                    : m.status === "mock"
                      ? "Модель не обучена · mock"
                      : "Модель не обучена"}
                </Badge>
                {m.modelVersion && (
                  <span className="font-mono text-[12px] text-muted">{m.modelVersion}</span>
                )}
              </div>
            )}
          </Async>
        }
      />
      <MockNotice>
        Модель ещё не обучена на реальных данных. Ниже показаны результаты демонстрационной
        эвристики на синтетических данных: они проверяют формат API и визуализации и не являются
        прогнозом.
      </MockNotice>
      <Async state={overview} skeleton={<Skeleton height={120} />}>
        {(o) =>
          o && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {MOBILITY_KEYS.map((k) => (
                <Card key={k} className="p-4">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
                    <span style={{ color: MOB[k].fg }}>{MOB[k].icon(13)}</span>
                    Ожидаемо: {MOB[k].label.toLowerCase()}
                  </div>
                  <div className="tnum mt-2 text-[26px] font-semibold text-fg">
                    {fmt(o.expected[k])}
                    <span className="ml-1 text-[13px] font-medium text-muted">
                      из {fmt(o.teacherCount)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-muted">
                    сумма вероятностей по педагогам среза
                  </div>
                </Card>
              ))}
            </div>
          )
        }
      </Async>
      <ChartCard
        title="Прогнозное распределение исходов по группам"
        subtitle="Средняя прогнозная вероятность каждого исхода в группе, %"
        right={
          <Segmented
            label="Группировка"
            value={groupBy}
            onChange={setGroupBy}
            options={groupOptions}
          />
        }
      >
        <Async state={overview} skeleton={<Skeleton height={260} />}>
          {(o) => (o ? <MobStacked rows={o.byGroup} /> : null)}
        </Async>
        <div className="mt-3">
          <MobLegend prefix="Прогноз:" />
        </div>
      </ChartCard>
      <ChartCard
        title="Глобальная значимость признаков"
        subtitle="Средний абсолютный вклад в вероятности классов (в реальной модели — mean |SHAP|). Причинность не утверждается"
      >
        <Async state={importance} skeleton={<Skeleton height={220} />}>
          {(imp) =>
            imp && (
              <div className="space-y-2.5">
                {imp.items.map((f) => (
                  <div key={f.feature} className="flex items-center gap-3">
                    <span className="w-60 shrink-0 text-[12.5px] text-fg-2">{f.label}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-md bg-[var(--border-subtle)]">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-3)]"
                        style={{ width: `${f.importance}%` }}
                      />
                    </div>
                    <span className="tnum w-10 text-right text-[12px] font-medium text-muted">
                      {f.importance}
                    </span>
                  </div>
                ))}
                <p className="pt-2 text-[11.5px] text-muted">
                  Формулировки: признак «имеет высокий вклад в прогноз модели» / «связан с
                  прогнозируемым исходом». {imp.isMock && "Значения получены из mock-эвристики."}
                </p>
              </div>
            )
          }
        </Async>
      </ChartCard>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate({ page: "calculator" })}>
          Перейти к калькулятору прогноза →
        </Button>
        {can("data:catalog") && (
          <Button variant="ghost" onClick={() => navigate({ page: "data" })}>
            Данные и модель
          </Button>
        )}
      </div>
    </div>
  );
}
