/**
 * API DTO — формы ответов backend для UI. Это НЕ сырые записи и НЕ нормализованные
 * сущности: агрегаты считаются на сервере в пределах access scope пользователя.
 * Контракт описан в docs/API_CONTRACT.md.
 */

import type { CountByGroup, PageRequest, SchoolId, TeacherId, Year } from "../../domain/common";
import type { TeacherEducation } from "../../domain/education";
import type { TeacherYearFeatures } from "../../domain/features";
import type { OptionalField } from "./normalized";
import type {
  MobilityClass,
  MobilityDistribution,
  MobilityGroupRow,
  MobilityKey,
  MobilityPeriod,
} from "../../domain/mobility";

import type { School, SchoolYearSnapshot } from "../../domain/school";
import type { TeacherYearSnapshot } from "../../domain/teacher";
import type { TeacherTraining } from "../../domain/training";
import type { AccessScope } from "../../domain/user";
import type { DerivedTeacherFeatures } from "../selectors/composition";

// ------------------------------------------------------------------ filters

/** Глобальные фильтры (общие для большинства страниц). */

export interface GlobalFilters {
  year: Year;
  /** null — все округа. Для директора игнорируется сервером (scope = своя школа). */
  district: string | null;
}

export interface Dictionaries {
  meta: {
    datasetVersion: string;
    updatedAt: string;
    isMock: boolean;
    origin: string;
    /** Поля, отсутствующие в подключённом источнике: зависящие от них разрезы скрываются. */
    unavailableFields: OptionalField[];
  };
  /** Школа пользователя для school scope (директор); null для system scope. */
  scopeSchool: School | null;
  years: Year[];
  periods: MobilityPeriod[];
  districts: string[];
  subjects: string[];
  qualificationCategories: string[];
  mainPositions: string[];
  activityDirections: string[];
  academicDegrees: string[];
  educationTypes: string[];
  educationQualifications: string[];
  preprofessionalDirections: string[];
  parallels: string[];
}

// ------------------------------------------------------------------ catalog

export interface DataSourceInfo {
  key: "teachers" | "education" | "training" | "schools";
  title: string;
  description: string;
  sourceFieldCount: number;
  rawRowCount: number;
  normalizedRecordCount: number;
  /** real — реальная выгрузка, обработанная пайплайном ноутбука (локальный режим). */
  status: "mock" | "real" | "validated" | "needs_review";
}

export interface DataCatalog {
  isMock: boolean;
  datasetVersion: string;
  updatedAt: string;
  origin: string;
  /** Размер итоговой таблицы (строки × признаки), если источник её предоставляет. */
  finalTable: { rows: number; columns: number; knownTargetRows: number } | null;
  period: { from: Year; to: Year };
  sources: DataSourceInfo[];
  quality: {
    exactDuplicatesRemoved: number;
    cumulativeEducationCollapsed: number;
    conflictingTeacherYears: number;
    multiSchoolTeacherYears: number;
    unknownSchoolRows: number;
    typosFixed: number | null;
    missingValues: { field: string; count: number }[];
  };
}

// ------------------------------------------------------------------ dashboard

export interface YearKpi {
  year: Year;
  teacherCount: number;
  studentCount: number | null;
  avgAge: number | null;
  avgPedagogicalExperience: number | null;
  studentsPerTeacher: number | null;
  under35Share: number | null;
}

export interface DashboardSummary {
  scope: AccessScope;
  year: Year;
  schoolCount: number;
  current: YearKpi;
  previous: YearKpi | null;
  trend: YearKpi[];
  withCategoryShare: number | null;
  classTeacherShare: number | null;
  /** Мобильность за период (year−1 → year); null, если период не наблюдается. */
  mobility: MobilityDistribution | null;
  previousMobility: MobilityDistribution | null;
  mobilityTrend: MobilityDistribution[];
}

export interface DistrictRow {
  district: string;
  schoolCount: number;
  teacherCount: number;
  studentCount: number | null;
  studentsPerTeacher: number | null;
  mobility: MobilityDistribution | null;
}

export interface DistrictBreakdown {
  year: Year;
  rows: DistrictRow[];
  systemStudentsPerTeacher: number | null;
  teacherTrend: { year: Year; byDistrict: Record<string, number> }[];
}

// ------------------------------------------------------------------ schools

export interface SchoolSummaryRow {
  schoolId: SchoolId;
  name: string;
  district: string;
  buildingCount: number | null;
  studentCount: number | null;
  teacherCount: number;
  studentsPerTeacher: number | null;
  avgAge: number | null;
  under35Share: number | null;
  /** Изменение численности педагогов к первому году наблюдения. */
  teacherCountChange: number | null;
  mobility: MobilityGroupRow | null;
}

export interface SchoolListQuery extends GlobalFilters {}

export interface CompositionSummary {
  year: Year;
  teacherCount: number;
  avgAge: number | null;
  avgPedagogicalExperience: number | null;
  under35Share: number | null;
  over60Share: number | null;
  withCategoryShare: number | null;
  classTeacherShare: number | null;
  preprofessionalShare: number | null;
  byAgeGroup: CountByGroup[];
  byExperienceGroup: CountByGroup[];
  byCategory: CountByGroup[];
  bySubject: CountByGroup[];
  byActivityDirection: CountByGroup[];
  byEducationType: CountByGroup[];
}

