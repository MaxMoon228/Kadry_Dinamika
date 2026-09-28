/**
 * MOCK / DEMO реализации репозиториев. Имитируют backend: считают агрегаты в пределах
 * access scope и возвращают те же DTO, что и будущий REST API.
 */

import type { Page, SchoolId, TeacherId, Year } from "../../domain/common";
import {
  MOBILITY_CLASS_BY_KEY,
  type MobilityClass,
  type MobilityGroupRow,
} from "../../domain/mobility";

import { NO_CATEGORY, subjectsOf, type TeacherYearSnapshot } from "../../domain/teacher";
import type {
  CompositionSummary,
  DashboardSummary,
  DataCatalog,
  Dictionaries,
  DistrictBreakdown,
  DynamicsSummary,
  GlobalFilters,
  HeatmapDto,
  MobilityDimension,
  MobilityOverview,
  NumericMetric,
  ScatterPoint,
  SchoolListQuery,
  SchoolProfileDto,
  SchoolSummaryRow,
  TeacherListQuery,
  TeacherProfileDto,
  TeacherRegistryRow,
  TrainingSummary,
  YearKpi,
} from "../contracts/dto";

import { AccessDeniedError, NotFoundError } from "../contracts/errors";
import type {
  AnalyticsRepository,
  DashboardRepository,
  DataCatalogRepository,
  DictionaryRepository,
  SchoolRepository,
  TeacherRepository,
} from "../contracts/repositories";

import {
  AGE_GROUPS,
  EXPERIENCE_GROUPS,
  ageGroupOf,
  categoryOf,
  countBy,
  deriveTeacherFeatures,
  experienceGroupOf,
  mean,
  shareOf,
  studentsPerTeacher,
  subjectKeys,
  UNKNOWN,
} from "../selectors/composition";

import { MIN_GROUP_SIZE, distributionOf, groupRow, mobilityByGroup } from "../selectors/mobility";
import type { MockContext } from "./context";
import { MOCK_DATASET_VERSION, MOCK_UPDATED_AT } from "./mockDataset";

const CATEGORY_ORDER = ["Высшая", "Первая", "Вторая", NO_CATEGORY];

function uniqSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => v != null))).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

// ------------------------------------------------------------------ shared computations

function yearKpi(ctx: MockContext, year: Year, filters: Pick<GlobalFilters, "district">): YearKpi {
  const ids = ctx.schoolIds(filters);
  const snaps = ctx.snapshots(year, undefined, ids);
  const students = ids.reduce<number | null>((a, id) => {
    const s = ctx.index.schoolYear(id, year)?.studentCount;
    return s == null ? a : (a ?? 0) + s;
  }, null);
  return {
    year,
    teacherCount: snaps.length,
    studentCount: students,
    avgAge: mean(snaps.map((s) => s.age)),
    avgPedagogicalExperience: mean(snaps.map((s) => s.pedagogicalExperienceYears)),
    studentsPerTeacher: studentsPerTeacher(students, snaps.length),
    under35Share: shareOf(snaps, (s) => (s.age == null ? null : s.age < 35)),
  };
}

