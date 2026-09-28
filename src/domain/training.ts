import type { IsoDate, TeacherId } from "./common";

/** ПК — повышение квалификации, ПП — профессиональная переподготовка. */

export type TrainingProgramType = "ПК" | "ПП";

export interface TeacherTraining {
  teacherId: TeacherId;
  programName: string;
  programType: TrainingProgramType;
  provider: string | null;
  hours: number | null;
  documentDate: IsoDate | null;
}

export const TRAINING_TYPE_LABEL: Record<TrainingProgramType, string> = {
  ПК: "Повышение квалификации",
  ПП: "Профессиональная переподготовка",
};
