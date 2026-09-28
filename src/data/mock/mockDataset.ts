/**
 * MOCK / DEMO. Ленивая сборка синтетического датасета тем же путём, что и реальный:
 * generateMockRawDataset() → normalizeDataset() → индекс для быстрых выборок.
 */

import type { SchoolId, TeacherId, Year } from "../../domain/common";
import type { TeacherEducation } from "../../domain/education";
import type { MobilityOutcome } from "../../domain/mobility";
import type { School, SchoolYearSnapshot } from "../../domain/school";
import type { TeacherYearSnapshot } from "../../domain/teacher";
import type { TeacherTraining } from "../../domain/training";
import { normalizeDataset } from "../adapters/normalize";
import type { NormalizedDataset } from "../contracts/normalized";
import { generateMockRawDataset } from "./generator";

export const MOCK_DATASET_VERSION = "mock-synthetic-v1";

export const MOCK_UPDATED_AT = "2024-11-18";

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

export class DatasetIndex {
  readonly schoolById: Map<SchoolId, School>;
  readonly snapshotsByYear: Map<Year, TeacherYearSnapshot[]>;
  readonly snapshotsByTeacher: Map<TeacherId, TeacherYearSnapshot[]>;
  readonly schoolSnapshot: Map<string, SchoolYearSnapshot>;
  readonly outcomesByFromYear: Map<Year, MobilityOutcome[]>;
  readonly outcomeByKey: Map<string, MobilityOutcome>;
  readonly trainingByTeacher: Map<TeacherId, TeacherTraining[]>;
  readonly educationByTeacher: Map<TeacherId, TeacherEducation[]>;
  constructor(readonly ds: NormalizedDataset) {
    this.schoolById = new Map(ds.schools.map((s) => [s.id, s]));
    this.snapshotsByYear = groupBy(ds.teacherSnapshots, (s) => s.year);
    this.snapshotsByTeacher = groupBy(ds.teacherSnapshots, (s) => s.teacherId);
    for (const list of this.snapshotsByTeacher.values()) list.sort((a, b) => a.year - b.year);
    this.schoolSnapshot = new Map(ds.schoolSnapshots.map((s) => [`${s.schoolId}|${s.year}`, s]));
    this.outcomesByFromYear = groupBy(ds.outcomes, (o) => o.period.fromYear);
    this.outcomeByKey = new Map(ds.outcomes.map((o) => [`${o.teacherId}|${o.period.fromYear}`, o]));
    this.trainingByTeacher = groupBy(ds.training, (t) => t.teacherId);
    this.educationByTeacher = groupBy(ds.education, (e) => e.teacherId);
  }
  snapshot(teacherId: TeacherId, year: Year): TeacherYearSnapshot | undefined {
    return this.snapshotsByTeacher.get(teacherId)?.find((s) => s.year === year);
  }
  schoolYear(schoolId: SchoolId, year: Year): SchoolYearSnapshot | undefined {
    return this.schoolSnapshot.get(`${schoolId}|${year}`);
  }
}

let cached: DatasetIndex | null = null;

export function getMockIndex(): DatasetIndex {
  if (!cached) cached = new DatasetIndex(normalizeDataset(generateMockRawDataset()));
  return cached;
}