function composition(
  ctx: MockContext,
  year: Year,
  snaps: TeacherYearSnapshot[],
): CompositionSummary {
  const eduTypes = (s: TeacherYearSnapshot) => {
    const types = uniqSorted(
      (ctx.index.educationByTeacher.get(s.teacherId) ?? [])
        .filter((e) => e.firstSeenYear <= year)
        .map((e) => e.educationType),
    );
    return types.length ? types : [UNKNOWN];
  };
  return {
    year,
    teacherCount: snaps.length,
    avgAge: mean(snaps.map((s) => s.age)),
    avgPedagogicalExperience: mean(snaps.map((s) => s.pedagogicalExperienceYears)),
    under35Share: shareOf(snaps, (s) => (s.age == null ? null : s.age < 35)),
    over60Share: shareOf(snaps, (s) => (s.age == null ? null : s.age >= 60)),
    withCategoryShare: shareOf(
      snaps,
      (s) => s.qualificationCategory === "Высшая" || s.qualificationCategory === "Первая",
    ),
    classTeacherShare: shareOf(snaps, (s) => s.isClassTeacher),
    preprofessionalShare: shareOf(snaps, (s) => s.preprofessionalDirection != null),
    byAgeGroup: countBy(snaps, (s) => ageGroupOf(s.age), AGE_GROUPS),
    byExperienceGroup: countBy(
      snaps,
      (s) => experienceGroupOf(s.pedagogicalExperienceYears),
      EXPERIENCE_GROUPS,
    ),
    byCategory: countBy(snaps, categoryOf, CATEGORY_ORDER),
    bySubject: countBy(snaps, subjectKeys),
    byActivityDirection: countBy(snaps, (s) => s.activityDirection ?? UNKNOWN).slice(0, 12),
    byEducationType: countBy(snaps, eduTypes),
  };
}

function trainingSummary(
  ctx: MockContext,
  year: Year,
  snaps: TeacherYearSnapshot[],
): TrainingSummary {
  const cutoff = `${year}-12-31`;
  const recs = snaps.flatMap((s) =>
    (ctx.index.trainingByTeacher.get(s.teacherId) ?? []).filter(
      (t) => t.documentDate != null && t.documentDate <= cutoff,
    ),
  );
  const teachersWith = new Set(recs.map((r) => r.teacherId)).size;
  const years = ctx.index.ds.years.filter((y) => y <= year);
  return {
    year,
    teacherCount: snaps.length,
    teachersWithTraining: teachersWith,
    programCount: recs.length,
    totalHours: recs.reduce((a, r) => a + (r.hours ?? 0), 0),
    byType: {
      ПК: recs.filter((r) => r.programType === "ПК").length,
      ПП: recs.filter((r) => r.programType === "ПП").length,
    },
    documentsByYear: years.map((y) => ({
      group: String(y),
      value: recs.filter((r) => r.documentDate!.startsWith(String(y))).length,
    })),
  };
}

/** Исходы периода, заканчивающегося в year, с признаками педагога на начало периода. */

function outcomesWithFeatures(ctx: MockContext, filters: GlobalFilters) {
  const period = ctx.periodFor(filters.year);
  if (!period)
    return {
      period: null,
      rows: [] as { status: MobilityClass; snap: TeacherYearSnapshot }[],
    };
  const rows = ctx.outcomes(period, filters).map((o) => ({
    status: o.status,
    snap: ctx.index.snapshot(o.teacherId, period.fromYear)!,
  }));
  return { period, rows };
}

function dimensionKey(
  ctx: MockContext,
  dim: MobilityDimension,
): { key: (s: TeacherYearSnapshot) => string; order?: readonly string[] } {
  switch (dim) {
    case "age_group":
      return { key: (s) => ageGroupOf(s.age), order: AGE_GROUPS };
    case "experience_group":
      return {
        key: (s) => experienceGroupOf(s.pedagogicalExperienceYears),
        order: EXPERIENCE_GROUPS,
      };
    case "subject":
      return { key: (s) => subjectsOf(s)[0] ?? UNKNOWN };
    case "qualification_category":
      return { key: categoryOf, order: CATEGORY_ORDER };
    case "class_teacher":
      return {
        key: (s) =>
          s.isClassTeacher == null
            ? UNKNOWN
            : s.isClassTeacher
              ? "Классный руководитель"
              : "Без классного руководства",
      };
    case "preprofessional":
      return {
        key: (s) =>
          s.preprofessionalDirection
            ? "Преподаёт в предпроф. классах"
            : "Не преподаёт в предпроф. классах",
      };
    case "has_training":
      return {
        key: (s) => {
          const has = (ctx.index.trainingByTeacher.get(s.teacherId) ?? []).some(
            (t) => t.documentDate != null && t.documentDate <= `${s.year}-12-31`,
          );
          return has ? "Проходил ПК/ПП" : "Не проходил ПК/ПП";
        },
      };
    case "district":
      return {
        key: (s) => ctx.index.schoolById.get(s.schoolId)?.district ?? UNKNOWN,
      };
  }
}

