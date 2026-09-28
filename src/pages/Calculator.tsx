import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "../app/AppContext";
import { useSession } from "../auth/SessionProvider";
import { RadialGauge } from "../components/charts";
import { MOB, ProbabilityBar } from "../components/mobility";
import { EmptyState, ErrorState, Skeleton } from "../components/states";
import {
  Badge,
  Button,
  Card,
  ChartCard,
  Field,
  Input,
  PageHead,
  Segmented,
  Select,
  fmt,
} from "../components/ui";

import { ValidationError, type FieldError } from "../data/contracts/errors";
import { useData } from "../data/DataProvider";
import { studentsPerTeacher } from "../data/selectors/composition";
import {
  FORECAST_INPUT_SCHEMA_VERSION,
  type ForecastInput,
  type ForecastResult,
} from "../domain/forecast";

import {
  MOBILITY_KEYS,
  MOBILITY_KEY_BY_CLASS,
  MOBILITY_LABELS,
  type MobilityKey,
} from "../domain/mobility";

import { NO_CATEGORY } from "../domain/teacher";
import { useAsync } from "../hooks/useAsync";
import { validateForecastInput } from "../services/forecast/validation";

interface FormState {
  referenceYear: string;
  gender: "" | "female" | "male";
  age: string;
  mainPosition: string;
  activityDirection: string;
  subject1: string;
  subject2: string;
  parallels: string[];
  totalExp: string;
  pedExp: string;
  degree: string;
  category: string;
  categoryDate: string;
  classTeacher: "yes" | "no";
  preprof: string;
  eduType: string;
  eduSpec: string;
  eduQual: string;
  gradYear: string;
  programCount: string;
  totalHours: string;
  hasRetraining: "yes" | "no";
  lastDocDate: string;
  schoolMode: "reference" | "manual";
  schoolId: string;
  district: string;
  buildings: string;
  students: string;
  teachers: string;
}

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s));

function fromInput(i: ForecastInput): Partial<FormState> {
  const e = i.education[0];
  return {
    referenceYear: String(i.referenceYear),
    gender: i.teacher.gender ?? "",
    age: str(i.teacher.age),
    mainPosition: i.teacher.mainPosition ?? "",
    activityDirection: i.teacher.activityDirection ?? "",
    subject1: i.teacher.subjects[0] ?? "",
    subject2: i.teacher.subjects[1] ?? "",
    parallels: i.teacher.parallels,
    totalExp: str(i.teacher.totalExperienceYears),
    pedExp: str(i.teacher.pedagogicalExperienceYears),
    degree: i.teacher.academicDegree ?? "",
    category: i.teacher.qualificationCategory ?? NO_CATEGORY,
    categoryDate: i.teacher.qualificationAssignedAt ?? "",
    classTeacher: i.teacher.isClassTeacher ? "yes" : "no",
    preprof: i.teacher.preprofessionalDirection ?? "",
    eduType: e?.educationType ?? "",
    eduSpec: e?.specialization ?? "",
    eduQual: e?.qualification ?? "",
    gradYear: str(e?.graduationYear),
    programCount: str(i.training.programCount),
    totalHours: str(i.training.totalHours),
    hasRetraining: i.training.hasRetraining ? "yes" : "no",
    lastDocDate: i.training.lastDocumentDate ?? "",
    ...(i.school.mode === "reference"
      ? { schoolMode: "reference" as const, schoolId: i.school.schoolId }
      : {}),
  };
}

