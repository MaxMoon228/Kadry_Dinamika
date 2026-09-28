import type { Year } from "../../domain/common";
import type { TeacherEducation } from "../../domain/education";
import type { MobilityOutcome, MobilityPeriod } from "../../domain/mobility";
import type { School, SchoolYearSnapshot } from "../../domain/school";
import type { TeacherYearSnapshot } from "../../domain/teacher";
import type { TeacherTraining } from "../../domain/training";

/** Отчёт ETL-нормализации — основа для страницы «Данные и модель» и data validation. */

export interface NormalizationReport {
  rawRowCounts: {
    teachers: number;
    education: number;
    training: number;
    schools: number;
  };
  exactDuplicatesRemoved: {
    teachers: number;
    education: number;
    training: number;
    schools: number;
  };
  /** Записи «Образование», повторённые накопительным итогом в следующих годах. */
  cumulativeEducationCollapsed: number;
  /** Пары (педагог, год), у которых скалярные поля противоречат друг другу в разных строках. */
  conflictingTeacherYears: number;
  /** Пары (педагог, год) с несколькими школами (совместительство). */
  multiSchoolTeacherYears: number;
  /** Строки учителей со школой, отсутствующей в таблице «Школы». */
  unknownSchoolRows: number;
  missingValues: Record<string, number>;
  unknownCategoryValues: string[];
}

/** Нормализованный датасет: результат ETL, из которого строятся все витрины. */

export interface NormalizedDataset {
  years: Year[];
  periods: MobilityPeriod[];
  schools: School[];
  schoolSnapshots: SchoolYearSnapshot[];
  teacherSnapshots: TeacherYearSnapshot[];
  education: TeacherEducation[];
  training: TeacherTraining[];
  outcomes: MobilityOutcome[];
  report: NormalizationReport;
}
