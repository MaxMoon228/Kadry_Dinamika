import { useSession } from "../auth/SessionProvider";
import { MOB } from "../components/mobility";
import { Async, MockNotice, Skeleton } from "../components/states";
import { Badge, Card, ChartCard, PageHead, fmt } from "../components/ui";
import { useData } from "../data/DataProvider";
import { MOBILITY_KEY_BY_CLASS } from "../domain/mobility";
import { useAsync } from "../hooks/useAsync";

const NOT_AVAILABLE = [
  "Заработная плата",
  "Учебная нагрузка в часах и число ставок",
  "Удовлетворённость, вовлечённость, выгорание",
  "Причины увольнения",
  "KPI / оценки результативности",
  "Дата найма и стаж в текущей школе",
  "Карьерная история вне 2022–2024 гг.",
];

const FEATURE_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Raw — педагог",
    items: [
      "Возраст",
      "Пол*",
      "Должность",
      "Направление деятельности",
      "Предметы / параллели",
      "Учёная степень",
      "Категория и даты",
      "Общий и пед. стаж",
      "Классное руководство",
      "Предпроф. класс",
    ],
  },
  {
    title: "Raw — школа",
    items: ["Округ", "Количество зданий", "Численность контингента"],
  },
  {
    title: "Derived",
    items: [
      "Учащихся на педагога",
      "Число предметов / параллелей",
      "Число программ ПК/ПП",
      "Часы ПК/ПП (всего, за 3 года)",
      "Наличие ПП",
      "Лет с последнего обучения",
      "Лет с присвоения категории",
      "Лет с окончания обучения",
    ],
  },
];

