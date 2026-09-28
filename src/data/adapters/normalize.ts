/**
 * Эталонная реализация правил ETL «raw → normalized» (docs/DATA_INTEGRATION_PLAN.md).
 * В production те же правила реализуются в backend-пайплайне (Python), а frontend получает
 * уже агрегированные DTO. Здесь код используется mock-источником и тестами, чтобы правила
 * были исполняемыми и проверяемыми.
 */

import type { IsoDate, SchoolId, Year } from "../../domain/common";
import type { TeacherEducation } from "../../domain/education";
import type { MobilityClass, MobilityOutcome, MobilityPeriod } from "../../domain/mobility";
import type { School, SchoolYearSnapshot } from "../../domain/school";
import type { Gender, TeacherYearSnapshot, TeachingAssignment } from "../../domain/teacher";
import type { TeacherTraining, TrainingProgramType } from "../../domain/training";
import type { NormalizationReport, NormalizedDataset } from "../contracts/normalized";
import type { RawDataset, RawTeacherRow } from "../contracts/raw";

// ------------------------------------------------------------------ primitives

export function cleanText(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).replace(/\s+/g, " ").trim();
  if (t === "" || t === "—" || t === "-" || t.toLowerCase() === "nan" || t.toLowerCase() === "null")
    return null;
  return t;
}

export function parseNumber(v: string | null | undefined): number | null {
  const t = cleanText(v);
  if (t == null) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseDate(v: string | null | undefined): IsoDate | null {
  const t = cleanText(v);
  if (t == null) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})$/.exec(t);
  if (m) return `${m[1]}-01-01`;
  return null;
}

export function parseGender(v: string | null | undefined): Gender | null {
  const t = cleanText(v)?.toLowerCase();
  if (!t) return null;
  if (t.startsWith("ж") || t === "f" || t === "female") return "female";
  if (t.startsWith("м") || t === "m" || t === "male") return "male";
  return null;
}

export function parseYesNo(v: string | null | undefined): boolean | null {
  const t = cleanText(v)?.toLowerCase();
  if (!t) return null;
  if (["да", "yes", "1", "true"].includes(t)) return true;
  if (["нет", "no", "0", "false"].includes(t)) return false;
  return null;
}

const CATEGORY_CANONICAL: [RegExp, string][] = [
  [/^высш/i, "Высшая"],
  [/^перв/i, "Первая"],
  [/^втор/i, "Вторая"],
];

export function normalizeCategory(v: string | null | undefined): {
  value: string | null;
  unknown: string | null;
} {
  const t = cleanText(v);
  if (t == null || /^без/i.test(t)) return { value: null, unknown: null };
  for (const [re, canon] of CATEGORY_CANONICAL)
    if (re.test(t)) return { value: canon, unknown: null };
  return { value: t, unknown: t };
}

export function normalizePreprofessional(v: string | null | undefined): string | null {
  const t = cleanText(v);
  if (t == null) return null;
  if (parseYesNo(t) === false) return null;
  return t;
}

export function normalizeProgramType(v: string | null | undefined): TrainingProgramType | null {
  const t = cleanText(v)?.toUpperCase();
  if (t === "ПК") return "ПК";
  if (t === "ПП") return "ПП";
  return null;
}

/** Нормализованный естественный ключ школы (название + номер + юр. статус). */