// ------------------------------------------------------------------ repositories

export function mockDictionaryRepository(ctx: MockContext): DictionaryRepository {
  return {
    get: () =>
      ctx.respond<Dictionaries>(() => {
        const ds = ctx.index.ds;
        const snaps = ds.teacherSnapshots;
        const visibleSchools = new Set(ctx.schoolIds());
        return {
          meta: {
            datasetVersion: MOCK_DATASET_VERSION,
            updatedAt: MOCK_UPDATED_AT,
            isMock: true,
          },
          scopeSchool:
            ctx.scope.kind === "school"
              ? (ctx.index.schoolById.get(ctx.scope.schoolId) ?? null)
              : null,
          years: ds.years,
          periods: ds.periods,
          districts: uniqSorted(
            ds.schools.filter((s) => visibleSchools.has(s.id)).map((s) => s.district),
          ),
          subjects: uniqSorted(snaps.flatMap((s) => s.assignments.map((a) => a.subject))),
          qualificationCategories: CATEGORY_ORDER,
          mainPositions: uniqSorted(snaps.map((s) => s.mainPosition)),
          activityDirections: uniqSorted(snaps.map((s) => s.activityDirection)),
          academicDegrees: uniqSorted(snaps.map((s) => s.academicDegree)),
          educationTypes: uniqSorted(ds.education.map((e) => e.educationType)),
          educationQualifications: uniqSorted(ds.education.map((e) => e.qualification)),
          preprofessionalDirections: uniqSorted(snaps.map((s) => s.preprofessionalDirection)),
          parallels: uniqSorted(snaps.flatMap((s) => s.assignments.map((a) => a.parallel))).sort(
            (a, b) => Number(a) - Number(b),
          ),
        };
      }),
  };
}

export function mockDashboardRepository(ctx: MockContext): DashboardRepository {
  return {
    getSummary: (f) =>
      ctx.respond<DashboardSummary>(() => {
        const years = ctx.index.ds.years;
        const trend = years.map((y) => yearKpi(ctx, y, f));
        const snaps = ctx.snapshots(f.year, f);
        const period = ctx.periodFor(f.year);
        const prevPeriod = ctx.periodFor(f.year - 1);
        return {
          scope: ctx.scope,
          year: f.year,
          schoolCount: ctx.schoolIds(f).length,
          current: trend.find((t) => t.year === f.year) ?? yearKpi(ctx, f.year, f),
          previous: trend.find((t) => t.year === f.year - 1) ?? null,
          trend,
          withCategoryShare: shareOf(
            snaps,
            (s) => s.qualificationCategory === "Высшая" || s.qualificationCategory === "Первая",
          ),
          classTeacherShare: shareOf(snaps, (s) => s.isClassTeacher),
          mobility: period ? distributionOf(ctx.outcomes(period, f), period) : null,
          previousMobility: prevPeriod
            ? distributionOf(ctx.outcomes(prevPeriod, f), prevPeriod)
            : null,
          mobilityTrend: ctx.index.ds.periods.map((p) => distributionOf(ctx.outcomes(p, f), p)),
        };
      }),
    getDistrictBreakdown: (f) =>
      ctx.respond<DistrictBreakdown>(() => {
        ctx.require("system:view");
        const districts = uniqSorted(ctx.index.ds.schools.map((s) => s.district)).filter(
          (d) => f.district == null || d === f.district,
        );
        const period = ctx.periodFor(f.year);
        const rows = districts.map((district) => {
          const k = yearKpi(ctx, f.year, { district });
          return {
            district,
            schoolCount: ctx.schoolIds({ district }).length,
            teacherCount: k.teacherCount,
            studentCount: k.studentCount,
            studentsPerTeacher: k.studentsPerTeacher,
            mobility: period ? distributionOf(ctx.outcomes(period, { district }), period) : null,
          };
        });
        return {
          year: f.year,
          rows,
          systemStudentsPerTeacher: yearKpi(ctx, f.year, f).studentsPerTeacher,
          teacherTrend: ctx.index.ds.years.map((y) => ({
            year: y,
            byDistrict: Object.fromEntries(
              districts.map((d) => [d, ctx.snapshots(y, { district: d }).length]),
            ),
          })),
        };
      }),
  };
}

