import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import { PendingBadge, StatusBadge } from "../components/mobility";
import { Async, PageSkeleton } from "../components/states";
import { Badge, Button, ChartCard, InfoRows, Th, fmt } from "../components/ui";
import { useData } from "../data/DataProvider";
import {
  CRITICAL_LOAD,
  FEATURE_LABELS,
  isCriticalLoad,
  type TeacherYearFeatures,
} from "../domain/features";
import { periodLabel } from "../domain/mobility";
import { GENDER_LABEL, NO_CATEGORY, parallelsOf, subjectsOf } from "../domain/teacher";
import { useAsync } from "../hooks/useAsync";
import { snapshotToForecastInput } from "../services/forecast/featureMapping";

const yearWord = (n: number) => {
  if (!Number.isInteger(n)) return "года";
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "год";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "года";
  return "лет";
};
const yrs = (n: number | null) =>
  n == null ? "—" : `${n.toLocaleString("ru-RU")} ${yearWord(n)}`;

type FeatureKey = Exclude<keyof TeacherYearFeatures, "teacherId" | "year">;

const FEATURE_ROWS: FeatureKey[] = [
  "main_position_cat",
  "main_subject_group",
  "n_unique_subjects",
  "n_unique_parallel",
  "min_parallel",
  "max_parallel",
  "is_exam_subject",
  "category_qual_cat",
  "category_active",
  "academic_degree_cat",
  "experience_age_other",
  "high_type_education",
  "is_ped_education",
  "n_courses",
  "hours_courses",
  "n_gia_courses",
  "has_pp",
  "target",
];

const BINARY: FeatureKey[] = ["is_exam_subject", "is_ped_education", "has_pp"];

const TARGET_LABEL = ["0 — остался", "1 — ушёл", "2 — перевёлся"];

function featureValue(k: FeatureKey, v: string | number | null): string {
  if (v == null) return k === "target" ? "нет (последний год)" : "—";
  if (k === "target") return TARGET_LABEL[Number(v)] ?? String(v);
  if (BINARY.includes(k)) return v === 1 ? "Да" : "Нет";
  if (typeof v === "string") return v.replace(/_/g, " ");
  return String(v);
}

