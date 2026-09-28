import type { TeacherEducation } from "../../domain/education";
import { FORECAST_INPUT_SCHEMA_VERSION, type ForecastInput } from "../../domain/forecast";
import { parallelsOf, subjectsOf, type TeacherYearSnapshot } from "../../domain/teacher";
import type { TeacherTraining } from "../../domain/training";
import { snapshotCutoff } from "../../data/selectors/composition";
import type { HeuristicFeatures } from "./mockModel";

/**
 * Сборка ForecastInput из нормализованного среза педагога. Та же функция (в Python-версии)
 * должна использоваться при построении обучающей выборки — единый feature pipeline.
 */

export function snapshotToForecastInput(
  s: TeacherYearSnapshot,
  training: TeacherTraining[],
  education: TeacherEducation[],
): ForecastInput {
  const cutoff = snapshotCutoff(s.year);
  const known = training.filter((t) => t.documentDate != null && t.documentDate <= cutoff);
  const last = known.reduce<string | null>(
    (a, t) => (a == null || t.documentDate! > a ? t.documentDate : a),
    null,
  );
  return {
    schemaVersion: FORECAST_INPUT_SCHEMA_VERSION,
    referenceYear: s.year,
    teacher: {
      gender: s.gender,
      age: s.age ?? 0,
      mainPosition: s.mainPosition,
      activityDirection: s.activityDirection,
      academicDegree: s.academicDegree,
      qualificationCategory: s.qualificationCategory,
      qualificationAssignedAt: s.qualificationAssignedAt,
      totalExperienceYears: s.totalExperienceYears ?? 0,
      pedagogicalExperienceYears: s.pedagogicalExperienceYears ?? 0,
      subjects: subjectsOf(s),
      parallels: parallelsOf(s),
      isClassTeacher: s.isClassTeacher ?? false,
      preprofessionalDirection: s.preprofessionalDirection,
    },
    education: education
      .filter((e) => e.firstSeenYear <= s.year)
      .map((e) => ({
        educationType: e.educationType,
        specialization: e.specialization,
        qualification: e.qualification,
        graduationYear: e.graduationDate ? Number(e.graduationDate.slice(0, 4)) : null,
      })),
    training: {
      programCount: known.length,
      totalHours: known.reduce((a, t) => a + (t.hours ?? 0), 0),
      hasRetraining: known.some((t) => t.programType === "ПП"),
      lastDocumentDate: last,
    },
    school: { mode: "reference", schoolId: s.schoolId },
  };
}

export function toHeuristicFeatures(
  input: ForecastInput,
  studentsPerTeacher: number | null,
): HeuristicFeatures {
  return {
    age: input.teacher.age,
    pedagogicalExperienceYears: input.teacher.pedagogicalExperienceYears,
    qualificationCategory: input.teacher.qualificationCategory,
    isClassTeacher: input.teacher.isClassTeacher,
    trainingCount: input.training.programCount,
    hasRetraining: input.training.hasRetraining,
    studentsPerTeacher,
    preprofessional: input.teacher.preprofessionalDirection != null,
  };
}
