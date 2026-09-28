import type { IsoDate, TeacherId, Year } from "./common";

/**
 * Запись об образовании педагога. У педагога может быть несколько записей.
 * В источнике записи дублируются накопительным итогом по годам — ETL дедуплицирует их,
 * сохраняя год первого появления (firstSeenYear).
 */

export interface TeacherEducation {
  teacherId: TeacherId;
  educationType: string;
  institution: string | null;
  graduationDate: IsoDate | null;
  specialization: string | null;
  qualification: string | null;
  firstSeenYear: Year;
}