export interface TrainingSummary {
  year: Year;
  teacherCount: number;
  teachersWithTraining: number;
  programCount: number;
  totalHours: number;
  byType: { ПК: number; ПП: number };
  documentsByYear: CountByGroup[];
}

export interface SchoolProfileDto {
  school: School;
  year: Year;
  snapshots: SchoolYearSnapshot[];
  composition: CompositionSummary;
  training: TrainingSummary;
  mobilityByPeriod: MobilityDistribution[];
}

// ------------------------------------------------------------------ teachers

export type TeacherSortField =
  | "teacherId"
  | "schoolName"
  | "age"
  | "pedagogicalExperienceYears"
  | "totalExperienceYears"
  | "qualificationCategory";

export interface TeacherListQuery extends GlobalFilters, PageRequest<TeacherSortField> {
  /** Фильтр по исходу периода year → year+1. */
  search: string | null;
  subject: string | null;
  qualificationCategory: string | null;
  outcome: MobilityKey | null;
  ageMin: number | null;
  ageMax: number | null;
  pedExpMin: number | null;
  pedExpMax: number | null;
}

export interface TeacherRegistryRow {
  teacherId: TeacherId;
  schoolId: SchoolId;
  schoolName: string;
  district: string;
  mainPosition: string | null;
  subjects: string[];
  age: number | null;
  totalExperienceYears: number | null;
  pedagogicalExperienceYears: number | null;
  qualificationCategory: string | null;
  isClassTeacher: boolean | null;
  preprofessional: boolean;
  /** Исход периода year → year+1; null — ещё не наблюдается. */
  outcome: { period: MobilityPeriod; status: MobilityClass } | null;
}

export interface TeacherTrajectoryPoint {
  year: Year;
  present: boolean;
  /** Название школы; для школ вне scope пользователя — обезличено («Другая школа»). */
  schoolLabel: string | null;
  isInScope: boolean;
}

export interface TeacherProfileDto {
  teacherId: TeacherId;
  year: Year;
  snapshot: TeacherYearSnapshot;
  school: School;
  education: TeacherEducation[];
  training: TeacherTraining[];
  derived: DerivedTeacherFeatures;
  trajectory: TeacherTrajectoryPoint[];
  outcomes: { period: MobilityPeriod; status: MobilityClass }[];
  /** Строка итоговой таблицы df_final за год среза; null — источник её не содержит. */
  datasetFeatures: TeacherYearFeatures | null;
}

// ------------------------------------------------------------------ analytics

export type MobilityDimension =
  | "age_group"
  | "experience_group"
  | "subject"
  | "qualification_category"
  | "class_teacher"
  | "preprofessional"
  | "has_training"
  | "district";

export interface MobilityOverview {
  period: MobilityPeriod | null;
  distribution: MobilityDistribution | null;
  trend: MobilityDistribution[];
  /** Группы с наибольшей долей ухода из системы (без утверждения о причинности). */
  elevatedGroups: MobilityGroupRow[];
}

export interface DynamicsSummary {
  years: Year[];
  kpis: YearKpi[];
  ageStructure: { year: Year; shares: Record<string, number> }[];
  experienceStructure: { year: Year; counts: Record<string, number> }[];
  categoryStructure: { year: Year; counts: Record<string, number> }[];
  subjectTrend: { year: Year; value: number }[];
  subject: string | null;
}

export type NumericMetric =
  | "age"
  | "total_experience"
  | "pedagogical_experience"
  | "training_count"
  | "training_hours";

export interface ScatterPoint {
  x: number;
  y: number;
  status: MobilityClass | null;
}

/**
 * Точка графика «Стаж × число разных предметов» (ноутбук «Неделя 5»): один педагог в одном
 * году среза. Краткая карточка нужна для всплывающей подсказки без отдельного запроса.
 */

export interface LoadPoint {
  teacherId: TeacherId;
  year: Year;
  /** Стаж педагогической работы, лет. */
  x: number;
  /** Число разных предметов (n_unique_subjects). */
  y: number;
  critical: boolean;
  schoolName: string;
  age: number | null;
  mainPosition: string | null;
  qualificationCategory: string | null;
  topSubjects: string[];
  /** Исход периода year → year+1; null — ещё не наблюдается. */
  status: MobilityClass | null;
}

export interface LoadScatterDto {
  years: Year[];
  points: LoadPoint[];
  total: number;
  criticalCount: number;
  /** Доля ушедших из системы: среди «критических» и среди остальных (по известным исходам). */
  leaveShareCritical: number | null;
  leaveShareOther: number | null;
  thresholds: { maxExperienceExclusive: number; minSubjects: number };
}

export interface HeatmapDto {
  period: MobilityPeriod | null;
  rows: string[];
  cols: string[];
  /** Доля ушедших из системы, %; null — нет данных или группа подавлена. */
  cells: (number | null)[][];
  minGroupSize: number;
}
