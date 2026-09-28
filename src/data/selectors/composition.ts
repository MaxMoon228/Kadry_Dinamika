import type { CountByGroup, IsoDate, Year } from "../../domain/common";
import type { TeacherEducation } from "../../domain/education";
import { NO_CATEGORY, subjectsOf, type TeacherYearSnapshot } from "../../domain/teacher";
import type { TeacherTraining } from "../../domain/training";

export const AGE_GROUPS = ["до 30", "30–39", "40–49", "50–59", "60+"] as const;

export const EXPERIENCE_GROUPS = [
  "до 3 лет",
  "3–9 лет",
  "10–19 лет",
  "20–29 лет",
  "30+ лет",
] as const;

export const UNKNOWN = "Не указано";

export function ageGroupOf(age: number | null): string {
  if (age == null) return UNKNOWN;
  return age < 30 ? "до 30" : age < 40 ? "30–39" : age < 50 ? "40–49" : age < 60 ? "50–59" : "60+";
}

export function experienceGroupOf(years: number | null): string {
  if (years == null) return UNKNOWN;
  return years < 3
    ? "до 3 лет"
    : years < 10
      ? "3–9 лет"
      : years < 20
        ? "10–19 лет"
        : years < 30
          ? "20–29 лет"
          : "30+ лет";
}

export function categoryOf(s: TeacherYearSnapshot): string {
  return s.qualificationCategory ?? NO_CATEGORY;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  if (v.length === 0) return null;
  return round1(v.reduce((a, b) => a + b, 0) / v.length);
}

/** Доля (0–100, один знак) элементов, удовлетворяющих предикату, среди элементов с известным значением. */

export function shareOf<T>(items: T[], predicate: (t: T) => boolean | null): number | null {
  let known = 0;
  let hit = 0;
  for (const it of items) {
    const r = predicate(it);
    if (r == null) continue;
    known++;
    if (r) hit++;
  }
  return known === 0 ? null : round1((hit / known) * 100);
}

export function countBy<T>(
  items: T[],
  keyFn: (t: T) => string | string[],
  order?: readonly string[],
): CountByGroup[] {
  const map = new Map<string, number>();
  if (order) for (const g of order) map.set(g, 0);
  for (const it of items) {
    const k = keyFn(it);
    for (const key of Array.isArray(k) ? k : [k]) map.set(key, (map.get(key) ?? 0) + 1);
  }
  const rows = [...map.entries()].map(([group, value]) => ({ group, value }));
  if (!order) rows.sort((a, b) => b.value - a.value);
  else {
    // «Не указано» и прочие значения вне справочника — в конец, только если они есть
    return rows.filter((r) => order.includes(r.group) || r.value > 0);
  }
  return rows;
}

/** Предметы педагога; педагог с несколькими предметами учитывается в каждом из них. */

export function subjectKeys(s: TeacherYearSnapshot): string[] {
  const subj = subjectsOf(s);
  return subj.length ? subj : [UNKNOWN];
}

export function studentsPerTeacher(students: number | null, teachers: number): number | null {
  if (students == null || teachers === 0) return null;
  return round1(students / teachers);
}

// ----------------------------------------------------------------- derived teacher features

function yearOf(d: IsoDate | null): number | null {
  return d ? Number(d.slice(0, 4)) : null;
}

/** Дата среза: признаки на конец учебного года среза (допущение, уточняется на реальных данных). */

export function snapshotCutoff(year: Year): IsoDate {
  return `${year}-12-31`;
}

export interface DerivedTeacherFeatures {
  trainingCount: number;
  trainingHoursTotal: number;
  trainingHoursRecent3y: number;
  hasProfessionalRetraining: boolean;
  yearsSinceLastTraining: number | null;
  yearsSinceQualification: number | null;
  subjectCount: number;
  parallelCount: number;
  educationRecordCount: number;
  hasHigherEducation: boolean;
  yearsSinceGraduation: number | null;
}

/**
 * Производные признаки на дату среза. Используются только записи с датой ≤ даты среза
 * (защита от утечки будущего).
 */

export function deriveTeacherFeatures(
  s: TeacherYearSnapshot,
  trainings: TeacherTraining[],
  education: TeacherEducation[],
): DerivedTeacherFeatures {
  const cutoff = snapshotCutoff(s.year);
  const known = trainings.filter((t) => t.documentDate != null && t.documentDate <= cutoff);
  const lastYear = known.reduce<number | null>((a, t) => {
    const y = yearOf(t.documentDate);
    return y == null ? a : a == null ? y : Math.max(a, y);
  }, null);
  const edu = education.filter((e) => e.firstSeenYear <= s.year);
  const lastGrad = edu.reduce<number | null>((a, e) => {
    const y = yearOf(e.graduationDate);
    return y == null ? a : a == null ? y : Math.max(a, y);
  }, null);
  const qy = yearOf(s.qualificationAssignedAt);
  return {
    trainingCount: known.length,
    trainingHoursTotal: known.reduce((a, t) => a + (t.hours ?? 0), 0),
    trainingHoursRecent3y: known
      .filter((t) => (yearOf(t.documentDate) ?? 0) > s.year - 3)
      .reduce((a, t) => a + (t.hours ?? 0), 0),
    hasProfessionalRetraining: known.some((t) => t.programType === "ПП"),
    yearsSinceLastTraining: lastYear == null ? null : s.year - lastYear,
    yearsSinceQualification: qy == null ? null : s.year - qy,
    subjectCount: new Set(s.assignments.map((a) => a.subject)).size,
    parallelCount: new Set(s.assignments.map((a) => a.parallel).filter(Boolean)).size,
    educationRecordCount: edu.length,
    hasHigherEducation: edu.some((e) => /высш/i.test(e.educationType)),
    yearsSinceGraduation: lastGrad == null ? null : s.year - lastGrad,
  };
}