export function mockSchoolRepository(ctx: MockContext): SchoolRepository {
  return {
    list: (q: SchoolListQuery) =>
      ctx.respond<SchoolSummaryRow[]>(() => {
        const firstYear = ctx.index.ds.years[0];
        const period = ctx.periodFor(q.year);
        return ctx.schoolIds(q).map((id) => {
          const school = ctx.index.schoolById.get(id)!;
          const snaps = ctx.snapshots(q.year, undefined, [id]);
          const ss = ctx.index.schoolYear(id, q.year);
          const first = ctx.index.schoolYear(id, firstYear);
          const mob: MobilityGroupRow | null = period
            ? groupRow(
                school.name,
                ctx.outcomes(period, undefined, [id]).map((o) => o.status),
              )
            : null;
          return {
            schoolId: id,
            name: school.name,
            district: school.district,
            buildingCount: ss?.buildingCount ?? null,
            studentCount: ss?.studentCount ?? null,
            teacherCount: snaps.length,
            studentsPerTeacher: studentsPerTeacher(ss?.studentCount ?? null, snaps.length),
            avgAge: mean(snaps.map((s) => s.age)),
            under35Share: shareOf(snaps, (s) => (s.age == null ? null : s.age < 35)),
            teacherCountChange:
              first && q.year !== firstYear ? snaps.length - first.teacherCount : null,
            mobility: mob,
          };
        });
      }),
    getProfile: (schoolId: SchoolId, year: Year) =>
      ctx.respond<SchoolProfileDto>(() => {
        // Сначала проверка scope, затем существования: директор не должен узнавать,

        // существует ли чужой schoolId (защита от перебора / IDOR).
        if (!ctx.canViewSchool(schoolId))
          throw new AccessDeniedError("Недостаточно прав для просмотра этой школы");
        const school = ctx.index.schoolById.get(schoolId);
        if (!school) throw new NotFoundError("Школа не найдена");
        const snaps = ctx.snapshots(year, undefined, [schoolId]);
        return {
          school,
          year,
          snapshots: ctx.index.ds.schoolSnapshots
            .filter((s) => s.schoolId === schoolId)
            .sort((a, b) => a.year - b.year),
          composition: composition(ctx, year, snaps),
          training: trainingSummary(ctx, year, snaps),
          mobilityByPeriod: ctx.index.ds.periods.map((p) =>
            distributionOf(ctx.outcomes(p, undefined, [schoolId]), p),
          ),
        };
      }),
  };
}

