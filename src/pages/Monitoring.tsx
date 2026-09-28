import { useApp } from "../app/AppContext";
import { MOB, StatusBadge } from "../components/mobility";
import { Async, EmptyState, MockNotice, PageSkeleton } from "../components/states";
import { Button, ChartCard, KpiCard, PageHead, Th, fmt } from "../components/ui";
import { useData } from "../data/DataProvider";
import { MOBILITY_KEYS } from "../domain/mobility";
import { useAsync } from "../hooks/useAsync";

const PLANNED = [
  ["Data drift", "PSI / KS по числовым признакам, χ² по категориальным, доля новых категорий"],
  ["Prediction drift", "Распределение предсказанных классов и уверенности по неделям"],
  ["Calibration drift", "Reliability diagram и ECE по мере появления фактических исходов"],
  ["Actual vs predicted", "Confusion matrix и Recall «ушёл» по когорте после наблюдения года t+1"],
  ["Missing values", "Доля пропусков по признакам относительно обучающей выборки"],
];

export default function Monitoring() {
  const data = useData();
  const { navigate } = useApp();
  const summary = useAsync(() => data.model.getMonitoringSummary(), [data]);
  return (
    <div className="space-y-6">
      <PageHead
        title="Мониторинг модели"
        subtitle="Статистика инференса, дрейф и качество текущей модели (для аналитика)"
        right={
          <Button variant="outline" onClick={() => summary.reload()}>
            Обновить
          </Button>
        }
      />
      <Async state={summary} skeleton={<PageSkeleton />}>
        {(s) => (
          <>
            {s.isMock && (
              <MockNotice>
                Журнал инференса хранится в памяти вкладки и содержит только запросы калькулятора
                этой сессии. Входные признаки и ID педагогов не сохраняются.
              </MockNotice>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Запросов прогноза" value={fmt(s.requestCount)} />
              <KpiCard
                label="Средняя уверенность"
                value={
                  s.meanConfidence == null
                    ? "—"
                    : `${fmt(Math.round(s.meanConfidence * 1000) / 10)}%`
                }
                info="Среднее максимальной вероятности класса."
              />
              <KpiCard
                label="Latency p50 / p95"
                value={s.latencyMsP50 == null ? "—" : `${s.latencyMsP50} / ${s.latencyMsP95}`}
                unit="мс"
              />
              <KpiCard
                label="С известным исходом"
                value={fmt(s.labelledCount)}
                info="Фактический исход появляется после среза следующего года."
              />
            </div>
            {s.requestCount === 0 ? (
              <EmptyState
                title="Запросов пока нет"
                note="Выполните расчёт в калькуляторе прогноза — запись появится в журнале инференса."
                action={
                  <Button onClick={() => navigate({ page: "calculator" })}>
                    Открыть калькулятор
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Распределение предсказанных классов"
                  subtitle="По всем запросам журнала"
                >
                  <div className="space-y-3">
                    {MOBILITY_KEYS.map((k) => {
                      const v = s.predictedClassCounts[k];
                      return (
                        <div key={k}>
                          <div className="mb-1 flex justify-between text-[12.5px] text-fg-2">
                            <span className="flex items-center gap-1.5">
                              <span style={{ color: MOB[k].fg }}>{MOB[k].icon(12)}</span>
                              {MOB[k].label}
                            </span>
                            <span className="tnum font-semibold text-fg">{v}</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-[var(--border-subtle)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(v / s.requestCount) * 100}%`,
                                background: MOB[k].color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[12px] text-muted">
                    Версии модели:{" "}
                    {s.byModelVersion.map((v) => `${v.modelVersion} (${v.count})`).join(", ")}
                  </p>
                </ChartCard>
                <ChartCard title="Последние запросы" subtitle="Без персональных данных">
                  <div className="-mx-5 -mb-5 overflow-x-auto">
                    <table className="w-full text-[12.5px] text-fg">
                      <thead>
                        <tr>
                          <Th>Время</Th>
                          <Th>Модель</Th>
                          <Th>Прогноз</Th>
                          <Th align="right">Уверенность</Th>
                          <Th align="right">мс</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.recent.map((r) => (
                          <tr key={r.timestamp + r.latencyMs} className="border-b border-line-2">
                            <td className="tnum px-3 py-2 text-fg-2">
                              {new Date(r.timestamp).toLocaleTimeString("ru-RU")}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11.5px]">{r.modelVersion}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={r.predictedKey} />
                            </td>
                            <td className="tnum px-3 py-2 text-right">
                              {fmt(Math.round(r.confidence * 1000) / 10)}%
                            </td>
                            <td className="tnum px-3 py-2 text-right">{r.latencyMs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              </div>
            )}
            <ChartCard
              title="Запланированные панели мониторинга"
              subtitle="Появятся после обучения модели и подключения журнала инференса на backend (docs/ML_ARCHITECTURE.md)"
            >
              <dl className="space-y-2 text-[13px]">
                {PLANNED.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-x-3">
                    <dt className="w-44 font-medium text-fg">{k}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </ChartCard>
          </>
        )}
      </Async>
    </div>
  );
}
