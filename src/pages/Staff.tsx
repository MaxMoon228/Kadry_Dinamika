import { useEffect, useState } from "react";
import { useApp } from "../app/AppContext";
import { HBars, Histogram } from "../components/charts";
import { PendingBadge, StatusBadge } from "../components/mobility";
import { Async, EmptyState, PageSkeleton, Skeleton } from "../components/states";
import {
  Badge,
  Button,
  Card,
  ChartCard,
  Chip,
  Drawer,
  Field,
  Input,
  KpiCard,
  PageHead,
  Select,
  Tabs,
  Th,
  fmt,
  pct,
} from "../components/ui";

import type { TeacherListQuery, TeacherSortField } from "../data/contracts/dto";
import { useData } from "../data/DataProvider";
import { MOBILITY_LABELS, type MobilityKey } from "../domain/mobility";
import { NO_CATEGORY } from "../domain/teacher";
import { useAsync } from "../hooks/useAsync";

export default function Staff() {
  const data = useData();
  const { filters } = useApp();
  const [tab, setTab] = useState<"structure" | "registry">("structure");
  const comp = useAsync(
    () => data.analytics.getComposition(filters),
    [data, filters.year, filters.district],
  );
  return (
    <div className="space-y-6">
      <PageHead
        title="Педагогический состав"
        subtitle={`Структура педагогических кадров и обезличенный реестр · срез ${filters.year} г.`}
      />
      <Async state={comp} skeleton={<Skeleton height={96} />}>
        {(c) => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Педагогов" value={fmt(c.teacherCount)} />
            <KpiCard label="Средний возраст" value={fmt(c.avgAge)} unit="лет" />
            <KpiCard label="Средний пед. стаж" value={fmt(c.avgPedagogicalExperience)} unit="лет" />
            <KpiCard label="Доля до 35 лет" value={pct(c.under35Share)} />
            <KpiCard
              label="С квал. категорией"
              value={pct(c.withCategoryShare)}
              info="Доля педагогов с высшей или первой категорией."
            />
            <KpiCard label="Классных рук." value={pct(c.classTeacherShare)} />
          </div>
        )}
      </Async>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "structure", label: "Структура состава" },
          { value: "registry", label: "Реестр педагогов" },
        ]}
      />
      {tab === "structure" ? (
        <Async state={comp} skeleton={<PageSkeleton />}>
          {(c) => (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartCard
                title="Возрастная структура"
                subtitle="Число педагогов по возрастным группам"
              >
                <Histogram data={c.byAgeGroup} />
              </ChartCard>
              <ChartCard
                title="Структура по педагогическому стажу"
                subtitle="Число педагогов по группам стажа"
              >
                <Histogram data={c.byExperienceGroup} color="var(--chart-3)" />
              </ChartCard>
              <ChartCard title="Квалификационные категории" subtitle="Число педагогов">
                <HBars data={c.byCategory} />
              </ChartCard>
              <ChartCard
                title="Направления деятельности"
                subtitle="Поле «Направление деятельности» · топ-12"
              >
                <HBars data={c.byActivityDirection} color="var(--chart-3)" />
              </ChartCard>
              <ChartCard
                title="Педагоги по предметам"
                subtitle="Педагог с несколькими предметами учитывается в каждом"
                className="lg:col-span-2"
              >
                <HBars data={c.bySubject} />
              </ChartCard>
              <ChartCard title="Классное руководство" subtitle="Доля педагогов, %">
                <RatioBar value={c.classTeacherShare} label="Ведут классное руководство" />
              </ChartCard>
              <ChartCard
                title="Предпрофессиональные классы"
                subtitle="Доля педагогов, преподающих в предпроф. классах, %"
              >
                <RatioBar value={c.preprofessionalShare} label="Преподают в предпроф. классах" />
              </ChartCard>
            </div>
          )}
        </Async>
      ) : (
        <Registry />
      )}
    </div>
  );
}

function RatioBar({ value, label }: { value: number | null; label: string }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div style={{ width: `${v}%`, background: "var(--chart-1)" }} />
      </div>
      <div className="mt-3 flex justify-between text-[12.5px] text-fg-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-1)]" />
          {label} — <b className="tnum text-fg">{pct(value)}</b>
        </span>
        <span className="text-muted">
          Остальные — {value == null ? "—" : `${fmt(Math.round((100 - v) * 10) / 10)}%`}
        </span>
      </div>
    </div>
  );
}

type PageFilters = Pick<
  TeacherListQuery,
  "subject" | "qualificationCategory" | "outcome" | "ageMin" | "ageMax" | "pedExpMin" | "pedExpMax"
>;

