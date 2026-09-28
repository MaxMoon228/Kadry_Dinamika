import type { SchoolId, Year } from "./common";

/**
 * Школа. В источнике естественный ключ — «Название школы, её номер и юридический статус»;
 * `id` — суррогатный ключ, присваиваемый ETL по нормализованному названию.
 */

export interface School {
  id: SchoolId;
  name: string;
  district: string;
}

/** Срез школы за год. teacherCount — derived: число уникальных педагогов школы в срезе. */

export interface SchoolYearSnapshot {
  schoolId: SchoolId;
  year: Year;
  buildingCount: number | null;
  studentCount: number | null;
  teacherCount: number;
}