export function mockTeacherRepository(ctx: MockContext): TeacherRepository {
  return {
    list: (q: TeacherListQuery) =>
      ctx.respond<Page<TeacherRegistryRow>>(() => {
        ctx.require("teachers:view");
        const search = q.search?.trim().toLowerCase() || null;
        const outcomeClass = q.outcome ? MOBILITY_CLASS_BY_KEY[q.outcome] : null;
        const rows: TeacherRegistryRow[] = [];
        for (const s of ctx.snapshots(q.year, q)) {
          const school = ctx.index.schoolById.get(s.schoolId)!;
          if (
            search &&
            !s.teacherId.toLowerCase().includes(search) &&
            !school.name.toLowerCase().includes(search)
          )
            continue;
          if (q.subject && !s.assignments.some((a) => a.subject === q.subject)) continue;
          if (q.qualificationCategory && categoryOf(s) !== q.qualificationCategory) continue;
          if (q.ageMin != null && (s.age == null || s.age < q.ageMin)) continue;
          if (q.ageMax != null && (s.age == null || s.age > q.ageMax)) continue;
          if (
            q.pedExpMin != null &&
            (s.pedagogicalExperienceYears == null || s.pedagogicalExperienceYears < q.pedExpMin)
          )
            continue;
          if (
            q.pedExpMax != null &&
            (s.pedagogicalExperienceYears == null || s.pedagogicalExperienceYears > q.pedExpMax)
          )
            continue;
          const o = ctx.index.outcomeByKey.get(`${s.teacherId}|${q.year}`);
          if (outcomeClass != null && o?.status !== outcomeClass) continue;
          rows.push({
            teacherId: s.teacherId,
            schoolId: s.schoolId,
            schoolName: school.name,
            district: school.district,
            mainPosition: s.mainPosition,
            subjects: subjectsOf(s),
            age: s.age,
            totalExperienceYears: s.totalExperienceYears,
            pedagogicalExperienceYears: s.pedagogicalExperienceYears,
            qualificationCategory: s.qualificationCategory,
            isClassTeacher: s.isClassTeacher,
            preprofessional: s.preprofessionalDirection != null,
            outcome: o ? { period: o.period, status: o.status } : null,
          });
        }
        if (q.sort) {
          const { field, direction } = q.sort;
          const dir = direction === "asc" ? 1 : -1;
          rows.sort((a, b) => {
            const av = a[field];
            const bv = b[field];
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
            return String(av).localeCompare(String(bv), "ru") * dir;
          });
        }
        const start = (q.page - 1) * q.pageSize;
        return {
          items: rows.slice(start, start + q.pageSize),
          total: rows.length,
          page: q.page,
          pageSize: q.pageSize,
        };
      }),
    getProfile: (teacherId: TeacherId, year?: Year) =>
      ctx.respond<TeacherProfileDto>(() => {
        ctx.require("teachers:view");
        const all = ctx.index.snapshotsByTeacher.get(teacherId) ?? [];
        const visible = all.filter((s) => ctx.canViewSchool(s.schoolId));
        if (visible.length === 0) {
          if (ctx.scope.kind === "school" || all.length > 0)
            throw new AccessDeniedError("Недостаточно прав для просмотра этого педагога");
          throw new NotFoundError("Педагог не найден");
        }
        const snapshot = visible.find((s) => s.year === year) ?? visible[visible.length - 1];
        const school = ctx.index.schoolById.get(snapshot.schoolId)!;
        const training = ctx.index.trainingByTeacher.get(teacherId) ?? [];
        const education = ctx.index.educationByTeacher.get(teacherId) ?? [];
        return {
          teacherId,
          year: snapshot.year,
          snapshot,
          school,
          education,
          training: [...training].sort((a, b) =>
            (b.documentDate ?? "").localeCompare(a.documentDate ?? ""),
          ),
          derived: deriveTeacherFeatures(snapshot, training, education),
          trajectory: ctx.index.ds.years.map((y) => {
            const s = all.find((x) => x.year === y);
            if (!s)
              return {
                year: y,
                present: false,
                schoolLabel: null,
                isInScope: false,
              };
            const inScope = ctx.canViewSchool(s.schoolId);
            return {
              year: y,
              present: true,
              schoolLabel: inScope ? ctx.index.schoolById.get(s.schoolId)!.name : "Другая школа",
              isInScope: inScope,
            };
          }),
          outcomes: ctx.index.ds.periods
            .map((p) => ctx.index.outcomeByKey.get(`${teacherId}|${p.fromYear}`))
            .filter(
              (o): o is NonNullable<typeof o> => o != null && ctx.canViewSchool(o.fromSchoolId),
            )
            .map((o) => ({ period: o.period, status: o.status })),
        };
      }),
  };
}

const METRIC_VALUE: Record<
  NumericMetric,
  (ctx: MockContext, s: TeacherYearSnapshot) => number | null
