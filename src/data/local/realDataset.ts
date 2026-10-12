/**
 * Реальный датасет ДОНМ 2022–2024 (локальный режим). Файл собирает
 * scripts/real-data/build_real_dataset.py по пайплайну ноутбука «Неделя 4_ДЗ_Рачайочечки»
 * и хранит в компактном колоночном формате со словарём строк. Здесь он декодируется
 * в NormalizedDataset — тот же контракт, что и у mock-источника.
 */

import type { SchoolId, Year } from "../../domain/common";
import type { TeacherEducation } from "../../domain/education";
import type { TeacherYearFeatures } from "../../domain/features";
import type { MobilityClass, MobilityOutcome, MobilityPeriod } from "../../domain/mobility";
import type { School, SchoolYearSnapshot } from "../../domain/school";
import type { TeacherYearSnapshot, TeachingAssignment } from "../../domain/teacher";
import type { TeacherTraining } from "../../domain/training";
import type { NormalizationReport, NormalizedDataset } from "../contracts/normalized";

export const REAL_DATASET_FORMAT = "kd-real-dataset@1";

type Col = number[];

export interface RealDatasetFile {
  format: string;
  version: string;
  generatedAt: string;
  source: string;
  years: Year[];
  strings: string[];
  teachers: string[];
  /** [номер школы, округ (индекс строки), зданий, контингент]. */
  schools: [number, number, number, number][];
  snapshots: {
    t: Col;
    y: Col;
    s: Col;
    pos: Col;
    dir: Col;
    sex: Col;
    age: Col;
    deg: Col;
    cat: Col;
    catFrom: Col;
    catTo: Col;
    expAll: Col;
    expPed: Col;
    cls: Col;
    /** Пары «предмет × параллель»: индекс строки × 16 + параллель (15 — нет параллели). */
    asg: number[][];
    posCat: Col;
    degCat: Col;
    catCat: Col;
    catActive: Col;
    expOther: Col;
    nSubj: Col;
    minPar: Col;
    maxPar: Col;
    nPar: Col;
    exam: Col;
    subjGroup: Col;
    pedEdu: Col;
    highEdu: Col;
    nCourses: Col;
    hours: Col;
    nGia: Col;
    hasPP: Col;
    target: Col;
    /** Статус в кодировке сайта (0/1/2), −1 — исход неизвестен. */
    status: Col;
    toSchool: Col;
  };
  education: { t: Col; type: Col; org: Col; date: Col; spec: Col; qual: Col; first: Col };
  training: { t: Col; name: Col; pp: Col; hours: Col; year: Col; gia: Col };
  report: NormalizationReport & Record<string, unknown>;
}

export function realSchoolId(num: number): SchoolId {
  return `sch-${num}`;
}