const EMPTY: PageFilters = {
  subject: null,
  qualificationCategory: null,
  outcome: null,
  ageMin: null,
  ageMax: null,
  pedExpMin: null,
  pedExpMax: null,
};

const PAGE_SIZE = 25;

function Registry() {
  const data = useData();
  const { filters, navigate, dictionaries } = useApp();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pf, setPf] = useState<PageFilters>(EMPTY);
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{
    field: TeacherSortField;
    direction: "asc" | "desc";
  }>({ field: "age", direction: "desc" });
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, pf, filters.year, filters.district, sort]);
  const query: TeacherListQuery = {
    ...filters,
    ...pf,
    search: debounced || null,
    page,
    pageSize: PAGE_SIZE,
    sort,
  };
  const list = useAsync(() => data.teachers.list(query), [data, JSON.stringify(query)]);
  const nextPeriod = dictionaries.periods.find((p) => p.fromYear === filters.year);
  const toggleSort = (field: TeacherSortField) =>
    setSort((s) => ({
      field,
      direction: s.field === field && s.direction === "desc" ? "asc" : "desc",
    }));
  const th = (field: TeacherSortField, label: string, right = false) => (
    <Th
      onClick={() => toggleSort(field)}
      active={sort.field === field}
      dir={sort.direction}
      align={right ? "right" : "left"}
    >
      {label}
    </Th>
  );
  const chips: { label: string; clear: Partial<PageFilters> }[] = [];
  if (pf.subject) chips.push({ label: pf.subject, clear: { subject: null } });
  if (pf.qualificationCategory)
    chips.push({
      label: pf.qualificationCategory,
      clear: { qualificationCategory: null },
    });
  if (pf.outcome)
    chips.push({
      label: MOBILITY_LABELS[pf.outcome].short,
      clear: { outcome: null },
    });
  if (pf.ageMin != null || pf.ageMax != null)
    chips.push({
      label: `Возраст ${pf.ageMin ?? "…"}–${pf.ageMax ?? "…"}`,
      clear: { ageMin: null, ageMax: null },
    });
  if (pf.pedExpMin != null || pf.pedExpMax != null)
    chips.push({
      label: `Пед. стаж ${pf.pedExpMin ?? "…"}–${pf.pedExpMax ?? "…"}`,
      clear: { pedExpMin: null, pedExpMax: null },
    });
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line-2 p-4">
        <div className="relative min-w-[220px] flex-1">
          <svg
            className="absolute top-2.5 left-3 text-faint"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по обезличенному ID или школе…"
            className="w-full pl-9"
            aria-label="Поиск"
          />
        </div>
        <Button variant="outline" onClick={() => setDrawer(true)}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          Фильтры реестра
          {chips.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-on-accent">
              {chips.length}
            </span>
          )}
        </Button>
        {list.data && <Badge>{fmt(list.data.total)} записей</Badge>}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line-2 px-4 py-2.5">
          {chips.map((c) => (
            <Chip key={c.label} label={c.label} onRemove={() => setPf({ ...pf, ...c.clear })} />
          ))}
          <button
            className="text-[12px] font-medium text-accent hover:underline"
            onClick={() => setPf(EMPTY)}
          >
            Сбросить всё
          </button>
        </div>
      )}
      <Async
        state={list}
        skeleton={<Skeleton className="m-4" height={400} />}
        isEmpty={(p) => p.total === 0}
        empty={
          <div className="p-4">
            <EmptyState
              title="Педагоги не найдены"
              note="Измените условия поиска или фильтры реестра."
            />
          </div>
        }
      >
        {(p) => (
          <>
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full border-collapse text-[12.5px] text-fg">
                <thead>
                  <tr>
                    {th("teacherId", "ID")}
                    {th("schoolName", "Школа")}
                    <Th>Округ</Th>
                    <Th>Должность</Th>
                    <Th>Предметы</Th>
                    {th("age", "Возраст", true)}
                    {th("totalExperienceYears", "Общ. стаж", true)}
                    {th("pedagogicalExperienceYears", "Пед. стаж", true)}
                    {th("qualificationCategory", "Категория")}
                    <Th>Кл. рук.</Th>
                    <Th>Предпроф.</Th>
                    <Th>Исход {nextPeriod ? `${nextPeriod.fromYear}→${nextPeriod.toYear}` : ""}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((t) => (
                    <tr key={t.teacherId} className="border-b border-line-2 hover:bg-hover">
                      <td className="px-3 py-2 font-mono text-[12px] font-medium text-accent-strong">
                        {t.teacherId}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.schoolName}</td>
                      <td className="px-3 py-2 text-fg-2">{t.district}</td>
                      <td className="px-3 py-2 text-fg-2">{t.mainPosition ?? "—"}</td>
                      <td className="px-3 py-2">{t.subjects.join(", ") || "—"}</td>
                      <td className="tnum px-3 py-2 text-right">{fmt(t.age)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmt(t.totalExperienceYears)}</td>
                      <td className="tnum px-3 py-2 text-right">
                        {fmt(t.pedagogicalExperienceYears)}
                      </td>
                      <td className="px-3 py-2">{t.qualificationCategory ?? NO_CATEGORY}</td>
                      <td className="px-3 py-2">
                        {t.isClassTeacher == null ? "—" : t.isClassTeacher ? "Да" : "Нет"}
                      </td>
                      <td className="px-3 py-2">{t.preprofessional ? "Да" : "—"}</td>
                      <td className="px-3 py-2">
                        {t.outcome ? <StatusBadge status={t.outcome.status} /> : <PendingBadge />}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => navigate({ page: "teacher", id: t.teacherId })}
                          className="rounded-md px-2 py-1 text-[12px] font-medium whitespace-nowrap text-accent hover:bg-accent-soft"
                        >
                          Профиль →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={p.page} pageSize={p.pageSize} total={p.total} onPage={setPage} />
          </>
        )}
      </Async>
      <RegistryFilters
        open={drawer}
        onClose={() => setDrawer(false)}
        value={pf}
        onApply={setPf}
        subjects={dictionaries.subjects}
        categories={dictionaries.qualificationCategories}
      />
    </Card>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-2 px-4 py-3 text-[12.5px] text-muted">
      <span>
        {fmt((page - 1) * pageSize + 1)}–{fmt(Math.min(total, page * pageSize))} из {fmt(total)}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Назад
        </Button>
        <span className="tnum px-2">
          {page} / {pages}
        </span>
        <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Вперёд →
        </Button>
      </div>
    </div>
  );
}