export default function DataModel() {
  const data = useData();
  const { can } = useSession();
  const technical = can("model:view_technical");
  const catalog = useAsync(() => data.catalog.get(), [data]);
  const meta = useAsync(() => data.model.getMetadata(), [data]);
  const metrics = useAsync(
    () => (technical ? data.model.getMetrics() : Promise.resolve(null)),
    [data, technical],
  );
  return (
    <div className="space-y-6">
      <PageHead
        title="Данные и модель"
        subtitle="Прозрачность СППР: источники данных, качество, целевая переменная и статус прогнозной модели"
      />
      <Async state={catalog} skeleton={<Skeleton height={160} />}>
        {(c) => (
          <>
            {c.isMock ? (
              <MockNotice>
                Сейчас подключён синтетический набор ({c.datasetVersion}). Структура таблиц
                соответствует описанию данных ДОНМ 2022–2024 гг., значения вымышлены. Реальный
                датасет подключается через VITE_DATA_SOURCE=local (docs/DATA_INTEGRATION_PLAN.md).
              </MockNotice>
            ) : (
              <Card className="card-glow p-4 text-[13px] leading-relaxed text-fg-2">
                <span className="font-semibold text-fg">Подключены реальные данные ДОНМ.</span>{" "}
                Источник: {c.origin}.
                {c.finalTable &&
                  ` Итоговая таблица — ${fmt(c.finalTable.rows)} строк «педагог × год» × ${c.finalTable.columns} признаков, известный исход у ${fmt(c.finalTable.knownTargetRows)} строк (2022 и 2023 гг.).`}{" "}
                Идентификаторы педагогов обезличены.
              </Card>
            )}
            <div>
              <h3 className="mb-3 text-[15px] font-semibold text-fg">Источники данных</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {c.sources.map((s) => (
                  <Card key={s.key} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-fg">{s.title}</span>
                      <Badge
                        tone={
                          s.status === "validated" || s.status === "real"
                            ? "accent"
                            : s.status === "mock"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {s.status === "mock"
                          ? "mock"
                          : s.status === "real"
                            ? "Реальные данные"
                            : s.status === "validated"
                              ? "Проверено"
                              : "Требует проверки"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[12px] leading-snug text-muted">{s.description}</p>
                    <dl className="mt-3 space-y-1.5 text-[12.5px]">
                      <Row k="Период" v={`${c.period.from}–${c.period.to}`} />
                      <Row k="Полей в источнике" v={String(s.sourceFieldCount)} />
                      <Row k="Строк raw" v={fmt(s.rawRowCount)} />
                      <Row k="Записей после ETL" v={fmt(s.normalizedRecordCount)} />
                    </dl>
                  </Card>
                ))}
              </div>
            </div>
            <ChartCard
              title="Качество данных (отчёт ETL)"
              subtitle={`Версия датасета ${c.datasetVersion} · обновлено ${c.updatedAt}`}
            >
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] md:grid-cols-2">
                <Row k="Удалено точных дублей строк" v={fmt(c.quality.exactDuplicatesRemoved)} />
                <Row
                  k="Схлопнуто накопительных записей образования"
                  v={fmt(c.quality.cumulativeEducationCollapsed)}
                />
                <Row
                  k="Педагог-лет с противоречивыми полями"
                  v={fmt(c.quality.conflictingTeacherYears)}
                />
                <Row
                  k="Педагог-лет в нескольких школах"
                  v={fmt(c.quality.multiSchoolTeacherYears)}
                />
                <Row k="Строк со школой вне справочника" v={fmt(c.quality.unknownSchoolRows)} />
                {c.quality.typosFixed != null && (
                  <Row k="Исправлено слов с опечатками" v={fmt(c.quality.typosFixed)} />
                )}
                {c.quality.missingValues.map((m) => (
                  <Row key={m.field} k={`Пропуски: ${m.field}`} v={fmt(m.count)} />
                ))}
              </div>
            </ChartCard>
          </>
        )}
      </Async>
      <ChartCard
        title="Целевая переменная"
        subtitle="Трудовая мобильность — многоклассовая классификация (3 класса). Строится ETL сравнением соседних срезов"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([0, 1, 2] as const).map((code) => {
            const k = MOBILITY_KEY_BY_CLASS[code];
            return (
              <div
                key={code}
                className="flex items-center gap-3 rounded-lg border border-line px-4 py-3"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg font-mono text-[15px] font-semibold"
                  style={{ background: MOB[k].soft, color: MOB[k].fg }}
                >
                  {code}
                </div>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
                  <span style={{ color: MOB[k].fg }}>{MOB[k].icon(13)}</span>
                  {
                    [
                      "Остался в своей школе",
                      "Перешёл в другую школу",
                      "Ушёл из системы образования",
                    ][code]
                  }
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] leading-snug text-muted">
          Признаки берутся на срезе года t, исход — по присутствию педагога в срезе t+1. «Ушёл из
          системы» означает отсутствие в выгрузке следующего года (включая выход на пенсию, декрет
          или переход вне охвата данных) — это ограничение интерпретации.
        </p>
      </ChartCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Признаки модели (кандидаты)"
          subtitle="Только поля источников и однозначно выводимые из них. * — чувствительные признаки, требуют fairness-аудита"
        >
          <div className="space-y-4">
            {FEATURE_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="mb-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">
                  {g.title}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((i) => (
                    <Badge key={i}>{i}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard
          title="Отсутствует в данных"
          subtitle="Эти показатели не используются в интерфейсе и модели"
        >
          <ul className="space-y-1.5 text-[13px] text-fg-2">
            {NOT_AVAILABLE.map((n) => (
              <li key={n} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                {n}
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
      <ChartCard title="Прогнозная модель" subtitle="Статус и параметры многоклассовой модели">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Async state={meta} skeleton={<Skeleton height={180} />}>
            {(m) => (
              <dl className="space-y-2.5 text-[13px]">
                <Row
                  k="Статус"
                  v={
                    <Badge tone={m.status === "ready" ? "accent" : "warn"}>
                      {m.status === "mock"
                        ? "Не обучена (mock)"
                        : m.status === "ready"
                          ? "Готова"
                          : "Не обучена"}
                    </Badge>
                  }
                />
                <Row k="Версия" v={m.modelVersion ?? "—"} />
                <Row k="Алгоритм" v={m.algorithm ?? "будет выбран по результатам сравнения"} />
                <Row k="Дата обучения" v={m.trainedAt ?? "—"} />
                <Row k="Версия датасета" v={m.datasetVersion ?? "—"} />
                <Row k="Схема признаков" v={m.featureSchemaVersion} />
                <Row k="Калибровка" v={m.calibrationMethod ?? "—"} />
                <Row
                  k="Обучающий период"
                  v={
                    m.training
                      ? `признаки ${m.training.featureYears.join(", ")} → исход ${m.training.targetYears.join(", ")}`
                      : "—"
                  }
                />
                <p className="pt-1 text-[12px] text-muted">{m.note}</p>
              </dl>
            )}
          </Async>
          <div>
            <div className="mb-2 text-[13px] font-semibold text-fg">Метрики качества</div>
            {technical ? (
              <Async state={metrics} skeleton={<Skeleton height={180} />}>
                {(mt) => (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Balanced Accuracy", mt?.balancedAccuracy],
                      ["Macro F1", mt?.macroF1],
                      ["Recall «ушёл»", mt?.perClass?.leave.recall],
                      ["F2 «ушёл»", mt?.perClass?.leave.f2],
                      ["Log loss", mt?.logLoss],
                      ["Brier score", mt?.brierScore],
                      ["ECE (калибровка)", mt?.expectedCalibrationError],
                      ["ROC-AUC OvR", mt?.rocAucOvr],
                    ].map(([label, v]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <div className="text-[12px] text-muted">{label}</div>
                        <div className="tnum mt-1 text-[13px] font-semibold text-fg">
                          {v == null ? (
                            <span className="font-normal text-muted">после обучения</span>
                          ) : (
                            fmt(Number(v), 3)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Async>
            ) : (
              <p className="text-[12.5px] text-muted">
                Детальные метрики доступны роли «Аналитик».
              </p>
            )}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-fg">{v}</dd>
    </div>
  );
}