> = {
  age: (_, s) => s.age,
  total_experience: (_, s) => s.totalExperienceYears,
  pedagogical_experience: (_, s) => s.pedagogicalExperienceYears,
  training_count: (ctx, s) =>
    (ctx.index.trainingByTeacher.get(s.teacherId) ?? []).filter(
      (t) => t.documentDate && t.documentDate <= `${s.year}-12-31`,
    ).length,
  training_hours: (ctx, s) =>
    (ctx.index.trainingByTeacher.get(s.teacherId) ?? [])
      .filter((t) => t.documentDate && t.documentDate <= `${s.year}-12-31`)
      .reduce((a, t) => a + (t.hours ?? 0), 0),
};

export function mockAnalyticsRepository(ctx: MockContext): AnalyticsRepository {
  return {
    getComposition: (f) => ctx.respond(() => composition(ctx, f.year, ctx.snapshots(f.year, f))),
    getTraining: (f) => ctx.respond(() => trainingSummary(ctx, f.year, ctx.snapshots(f.year, f))),
    getDynamics: (f, subject) =>
      ctx.respond<DynamicsSummary>(() => {
        const years = ctx.index.ds.years;
        return {
          years,
          subject,
          kpis: years.map((y) => yearKpi(ctx, y, f)),
          ageStructure: years.map((y) => {
            const snaps = ctx.snapshots(y, f);
            const counts = countBy(snaps, (s) => ageGroupOf(s.age), AGE_GROUPS);
            const total = snaps.length || 1;
            return {
              year: y,
              shares: Object.fromEntries(
                counts.map((c) => [c.group, Math.round((c.value / total) * 1000) / 10]),
              ),
            };
          }),
          experienceStructure: years.map((y) => ({
            year: y,
            counts: Object.fromEntries(
              countBy(
                ctx.snapshots(y, f),
                (s) => experienceGroupOf(s.pedagogicalExperienceYears),
                EXPERIENCE_GROUPS,
              ).map((c) => [c.group, c.value]),
            ),
          })),
          categoryStructure: years.map((y) => ({
            year: y,
            counts: Object.fromEntries(
              countBy(ctx.snapshots(y, f), categoryOf, CATEGORY_ORDER).map((c) => [
                c.group,
                c.value,
              ]),
            ),
          })),
          subjectTrend: subject
            ? years.map((y) => ({
                year: y,
                value: ctx
                  .snapshots(y, f)
                  .filter((s) => s.assignments.some((a) => a.subject === subject)).length,
              }))
            : [],
        };
      }),
    getMobilityOverview: (f) =>
      ctx.respond<MobilityOverview>(() => {
        const { period, rows } = outcomesWithFeatures(ctx, f);
        const groups = period
          ? [
              ...mobilityByGroup(rows, (r) => `Возраст ${ageGroupOf(r.snap.age)}`),
              ...mobilityByGroup(
                rows,
                (r) => `Стаж ${experienceGroupOf(r.snap.pedagogicalExperienceYears)}`,
              ),
              ...mobilityByGroup(rows, (r) => `Категория: ${categoryOf(r.snap)}`),
            ]
              .filter((g) => !g.suppressed)
              .sort((a, b) => b.shares.leave - a.shares.leave)
              .slice(0, 6)
          : [];
        return {
          period,
          distribution: period ? distributionOf(ctx.outcomes(period, f), period) : null,
          trend: ctx.index.ds.periods.map((p) => distributionOf(ctx.outcomes(p, f), p)),
          elevatedGroups: groups,
        };
      }),
    getMobilityBreakdown: (f, dim) =>
      ctx.respond(() => {
        if (dim === "district") ctx.require("system:view");
        const { period, rows } = outcomesWithFeatures(ctx, f);
        if (!period) return [];
        const { key, order } = dimensionKey(ctx, dim);
        return mobilityByGroup(rows, (r) => key(r.snap), order);
      }),
    getScatter: (f, x, y, limit) =>
      ctx.respond<ScatterPoint[]>(() => {
        const { period, rows } = outcomesWithFeatures(ctx, f);
        const base = period
          ? rows
          : ctx
              .snapshots(f.year, f)
              .map((snap) => ({ snap, status: null as MobilityClass | null }));
        const step = Math.max(1, Math.ceil(base.length / limit));
        const pts: ScatterPoint[] = [];
        for (let i = 0; i < base.length; i += step) {
          const xv = METRIC_VALUE[x](ctx, base[i].snap);
          const yv = METRIC_VALUE[y](ctx, base[i].snap);
          if (xv == null || yv == null) continue;
          pts.push({ x: xv, y: yv, status: base[i].status });
        }
        return pts;
      }),
    getHeatmap: (f) =>
      ctx.respond<HeatmapDto>(() => {
        const { period, rows } = outcomesWithFeatures(ctx, f);
        const rowsK = [...EXPERIENCE_GROUPS];
        const colsK = [...AGE_GROUPS];
        const cells = rowsK.map((r) =>
          colsK.map((c) => {
            const set = rows.filter(
              (x) =>
                experienceGroupOf(x.snap.pedagogicalExperienceYears) === r &&
                ageGroupOf(x.snap.age) === c,
            );
            if (set.length < MIN_GROUP_SIZE) return null;
            return Math.round((set.filter((x) => x.status === 2).length / set.length) * 1000) / 10;
          }),
        );
        return {
          period,
          rows: rowsK,
          cols: colsK,
          cells,
          minGroupSize: MIN_GROUP_SIZE,
        };
      }),
  };
}