function toInput(f: FormState): ForecastInput {
  const category = f.category === NO_CATEGORY || !f.category ? null : f.category;
  return {
    schemaVersion: FORECAST_INPUT_SCHEMA_VERSION,
    referenceYear: Number(f.referenceYear),
    teacher: {
      gender: f.gender || null,
      age: toNum(f.age),
      mainPosition: f.mainPosition || null,
      activityDirection: f.activityDirection || null,
      academicDegree: f.degree || null,
      qualificationCategory: category,
      qualificationAssignedAt: category && f.categoryDate ? f.categoryDate : null,
      totalExperienceYears: toNum(f.totalExp),
      pedagogicalExperienceYears: toNum(f.pedExp),
      subjects: [f.subject1, f.subject2].filter((s, i, a) => s && a.indexOf(s) === i),
      parallels: f.parallels,
      isClassTeacher: f.classTeacher === "yes",
      preprofessionalDirection: f.preprof || null,
    },
    education: f.eduType
      ? [
          {
            educationType: f.eduType,
            specialization: f.eduSpec || null,
            qualification: f.eduQual || null,
            graduationYear: f.gradYear ? toNum(f.gradYear) : null,
          },
        ]
      : [],
    training: {
      programCount: f.programCount === "" ? 0 : toNum(f.programCount),
      totalHours: f.totalHours === "" ? 0 : toNum(f.totalHours),
      hasRetraining: f.hasRetraining === "yes",
      lastDocumentDate: f.lastDocDate || null,
    },
    school:
      f.schoolMode === "reference"
        ? { mode: "reference", schoolId: f.schoolId }
        : {
            mode: "manual",
            district: f.district,
            buildingCount: toNum(f.buildings),
            studentCount: toNum(f.students),
            teacherCount: toNum(f.teachers),
          },
  };
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "error";
      error: unknown;
    }
  | { kind: "done"; result: ForecastResult; referenceYear: number };