export function decodeRealDataset(file: RealDatasetFile): NormalizedDataset {
  if (file.format !== REAL_DATASET_FORMAT)
    throw new Error(`Неизвестный формат датасета: ${file.format}`);
  const str = (i: number): string | null => (i >= 0 ? (file.strings[i] ?? null) : null);
  const num = (v: number): number | null => (v >= 0 ? v : null);
  const signed = (v: number | undefined): number | null => (v == null ? null : v);
  const yearDate = (y: number) => (y > 0 ? `${y}-01-01` : null);

  const schools: School[] = file.schools
    .map(([n, d]) => ({ id: realSchoolId(n), name: `Школа № ${n}`, district: str(d) ?? "Не указан" }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }));
  const schoolInfo = new Map(file.schools.map((s) => [realSchoolId(s[0]), s]));

  const sn = file.snapshots;
  const snapshots: TeacherYearSnapshot[] = [];
  const features: TeacherYearFeatures[] = [];
  const outcomes: MobilityOutcome[] = [];
  const teacherCount = new Map<string, number>();
  for (let i = 0; i < sn.t.length; i++) {
    const teacherId = file.teachers[sn.t[i]];
    const year = sn.y[i];
    const schoolId = realSchoolId(sn.s[i]);
    const assignments: TeachingAssignment[] = sn.asg[i].map((code) => {
      const par = code % 16;
      return { subject: str(Math.floor(code / 16)) ?? "—", parallel: par === 15 ? null : String(par) };
    });
    snapshots.push({
      teacherId,
      year,
      schoolId,
      mainPosition: str(sn.pos[i]),
      activityDirection: str(sn.dir[i]),
      gender: sn.sex[i] === 1 ? "male" : sn.sex[i] === 0 ? "female" : null,
      age: num(sn.age[i]),
      academicDegree: str(sn.deg[i]),
      qualificationCategory: str(sn.cat[i]),
      qualificationAssignedAt: yearDate(sn.catFrom[i]),
      qualificationValidUntil: yearDate(sn.catTo[i]),
      totalExperienceYears: num(sn.expAll[i]),
      pedagogicalExperienceYears: num(sn.expPed[i]),
      assignments,
      preprofessionalDirection: null,
      isClassTeacher: sn.cls[i] === 1 ? true : sn.cls[i] === 0 ? false : null,
    });
    features.push({
      teacherId,
      year,
      main_position_cat: str(sn.posCat[i]),
      academic_degree_cat: str(sn.degCat[i]),
      category_qual_cat: str(sn.catCat[i]),
      category_active: str(sn.catActive[i]),
      experience_age_other: signed(sn.expOther[i]),
      n_unique_subjects: num(sn.nSubj[i]),
      min_parallel: num(sn.minPar[i]),
      max_parallel: num(sn.maxPar[i]),
      n_unique_parallel: num(sn.nPar[i]),
      is_exam_subject: num(sn.exam[i]),
      main_subject_group: str(sn.subjGroup[i]),
      is_ped_education: num(sn.pedEdu[i]),
      high_type_education: str(sn.highEdu[i]),
      n_courses: num(sn.nCourses[i]),
      hours_courses: num(sn.hours[i]),
      n_gia_courses: num(sn.nGia[i]),
      has_pp: num(sn.hasPP[i]),
      target: num(sn.target[i]),
    });
    const status = sn.status[i];
    if (status >= 0) {
      outcomes.push({
        teacherId,
        period: { fromYear: year, toYear: year + 1 },
        status: status as MobilityClass,
        fromSchoolId: schoolId,
        toSchoolId: status === 2 || sn.toSchool[i] < 0 ? null : realSchoolId(sn.toSchool[i]),
      });
    }
    const k = `${schoolId}|${year}`;
    teacherCount.set(k, (teacherCount.get(k) ?? 0) + 1);
  }

  const years = [...file.years].sort((a, b) => a - b);
  const periods: MobilityPeriod[] = [];
  for (let i = 0; i + 1 < years.length; i++)
    if (years[i + 1] === years[i] + 1) periods.push({ fromYear: years[i], toYear: years[i + 1] });
  // Периоды без единого известного исхода (последний год) не публикуются.
  const observed = periods.filter((p) => outcomes.some((o) => o.period.fromYear === p.fromYear));
  // Один объект периода на fromYear — как в buildOutcomes.
  const periodByFrom = new Map(observed.map((p) => [p.fromYear, p]));
  for (const o of outcomes) o.period = periodByFrom.get(o.period.fromYear) ?? o.period;

  const schoolSnapshots: SchoolYearSnapshot[] = [];
  for (const school of schools) {
    const info = schoolInfo.get(school.id)!;
    for (const y of years)
      schoolSnapshots.push({
        schoolId: school.id,
        year: y,
        buildingCount: num(info[2]),
        studentCount: num(info[3]),
        teacherCount: teacherCount.get(`${school.id}|${y}`) ?? 0,
      });
  }

  const ed = file.education;
  const education: TeacherEducation[] = ed.t.map((t, i) => ({
    teacherId: file.teachers[t],
    educationType: str(ed.type[i]) ?? "—",
    institution: str(ed.org[i]),
    graduationDate: yearDate(ed.date[i]),
    specialization: str(ed.spec[i]),
    qualification: str(ed.qual[i]),
    firstSeenYear: ed.first[i],
  }));

  const tr = file.training;
  const training: TeacherTraining[] = tr.t.map((t, i) => ({
    teacherId: file.teachers[t],
    programName: str(tr.name[i]) ?? "—",
    programType: tr.pp[i] === 1 ? "ПП" : "ПК",
    provider: null,
    hours: num(tr.hours[i]),
    documentDate: yearDate(tr.year[i]),
  }));

  return {
    years,
    periods: observed,
    schools,
    schoolSnapshots,
    teacherSnapshots: snapshots,
    education,
    training,
    outcomes,
    report: file.report,
    features,
    meta: {
      version: file.version,
      updatedAt: file.generatedAt,
      isMock: false,
      origin: file.source,
      unavailableFields: ["preprofessional", "trainingProvider"],
    },
  };
}

export function localDatasetUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}data/real-dataset.json`;
}

export async function fetchRealDataset(url = localDatasetUrl()): Promise<NormalizedDataset> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      res.status === 404
        ? "Файл public/data/real-dataset.json не найден. Соберите его: python scripts/real-data/build_real_dataset.py"
        : `Не удалось загрузить датасет (HTTP ${res.status})`,
    );
  return decodeRealDataset((await res.json()) as RealDatasetFile);
}