export function mockCatalogRepository(ctx: MockContext): DataCatalogRepository {
  return {
    get: () =>
      ctx.respond<DataCatalog>(() => {
        ctx.require("data:catalog");
        const ds = ctx.index.ds;
        const r = ds.report;
        return {
          isMock: true,
          datasetVersion: MOCK_DATASET_VERSION,
          updatedAt: MOCK_UPDATED_AT,
          period: { from: ds.years[0], to: ds.years[ds.years.length - 1] },
          sources: [
            {
              key: "teachers",
              title: "Учителя",
              description:
                "Строка = педагог × предмет × параллель; нормализуется в срез педагог-год",
              sourceFieldCount: 16,
              rawRowCount: r.rawRowCounts.teachers,
              normalizedRecordCount: ds.teacherSnapshots.length,
              status: "mock",
            },
            {
              key: "education",
              title: "Образование",
              description: "Несколько записей на педагога; дубли накопительного итога схлопываются",
              sourceFieldCount: 6,
              rawRowCount: r.rawRowCounts.education,
              normalizedRecordCount: ds.education.length,
              status: "mock",
            },
            {
              key: "training",
              title: "Повышение квалификации",
              description: "Программы ПК и ПП с часами и датой документа",
              sourceFieldCount: 6,
              rawRowCount: r.rawRowCounts.training,
              normalizedRecordCount: ds.training.length,
              status: "mock",
            },
            {
              key: "schools",
              title: "Школы",
              description: "Название, округ, число зданий, численность контингента",
              sourceFieldCount: 4,
              rawRowCount: r.rawRowCounts.schools,
              normalizedRecordCount: ds.schoolSnapshots.length,
              status: "mock",
            },
          ],
          quality: {
            exactDuplicatesRemoved: Object.values(r.exactDuplicatesRemoved).reduce(
              (a, b) => a + b,
              0,
            ),
            cumulativeEducationCollapsed: r.cumulativeEducationCollapsed,
            conflictingTeacherYears: r.conflictingTeacherYears,
            multiSchoolTeacherYears: r.multiSchoolTeacherYears,
            unknownSchoolRows: r.unknownSchoolRows,
            missingValues: Object.entries(r.missingValues).map(([field, count]) => ({
              field,
              count,
            })),
          },
        };
      }),
  };
}