export default function Calculator() {
  const data = useData();
  const { dictionaries: dict, calculatorPrefill, filters } = useApp();
  const { scope } = useSession();
  const director = scope.kind === "school";
  const schools = useAsync(
    () => data.schools.list({ year: filters.year, district: null }),
    [data, filters.year],
  );
  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      referenceYear: String(dict.years[dict.years.length - 1]),
      gender: "female",
      age: "31",
      mainPosition: dict.mainPositions.includes("Учитель")
        ? "Учитель"
        : (dict.mainPositions[0] ?? ""),
      activityDirection: dict.activityDirections[0] ?? "",
      subject1: dict.subjects.includes("Математика") ? "Математика" : (dict.subjects[0] ?? ""),
      subject2: "",
      parallels: ["7", "8"],
      totalExp: "8",
      pedExp: "6",
      degree: "",
      category: "Первая",
      categoryDate: "2021-05-15",
      classTeacher: "no",
      preprof: "",
      eduType: dict.educationTypes.includes("Высшее образование")
        ? "Высшее образование"
        : (dict.educationTypes[0] ?? ""),
      eduSpec: "Математика",
      eduQual: "Учитель математики",
      gradYear: "2016",
      programCount: "1",
      totalHours: "36",
      hasRetraining: "no",
      lastDocDate: "2023-05-10",
      schoolMode: "reference",
      schoolId: scope.kind === "school" ? scope.schoolId : "",
      district: dict.districts[0] ?? "",
      buildings: "2",
      students: "980",
      teachers: "72",
    };
    const merged = calculatorPrefill ? { ...base, ...fromInput(calculatorPrefill) } : base;
    if (scope.kind === "school")
      return { ...merged, schoolMode: "reference", schoolId: scope.schoolId };
    return merged;
  }, [dict, calculatorPrefill, scope]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const err = (field: string) => errors.find((e) => e.field === field)?.message;
  const schoolRows = schools.data ?? [];
  const effectiveSchoolId = form.schoolId || schoolRows[0]?.schoolId || "";
  const selectedSchool = schoolRows.find((s) => s.schoolId === effectiveSchoolId);
  async function submit() {
    const input = toInput({ ...form, schoolId: effectiveSchoolId });
    const v = validateForecastInput(input);
    setErrors(v);
    if (v.length) return;
    setPhase({ kind: "loading" });
    try {
      const result = await data.forecast.predict(input);
      setPhase({ kind: "done", result, referenceYear: input.referenceYear });
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fieldErrors);
      setPhase({ kind: "error", error: e });
    }
  }
  const opt = (list: string[], empty?: string) => [
    ...(empty != null ? [{ value: "", label: empty }] : []),
    ...list.map((s) => ({ value: s, label: s })),
  ];
  const allParallels = dict.parallels.length
    ? dict.parallels
    : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
  return (
    <div className="space-y-6">
      <PageHead
        title="Калькулятор трудовой мобильности"
        subtitle="Введите характеристики педагогического профиля, чтобы получить вероятности трёх исходов"
      />
      {calculatorPrefill && (
        <Badge tone="accent">
          Форма предзаполнена из профиля педагога (ID не передаётся в запрос)
        </Badge>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <form
          className="space-y-6 lg:col-span-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <Section title="Педагог">
            <Field label="Год среза признаков" hint="Прогноз относится к следующему году">
              <Select
                value={form.referenceYear}
                onChange={(v) => set("referenceYear", v)}
                options={dict.years.map(String)}
              />
            </Field>
            <Field label="Пол">
              <Select
                value={form.gender}
                onChange={(v) => set("gender", v)}
                options={[
                  { value: "female", label: "Женский" },
                  { value: "male", label: "Мужской" },
                  { value: "", label: "Не указан" },
                ]}
              />
            </Field>
            <Field label="Возраст, лет" error={err("teacher.age")}>
              <Input
                type="number"
                min={18}
                max={80}
                value={form.age}
                invalid={!!err("teacher.age")}
                onChange={(e) => set("age", e.target.value)}
              />
            </Field>
            <Field label="Основная должность">
              <Select
                value={form.mainPosition}
                onChange={(v) => set("mainPosition", v)}
                options={opt(dict.mainPositions, "Не указана")}
              />
            </Field>
            <Field label="Направление деятельности">
              <Select
                value={form.activityDirection}
                onChange={(v) => set("activityDirection", v)}
                options={opt(dict.activityDirections, "Не указано")}
              />
            </Field>
            <Field label="Предмет" error={err("teacher.subjects")}>
              <Select
                value={form.subject1}
                onChange={(v) => set("subject1", v)}
                options={opt(dict.subjects, "Не выбран")}
              />
            </Field>
            <Field label="Второй предмет (если есть)">
              <Select
                value={form.subject2}
                onChange={(v) => set("subject2", v)}
                options={opt(dict.subjects, "Нет")}
              />
            </Field>
            <Field label="Общий стаж, лет" error={err("teacher.totalExperienceYears")}>
              <Input
                type="number"
                min={0}
                value={form.totalExp}
                invalid={!!err("teacher.totalExperienceYears")}
                onChange={(e) => set("totalExp", e.target.value)}
              />
            </Field>
            <Field
              label="Педагогический стаж, лет"
              error={err("teacher.pedagogicalExperienceYears")}
            >
              <Input
                type="number"
                min={0}
                value={form.pedExp}
                invalid={!!err("teacher.pedagogicalExperienceYears")}
                onChange={(e) => set("pedExp", e.target.value)}
              />
            </Field>
            <Field label="Учёная степень">
              <Select
                value={form.degree}
                onChange={(v) => set("degree", v)}
                options={opt(dict.academicDegrees, "Нет")}
              />
            </Field>
            <Field label="Квалификационная категория">
              <Select
                value={form.category}
                onChange={(v) => set("category", v)}
                options={dict.qualificationCategories}
              />
            </Field>
            <Field label="Дата присвоения категории" error={err("teacher.qualificationAssignedAt")}>
              <Input
                type="date"
                value={form.categoryDate}
                disabled={form.category === NO_CATEGORY}
                invalid={!!err("teacher.qualificationAssignedAt")}
                onChange={(e) => set("categoryDate", e.target.value)}
              />
            </Field>
            <Field label="Классное руководство">
              <Select
                value={form.classTeacher}
                onChange={(v) => set("classTeacher", v)}
                options={[
                  { value: "yes", label: "Да" },
                  { value: "no", label: "Нет" },
                ]}
              />
            </Field>
            <Field label="Предпрофессиональный класс">
              <Select
                value={form.preprof}
                onChange={(v) => set("preprof", v)}
                options={opt(dict.preprofessionalDirections, "Не преподаёт")}
              />
            </Field>
            <div className="sm:col-span-2">
              <span className="text-[12.5px] font-medium text-fg-2">Параллели</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {allParallels.map((p) => {
                  const on = form.parallels.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          "parallels",
                          on
                            ? form.parallels.filter((x) => x !== p)
                            : [...form.parallels, p].sort((a, b) => Number(a) - Number(b)),
                        )
                      }
                      className={`h-8 w-9 rounded-md border text-[12.5px] font-medium transition-colors ${
                        on
                          ? "border-accent bg-accent-soft text-accent-strong"
                          : "border-line bg-surface text-fg-2 hover:bg-hover"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
          <Section
            title="Образование"
            note="Основная запись. В API можно передать несколько записей."
          >
            <Field label="Тип образования" error={err("education.0.educationType")}>
              <Select
                value={form.eduType}
                onChange={(v) => set("eduType", v)}
                options={opt(dict.educationTypes, "Не указан")}
              />
            </Field>
            <Field label="Год окончания" error={err("education.0.graduationYear")}>
              <Input
                type="number"
                value={form.gradYear}
                invalid={!!err("education.0.graduationYear")}
                onChange={(e) => set("gradYear", e.target.value)}
              />
            </Field>
            <Field label="Специализация">
              <Input value={form.eduSpec} onChange={(e) => set("eduSpec", e.target.value)} />
            </Field>
            <Field label="Квалификация">
              <Input
                list="edu-qualifications"
                value={form.eduQual}
                onChange={(e) => set("eduQual", e.target.value)}
              />
              <datalist id="edu-qualifications">
                {dict.educationQualifications.map((q) => (
                  <option key={q} value={q} />
                ))}
              </datalist>
            </Field>
          </Section>
          <Section
            title="Повышение квалификации и переподготовка"
            note="Агрегаты по документам, полученным не позже даты среза."
          >
            <Field label="Количество программ" error={err("training.programCount")}>
              <Input
                type="number"
                min={0}
                value={form.programCount}
                invalid={!!err("training.programCount")}
                onChange={(e) => set("programCount", e.target.value)}
              />
            </Field>
            <Field label="Суммарное количество часов" error={err("training.totalHours")}>
              <Input
                type="number"
                min={0}
                value={form.totalHours}
                invalid={!!err("training.totalHours")}
                onChange={(e) => set("totalHours", e.target.value)}
              />
            </Field>
            <Field label="Есть профпереподготовка (ПП)">
              <Select
                value={form.hasRetraining}
                onChange={(v) => set("hasRetraining", v)}
                options={[
                  { value: "yes", label: "Да" },
                  { value: "no", label: "Нет" },
                ]}
              />
            </Field>
            <Field label="Дата последнего документа" error={err("training.lastDocumentDate")}>
              <Input
                type="date"
                value={form.lastDocDate}
                invalid={!!err("training.lastDocumentDate")}
                onChange={(e) => set("lastDocDate", e.target.value)}
              />
            </Field>
          </Section>
          <Section
            title="Школа"
            note={
              director
                ? "Школьные признаки берутся из профиля вашей школы на сервере."
                : "Рекомендуется выбирать школу из справочника — признаки берутся сервером, как при обучении."
            }
            right={
              !director ? (
                <Segmented
                  label="Источник школьных признаков"
                  value={form.schoolMode}
                  onChange={(v) => set("schoolMode", v)}
                  options={[
                    { value: "reference", label: "Из справочника" },
                    { value: "manual", label: "Сценарий вручную" },
                  ]}
                />
              ) : undefined
            }
          >
            {form.schoolMode === "reference" ? (
              <>
                <Field label="Школа" error={err("school.schoolId")}>
                  {director ? (
                    <Input value={dict.scopeSchool?.name ?? ""} disabled />
                  ) : schools.status === "success" ? (
                    <Select
                      value={effectiveSchoolId}
                      onChange={(v) => set("schoolId", v)}
                      options={schoolRows.map((s) => ({
                        value: s.schoolId,
                        label: `${s.name} · ${s.district}`,
                      }))}
                    />
                  ) : (
                    <Skeleton height={34} />
                  )}
                </Field>
                <ReadOnly
                  label="Округ"
                  value={selectedSchool?.district ?? dict.scopeSchool?.district ?? "—"}
                />
                <ReadOnly label="Зданий" value={fmt(selectedSchool?.buildingCount)} />
                <ReadOnly
                  label="Учащихся / педагогов"
                  value={`${fmt(selectedSchool?.studentCount)} / ${fmt(selectedSchool?.teacherCount)}`}
                />
                <ReadOnly
                  label="Учащихся на педагога (derived)"
                  value={fmt(selectedSchool?.studentsPerTeacher)}
                />
              </>
            ) : (
              <>
                <Field label="Округ" error={err("school.district")}>
                  <Select
                    value={form.district}
                    onChange={(v) => set("district", v)}
                    options={dict.districts}
                  />
                </Field>
                <Field label="Количество зданий" error={err("school.buildingCount")}>
                  <Input
                    type="number"
                    min={1}
                    value={form.buildings}
                    invalid={!!err("school.buildingCount")}
                    onChange={(e) => set("buildings", e.target.value)}
                  />
                </Field>
                <Field label="Численность учащихся" error={err("school.studentCount")}>
                  <Input
                    type="number"
                    min={1}
                    value={form.students}
                    invalid={!!err("school.studentCount")}
                    onChange={(e) => set("students", e.target.value)}
                  />
                </Field>
                <Field label="Число педагогов" error={err("school.teacherCount")}>
                  <Input
                    type="number"
                    min={1}
                    value={form.teachers}
                    invalid={!!err("school.teacherCount")}
                    onChange={(e) => set("teachers", e.target.value)}
                  />
                </Field>
                <ReadOnly
                  label="Учащихся на педагога (рассчитывается)"
                  value={fmt(
                    studentsPerTeacher(toNum(form.students) || null, toNum(form.teachers) || 0),
                  )}
                />
              </>
            )}
          </Section>
          {errors.length > 0 && (
            <Card className="border-danger bg-danger-soft px-4 py-3 text-[12.5px] text-danger">
              <b>Проверьте поля формы:</b> {errors.map((e) => e.message).join("; ")}
            </Card>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={phase.kind === "loading"}>
              {phase.kind === "loading" ? "Расчёт…" : "Рассчитать прогноз"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setForm(initial);
                setErrors([]);
                setPhase({ kind: "idle" });
              }}
            >
              Сбросить
            </Button>
          </div>
        </form>
        <div className="lg:col-span-2">
          <div className="space-y-4 lg:sticky lg:top-40">
            <ResultPanel phase={phase} onRetry={() => void submit()} />
            <div className="rounded-xl border border-warn bg-warn-soft px-4 py-3 text-[12px] leading-snug text-fg-2">
              <b className="text-warn">Дисклеймер.</b> Результат — вероятностная оценка модели для
              аналитической поддержки решений. Он не является фактом будущего поведения педагога, не
              устанавливает причин и не может быть основанием для кадровых решений, давления или
              санкций. Решения принимает человек с учётом контекста.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ phase, onRetry }: { phase: Phase; onRetry: () => void }) {
  const [explainKey, setExplainKey] = useState<MobilityKey | null>(null);
  if (phase.kind === "idle")
    return (
      <ChartCard title="Прогноз трудовой мобильности" subtitle="Вероятности трёх исходов">
        <EmptyState
          title="Заполните профиль"
          note="Укажите характеристики педагога и нажмите «Рассчитать прогноз»."
        />
      </ChartCard>
    );
  if (phase.kind === "loading")
    return (
      <ChartCard title="Прогноз трудовой мобильности" subtitle="Запрос к сервису прогноза…">
        <div className="space-y-3" aria-busy="true">
          <Skeleton height={150} />
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      </ChartCard>
    );
  if (phase.kind === "error")
    return (
      <ChartCard title="Прогноз трудовой мобильности" subtitle="Ошибка">
        <ErrorState error={phase.error} onRetry={onRetry} />
      </ChartCard>
    );
  const r = phase.result;
  const predicted = MOBILITY_KEY_BY_CLASS[r.predictedClass];
  const k = explainKey ?? predicted;
  const contributions = r.explanation.contributions.slice(0, 6);
  const maxAbs = Math.max(0.01, ...contributions.map((c) => Math.abs(c.impact[k])));
  const pp = (v: number) =>
    `${v > 0 ? "+" : ""}${(Math.round(v * 1000) / 10).toLocaleString("ru-RU")} п.п.`;
  return (
    <>
      <ChartCard
        title="Прогноз трудовой мобильности"
        subtitle={`Период ${phase.referenceYear} → ${phase.referenceYear + 1} · расчёт ${new Date(r.generatedAt).toLocaleString("ru-RU")}`}
        right={
          r.isMock ? (
            <Badge tone="warn">mock-модель</Badge>
          ) : r.calibrated ? (
            <Badge tone="accent">откалибровано</Badge>
          ) : (
            <Badge>без калибровки</Badge>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 py-4">
            <RadialGauge
              value={Math.round(r.probabilities[predicted] * 100)}
              color={MOB[predicted].color}
              sub="вероятность"
              label={MOBILITY_LABELS[predicted].forecast}
              size={132}
            />
            <span className="mt-1 text-[11.5px] text-muted">
              Предсказанный класс: {r.predictedClass} —{" "}
              {MOBILITY_LABELS[predicted].full.toLowerCase()}
            </span>
          </div>
          <div className="space-y-2">
            {MOBILITY_KEYS.map((key) => (
              <ProbabilityBar
                key={key}
                k={key}
                value={r.probabilities[key]}
                highlight={key === predicted}
              />
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line-2 pt-3 text-[11.5px]">
            <dt className="text-muted">Версия модели</dt>
            <dd className="text-right font-mono text-fg">{r.modelVersion}</dd>
            <dt className="text-muted">Схема признаков</dt>
            <dd className="text-right font-mono text-fg">{r.featureSchemaVersion}</dd>
            <dt className="text-muted">Учащихся на педагога</dt>
            <dd className="text-right text-fg">{fmt(r.resolvedSchool.studentsPerTeacher)}</dd>
            <dt className="text-muted">Request ID</dt>
            <dd className="truncate text-right font-mono text-fg">{r.requestId}</dd>
          </dl>
          {r.warnings.map((w) => (
            <p
              key={w}
              className="rounded-md bg-warn-soft px-3 py-2 text-[11.5px] leading-snug text-warn"
            >
              {w}
            </p>
          ))}
        </div>
      </ChartCard>
      <ChartCard
        title="Факторы, повлиявшие на прогноз модели"
        subtitle="Вклад признаков в вероятность выбранного исхода (локальное объяснение)"
        right={
          <Select
            ariaLabel="Исход для объяснения"
            value={k}
            onChange={(v) => setExplainKey(v)}
            options={MOBILITY_KEYS.map((x) => ({
              value: x,
              label: MOBILITY_LABELS[x].short,
            }))}
          />
        }
      >
        <p className="mb-3 text-[12px] text-muted">
          Базовая вероятность «{MOBILITY_LABELS[k].short.toLowerCase()}»:{" "}
          {(Math.round(r.explanation.baseProbabilities[k] * 1000) / 10).toLocaleString("ru-RU")}% →
          итог {(Math.round(r.probabilities[k] * 1000) / 10).toLocaleString("ru-RU")}%
        </p>
        <div className="space-y-3">
          {contributions.map((c) => {
            const v = c.impact[k];
            const w = (Math.abs(v) / maxAbs) * 50;
            return (
              <div key={c.feature}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-medium text-fg-2">
                    {c.label} <span className="font-normal text-muted">· {c.displayValue}</span>
                  </span>
                  <span
                    className="tnum font-medium"
                    style={{ color: v >= 0 ? MOB[k].fg : "var(--text-muted)" }}
                  >
                    {pp(v)}
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-[var(--border-subtle)]">
                  <div className="absolute top-0 left-1/2 h-full w-px bg-line-strong" />
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: v >= 0 ? "50%" : `${50 - w}%`,
                      width: `${w}%`,
                      background: v >= 0 ? MOB[k].color : "var(--text-faint)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[11.5px] leading-snug text-muted">
          Вправо — признак связан с увеличением прогнозной вероятности, влево — с уменьшением. Это
          объяснение поведения модели, а не причина решения педагога. {r.explanation.note}
        </p>
      </ChartCard>
    </>
  );
}

function Section({
  title,
  children,
  note,
  right,
}: {
  title: string;
  children: ReactNode;
  note?: string;
  right?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
        </div>
        {right}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-fg-2">{label}</span>
      <span className="rounded-lg border border-dashed border-line bg-surface-2 px-3 py-1.5 text-[13px] text-fg">
        {value}
      </span>
    </div>
  );
}