function RegistryFilters({
  open,
  onClose,
  value,
  onApply,
  subjects,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  value: PageFilters;
  onApply: (v: PageFilters) => void;
  subjects: string[];
  categories: string[];
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    if (open) setLocal(value);
  }, [open, value]);
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <Drawer open={open} onClose={onClose} title="Фильтры реестра">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <Field label="Предмет">
          <Select
            value={local.subject ?? ""}
            onChange={(v) => setLocal({ ...local, subject: v || null })}
            options={[
              { value: "", label: "Все предметы" },
              ...subjects.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Field>
        <Field label="Квалификационная категория">
          <Select
            value={local.qualificationCategory ?? ""}
            onChange={(v) => setLocal({ ...local, qualificationCategory: v || null })}
            options={[
              { value: "", label: "Все категории" },
              ...categories.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Field>
        <Field
          label="Исход в следующем периоде"
          hint="Для последнего года среза исход ещё не наблюдается."
        >
          <Select
            value={local.outcome ?? ""}
            onChange={(v) => setLocal({ ...local, outcome: (v || null) as MobilityKey | null })}
            options={[
              { value: "", label: "Все" },
              ...(["stay", "move", "leave"] as const).map((k) => ({
                value: k,
                label: MOBILITY_LABELS[k].full,
              })),
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Возраст от">
            <Input
              type="number"
              min={18}
              max={80}
              value={local.ageMin ?? ""}
              onChange={(e) => setLocal({ ...local, ageMin: num(e.target.value) })}
            />
          </Field>
          <Field label="Возраст до">
            <Input
              type="number"
              min={18}
              max={80}
              value={local.ageMax ?? ""}
              onChange={(e) => setLocal({ ...local, ageMax: num(e.target.value) })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Пед. стаж от">
            <Input
              type="number"
              min={0}
              value={local.pedExpMin ?? ""}
              onChange={(e) => setLocal({ ...local, pedExpMin: num(e.target.value) })}
            />
          </Field>
          <Field label="Пед. стаж до">
            <Input
              type="number"
              min={0}
              value={local.pedExpMax ?? ""}
              onChange={(e) => setLocal({ ...local, pedExpMax: num(e.target.value) })}
            />
          </Field>
        </div>
        <p className="text-[11.5px] leading-snug text-muted">
          Год и округ задаются глобальными фильтрами в шапке. Эти фильтры действуют только на реестр
          и выполняются на сервере.
        </p>
      </div>
      <div className="flex gap-2 border-t border-line px-5 py-4">
        <Button variant="outline" className="flex-1" onClick={() => setLocal(EMPTY)}>
          Сбросить
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            onApply(local);
            onClose();
          }}
        >
          Применить
        </Button>
      </div>
    </Drawer>
  );
}