export default function TeacherProfile({ id }: { id: string }) {
  const data = useData();
  const { filters, navigate, openCalculator, dictionaries } = useApp();
  const { can } = useSession();
  const missing = dictionaries.meta.unavailableFields;
  const hasProvider = !missing.includes("trainingProvider");
  const hasPreprof = !missing.includes("preprofessional");
  // В реальной выгрузке даты категорий, окончания и документов ПК/ПП заданы только годом.
  const day = (v: string | null) => (v == null ? "—" : dictionaries.meta.isMock ? v : v.slice(0, 4));
  const profile = useAsync(
    () => data.teachers.getProfile(id, filters.year),
    [data, id, filters.year],
  );
  return (
    <div className="space-y-6">
      <button
        onClick={() => (window.history.length > 1 ? window.history.back() : navigate({ page: "staff" }))}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-accent"
      >
        ← Назад
      </button>
      <Async state={profile} skeleton={<PageSkeleton />}>
        {(p) => {
          const s = p.snapshot;
          const d = p.derived;
          const f = p.datasetFeatures;
          const critical = isCriticalLoad(
            s.pedagogicalExperienceYears,
            f?.n_unique_subjects ?? d.subjectCount,
          );
          const lastOutcome = p.outcomes[p.outcomes.length - 1];
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft font-mono text-[13px] font-semibold text-accent-strong">
                    ID
                  </div>
                  <div>
                    <h2 className="font-mono text-[22px] font-semibold tracking-tight text-fg">
                      {p.teacherId}
                    </h2>
                    <p className="text-[13px] text-muted">
                      Обезличенный профиль · {p.school.name} · срез {p.year} г.
                      {p.year !== filters.year && " (ближайший доступный)"}
                    </p>
                  </div>
                </div>
                {lastOutcome ? (
                  <StatusBadge
                    status={lastOutcome.status}
                    label={`${periodLabel(lastOutcome.period)}: ${["остался", "перешёл", "ушёл из системы"][lastOutcome.status]}`}
                  />
                ) : (
                  <PendingBadge />
                )}
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <InfoRows
                    title="Основная информация"
                    rows={[
                      ["ID", p.teacherId],
                      ["Школа", p.school.name],
                      ["Округ", p.school.district],
                      ["Основная должность", s.mainPosition ?? "—"],
                      ["Направление деятельности", s.activityDirection ?? "—"],
                      ["Предметы", subjectsOf(s).join(", ") || "—"],
                      ["Пол", s.gender ? GENDER_LABEL[s.gender] : "—"],
                      ["Возраст", yrs(s.age)],
                    ]}
                  />
                  <InfoRows
                    title="Опыт и квалификация"
                    rows={[
                      ["Общий стаж", yrs(s.totalExperienceYears)],
                      ["Педагогический стаж", yrs(s.pedagogicalExperienceYears)],
                      ["Учёная степень", s.academicDegree ?? "Нет"],
                      ["Квалификационная категория", s.qualificationCategory ?? NO_CATEGORY],
                      ["Дата присвоения категории", day(s.qualificationAssignedAt)],
                      ["Срок действия категории", day(s.qualificationValidUntil)],
                    ]}
                  />
                  <ChartCard
                    title="Образование"
                    subtitle="Все записи педагога (дубли накопительного итога удалены)"
                  >
                    {p.education.length === 0 ? (
                      <p className="text-[13px] text-muted">Записи об образовании отсутствуют.</p>
                    ) : (
                      <div className="-mx-5 -mb-5 overflow-x-auto">
                        <table className="w-full text-[12.5px] text-fg">
                          <thead>
                            <tr>
                              <Th>Тип</Th>
                              <Th>Учебное заведение</Th>
                              <Th>Окончание</Th>
                              <Th>Специализация</Th>
                              <Th>Квалификация</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.education.map((e, i) => (
                              <tr key={i} className="border-b border-line-2">
                                <td className="px-3 py-2 font-medium">{e.educationType}</td>
                                <td className="px-3 py-2 text-fg-2">{e.institution ?? "—"}</td>
                                <td className="tnum px-3 py-2 text-fg-2">
                                  {day(e.graduationDate)}
                                </td>
                                <td className="px-3 py-2">{e.specialization ?? "—"}</td>
                                <td className="px-3 py-2">{e.qualification ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ChartCard>
                  <ChartCard
                    title="Повышение квалификации и переподготовка"
                    subtitle="Документы за наблюдаемый период"
                  >
                    {p.training.length === 0 ? (
                      <p className="text-[13px] text-muted">
                        Программы ПК/ПП в наблюдаемом периоде не зафиксированы.
                      </p>
                    ) : (
                      <div className="-mx-5 -mb-5 overflow-x-auto">
                        <table className="w-full text-[12.5px] text-fg">
                          <thead>
                            <tr>
                              <Th>Программа</Th>
                              <Th>Тип</Th>
                              {hasProvider && <Th>Организатор</Th>}
                              <Th align="right">Часов</Th>
                              <Th>Дата</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.training.map((c, i) => (
                              <tr key={i} className="border-b border-line-2">
                                <td className="px-3 py-2 font-medium">{c.programName}</td>
                                <td className="px-3 py-2">
                                  <Badge tone={c.programType === "ПК" ? "accent" : "neutral"}>
                                    {c.programType}
                                  </Badge>
                                </td>
                                {hasProvider && (
                                  <td className="px-3 py-2 text-fg-2">{c.provider ?? "—"}</td>
                                )}
                                <td className="tnum px-3 py-2 text-right">{fmt(c.hours)}</td>
                                <td className="tnum px-3 py-2 text-fg-2">
                                  {day(c.documentDate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </ChartCard>
                </div>
                <div className="space-y-6">
                  <InfoRows
                    title="Нагрузка и дополнительная деятельность"
                    rows={[
                      [
                        "Классное руководство",
                        s.isClassTeacher == null ? "—" : s.isClassTeacher ? "Да" : "Нет",
                      ],
                      ...(hasPreprof
                        ? [
                            [
                              "Предпрофессиональные классы",
                              s.preprofessionalDirection ?? "Не преподаёт",
                            ] as [string, string],
                          ]
                        : []),
                      ["Параллели", parallelsOf(s).join(", ") || "—"],
                      ["Число предметов", String(f?.n_unique_subjects ?? d.subjectCount)],
                    ]}
                  />
                  {critical && (
                    <div className="rounded-xl border border-[var(--glow-border)] bg-[linear-gradient(135deg,var(--danger-soft),transparent)] px-4 py-3 text-[12.5px] leading-snug text-fg-2">
                      <span className="font-semibold text-[var(--danger)]">Критическая нагрузка.</span>{" "}
                      Стаж педагогической работы меньше {CRITICAL_LOAD.maxExperienceExclusive} лет
                      при {CRITICAL_LOAD.minSubjects}+ разных предметах (критерий ноутбука «Неделя 5»).
                    </div>
                  )}
                  {f && (
                    <InfoRows
                      title={`Признаки итоговой таблицы df_final · ${f.year}`}
                      rows={FEATURE_ROWS.map((k) => [FEATURE_LABELS[k], featureValue(k, f[k])])}
                    />
                  )}
                  <InfoRows
                    title="Производные признаки (на дату среза)"
                    rows={[
                      ["Программ ПК/ПП", String(d.trainingCount)],
                      ["Часов ПК/ПП", fmt(d.trainingHoursTotal)],
                      ["Есть переподготовка (ПП)", d.hasProfessionalRetraining ? "Да" : "Нет"],
                      [
                        "Лет с последнего обучения",
                        d.yearsSinceLastTraining == null ? "—" : String(d.yearsSinceLastTraining),
                      ],
                      [
                        "Лет с присвоения категории",
                        d.yearsSinceQualification == null ? "—" : String(d.yearsSinceQualification),
                      ],
                      [
                        "Лет с окончания обучения",
                        d.yearsSinceGraduation == null ? "—" : String(d.yearsSinceGraduation),
                      ],
                    ]}
                  />
                  <ChartCard
                    title="Траектория в наблюдаемом периоде"
                    subtitle="Присутствие в срезах и исходы периодов"
                  >
                    <div className="space-y-2.5">
                      {p.trajectory.map((t) => {
                        const o = p.outcomes.find((x) => x.period.fromYear === t.year);
                        return (
                          <div key={t.year} className="flex items-center gap-3">
                            <span className="tnum w-10 text-[12px] font-medium text-muted">
                              {t.year}
                            </span>
                            <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-md border border-line-2 px-3 py-1.5 text-[12px] text-fg-2">
                              <span>{t.present ? t.schoolLabel : "Нет в срезе"}</span>
                              {o && <StatusBadge status={o.status} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11.5px] leading-snug text-muted">
                      Показан только наблюдаемый период. Карьерная история вне него и стаж в текущей
                      школе в данных отсутствуют. Школы вне вашей области доступа обезличены.
                    </p>
                  </ChartCard>
                  {can("forecast:use") && (
                    <Button
                      className="w-full"
                      onClick={() =>
                        openCalculator(snapshotToForecastInput(s, p.training, p.education))
                      }
                    >
                      Рассчитать прогноз по профилю
                    </Button>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}