export function schoolNaturalKey(name: string): string {
  return name
    .replace(/[«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Детерминированный суррогатный ключ школы (FNV-1a от естественного ключа). */

export function schoolIdFromName(name: string): SchoolId {
  const key = schoolNaturalKey(name);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `sch-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

function mode<T>(values: (T | null)[]): { value: T | null; conflict: boolean } {
  const counts = new Map<T, number>();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (counts.size === 0) return { value: null, conflict: false };
  let best: T | null = null;
  let bestN = -1;
  for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
  return { value: best, conflict: counts.size > 1 };
}

function dedupeExact<T>(rows: T[]): { rows: T[]; removed: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return { rows: out, removed: rows.length - out.length };
}

// ------------------------------------------------------------------ target

/**
 * Построение целевой переменной для периода (y → y+1):
 * 0 — педагог есть в срезе y+1 в той же школе; 1 — есть в срезе y+1 в другой школе;
 * 2 — отсутствует в срезе y+1 (ушёл из наблюдаемой системы образования).
 */

export function buildOutcomes(
  snapshots: TeacherYearSnapshot[],
  years: Year[],
): { outcomes: MobilityOutcome[]; periods: MobilityPeriod[] } {
  const sorted = [...years].sort((a, b) => a - b);
  const byYear = new Map<Year, Map<string, TeacherYearSnapshot>>();
  for (const s of snapshots) {
    if (!byYear.has(s.year)) byYear.set(s.year, new Map());
    byYear.get(s.year)!.set(s.teacherId, s);
  }
  const outcomes: MobilityOutcome[] = [];
  const periods: MobilityPeriod[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (to !== from + 1) continue;
    const period = { fromYear: from, toYear: to };
    periods.push(period);
    const next = byYear.get(to) ?? new Map();
    for (const s of byYear.get(from)?.values() ?? []) {
      const n = next.get(s.teacherId);
      const status: MobilityClass = !n ? 2 : n.schoolId === s.schoolId ? 0 : 1;
      outcomes.push({
        teacherId: s.teacherId,
        period,
        status,
        fromSchoolId: s.schoolId,
        toSchoolId: n ? n.schoolId : null,
      });
    }
  }
  return { outcomes, periods };
}

// ------------------------------------------------------------------ main

export function normalizeDataset(raw: RawDataset): NormalizedDataset {
  const missing: Record<string, number> = {};
  const countMissing = (field: string, v: unknown) => {
    if (v == null) missing[field] = (missing[field] ?? 0) + 1;
  };
  const unknownCategories = new Set<string>();
  const t = dedupeExact(raw.teachers);
  const e = dedupeExact(raw.education);
  const tr = dedupeExact(raw.training);
  const sc = dedupeExact(raw.schools);

  // --- schools
  const schools = new Map<SchoolId, School>();
  const schoolYear = new Map<
    string,
    {
      schoolId: SchoolId;
      year: Year;
      buildingCount: number | null;
      studentCount: number | null;
    }
  >();
  for (const r of sc.rows) {
    const name = cleanText(r.Школа);
    const year = parseNumber(r.Год);
    if (!name || year == null) continue;
    const id = schoolIdFromName(name);
    const district = cleanText(r.Округ);
    countMissing("Школы.Округ", district);
    const prev = schools.get(id);
    schools.set(id, {
      id,
      name,
      district: district ?? prev?.district ?? "Не указан",
    });
    schoolYear.set(`${id}|${year}`, {
      schoolId: id,
      year,
      buildingCount: parseNumber(r["Количество зданий"]),
      studentCount: parseNumber(r["Общая численность контингента"]),
    });
  }

  // --- teachers: group rows by (teacher, year)
  const groups = new Map<string, RawTeacherRow[]>();
  for (const r of t.rows) {
    const id = cleanText(r.Идентификатор);
    const year = parseNumber(r.Год);
    if (!id || year == null) continue;
    const k = `${id}|${year}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  let conflicting = 0;
  let multiSchool = 0;
  let unknownSchoolRows = 0;
  const snapshots: TeacherYearSnapshot[] = [];
  for (const [k, rows] of groups) {
    const [teacherId, yearStr] = k.split("|");
    const year = Number(yearStr);
    const schoolCounts = new Map<SchoolId, number>();
    for (const r of rows) {
      const name = cleanText(r["Краткое наименование образовательной организации"]);
      if (!name) continue;
      const id = schoolIdFromName(name);
      if (!schools.has(id)) {
        unknownSchoolRows++;
        schools.set(id, { id, name, district: "Не указан" });
      }
      schoolCounts.set(id, (schoolCounts.get(id) ?? 0) + 1);
    }
    if (schoolCounts.size === 0) continue;
    const orderedSchools = [...schoolCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    if (orderedSchools.length > 1) multiSchool++;
    const schoolId = orderedSchools[0][0];
    let conflict = false;
    const pick = <T>(fn: (r: RawTeacherRow) => T | null): T | null => {
      const m = mode(rows.map(fn));
      if (m.conflict) conflict = true;
      return m.value;
    };
    const category = pick((r) => {
      const c = normalizeCategory(r["Квалификационная категория"]);
      if (c.unknown) unknownCategories.add(c.unknown);
      return c.value;
    });
    const assignments: TeachingAssignment[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const subject = cleanText(r.Предмет);
      if (!subject) continue;
      const parallel = cleanText(r.Параллель);
      const key = `${subject}|${parallel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      assignments.push({ subject, parallel });
    }
    const snap: TeacherYearSnapshot = {
      teacherId,
      year,
      schoolId,
      mainPosition: pick((r) => cleanText(r["Основная должность"])),
      activityDirection: pick((r) => cleanText(r["Направление деятельности"])),
      gender: pick((r) => parseGender(r.Пол)),
      age: pick((r) => parseNumber(r.Возраст)),
      academicDegree: pick((r) => cleanText(r["Учёная степень"])),
      qualificationCategory: category,
      qualificationAssignedAt: pick((r) =>
        parseDate(r["Дата присвоения квалификационной категории"]),
      ),
      qualificationValidUntil: pick((r) =>
        parseDate(r["Срок действия квалификационной категории"]),
      ),
      totalExperienceYears: pick((r) => parseNumber(r["Общий стаж работы"])),
      pedagogicalExperienceYears: pick((r) => parseNumber(r["Стаж педагогической работы"])),
      assignments,
      preprofessionalDirection: pick((r) =>
        normalizePreprofessional(r["Преподаёт в предпрофессиональных классах"]),
      ),
      isClassTeacher: pick((r) => parseYesNo(r["Имеет классное руководство"])),
    };
    if (conflict) conflicting++;
    countMissing("Учителя.Возраст", snap.age);
    countMissing("Учителя.Пол", snap.gender);
    countMissing("Учителя.Стаж педагогической работы", snap.pedagogicalExperienceYears);
    countMissing("Учителя.Общий стаж работы", snap.totalExperienceYears);
    snapshots.push(snap);
  }
  const years = Array.from(new Set(snapshots.map((s) => s.year))).sort((a, b) => a - b);

  // --- school snapshots (teacherCount — derived)
  const teacherCount = new Map<string, number>();
  for (const s of snapshots)
    teacherCount.set(
      `${s.schoolId}|${s.year}`,
      (teacherCount.get(`${s.schoolId}|${s.year}`) ?? 0) + 1,
    );
  const schoolSnapshots: SchoolYearSnapshot[] = [];
  for (const school of schools.values()) {
    for (const y of years) {
      const src = schoolYear.get(`${school.id}|${y}`);
      const tc = teacherCount.get(`${school.id}|${y}`) ?? 0;
      if (!src && tc === 0) continue;
      schoolSnapshots.push({
        schoolId: school.id,
        year: y,
        buildingCount: src?.buildingCount ?? null,
        studentCount: src?.studentCount ?? null,
        teacherCount: tc,
      });
    }
  }

  // --- education: collapse cumulative duplicates, keep first year seen
  const edu = new Map<string, TeacherEducation>();
  let cumulative = 0;
  for (const r of e.rows) {
    const teacherId = cleanText(r.Идентификатор);
    const year = parseNumber(r.Год);
    const educationType = cleanText(r["Тип образования"]);
    if (!teacherId || year == null || !educationType) continue;
    const rec: Omit<TeacherEducation, "firstSeenYear"> = {
      teacherId,
      educationType,
      institution: cleanText(r["Наименование учебного заведения"]),
      graduationDate: parseDate(r["Дата окончания"]),
      specialization: cleanText(r.Специализация),
      qualification: cleanText(r.Квалификация),
    };
    const key = JSON.stringify(rec);
    const prev = edu.get(key);
    if (prev) {
      cumulative++;
      prev.firstSeenYear = Math.min(prev.firstSeenYear, year);
    } else edu.set(key, { ...rec, firstSeenYear: year });
  }

  // --- training
  const training: TeacherTraining[] = [];
  const trSeen = new Set<string>();
  for (const r of tr.rows) {
    const teacherId = cleanText(r.Идентификатор);
    const programType = normalizeProgramType(
      r["Программа профессиональной переподготовки (ПП) или программа повышения квалификации (ПК)"],
    );
    const programName = cleanText(r["Наименование программы"]);
    if (!teacherId || !programType || !programName) continue;
    const rec: TeacherTraining = {
      teacherId,
      programName,
      programType,
      provider: cleanText(r["Организатор программы"]),
      hours: parseNumber(r["Количество часов"]),
      documentDate: parseDate(r["Дата получения документа"]),
    };
    const key = JSON.stringify(rec);
    if (trSeen.has(key)) continue;
    trSeen.add(key);
    training.push(rec);
  }
  const { outcomes, periods } = buildOutcomes(snapshots, years);
  const report: NormalizationReport = {
    rawRowCounts: {
      teachers: raw.teachers.length,
      education: raw.education.length,
      training: raw.training.length,
      schools: raw.schools.length,
    },
    exactDuplicatesRemoved: {
      teachers: t.removed,
      education: e.removed,
      training: tr.removed,
      schools: sc.removed,
    },
    cumulativeEducationCollapsed: cumulative,
    conflictingTeacherYears: conflicting,
    multiSchoolTeacherYears: multiSchool,
    unknownSchoolRows,
    missingValues: missing,
    unknownCategoryValues: [...unknownCategories],
  };
  return {
    years,
    periods,
    schools: [...schools.values()].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    schoolSnapshots,
    teacherSnapshots: snapshots,
    education: [...edu.values()],
    training,
    outcomes,
    report,
  };
}
