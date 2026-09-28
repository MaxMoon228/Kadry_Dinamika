import type { IsoDate, SchoolId, TeacherId, Year } from "./common";

export type Gender = "female" | "male";

/** Пара «предмет × параллель». В источнике каждая пара — отдельная строка таблицы «Учителя». */

export interface TeachingAssignment {
  subject: string;
  /** Параллель, например "5". */
  parallel: string | null;
}

/**
 * Нормализованный срез педагога за год (teacher-year snapshot).
 * Одна запись на пару (teacherId, year): строки источника «предмет × параллель»
 * схлопываются в `assignments`.
 */

export interface TeacherYearSnapshot {
  teacherId: TeacherId;
  year: Year;
  schoolId: SchoolId;
  mainPosition: string | null;
  activityDirection: string | null;
  gender: Gender | null;
  age: number | null;
  academicDegree: string | null;
  qualificationCategory: string | null;
  qualificationAssignedAt: IsoDate | null;
  qualificationValidUntil: IsoDate | null;
  totalExperienceYears: number | null;
  pedagogicalExperienceYears: number | null;
  assignments: TeachingAssignment[];
  /** Направление предпрофессионального класса; null — не преподаёт в предпроф. классах. */
  preprofessionalDirection: string | null;
  isClassTeacher: boolean | null;
}

/** Стабильная идентичность педагога — только обезличенный ID. ФИО в системе не хранится. */

export interface Teacher {
  id: TeacherId;
}

export const NO_CATEGORY = "Без категории";

export function subjectsOf(s: TeacherYearSnapshot): string[] {
  return Array.from(new Set(s.assignments.map((a) => a.subject)));
}

export function parallelsOf(s: TeacherYearSnapshot): string[] {
  return Array.from(
    new Set(s.assignments.map((a) => a.parallel).filter((p): p is string => p != null)),
  );
}

export const GENDER_LABEL: Record<Gender, string> = {
  female: "Женский",
  male: "Мужской",
};
