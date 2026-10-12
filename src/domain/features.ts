import type { TeacherId, Year } from "./common";

/**
 * Признаки итоговой таблицы df_final (ноутбук «Неделя 4_ДЗ_Рачайочечки», одна строка —
 * учитель × год). Названия полей совпадают с колонками ноутбука, чтобы признаки
 * однозначно сопоставлялись с обучающей выборкой модели.
 */

export interface TeacherYearFeatures {
  teacherId: TeacherId;
  year: Year;
  /** «учитель» / «руководитель» / «другой» (по ключевым словам должности). */
  main_position_cat: string | null;
  academic_degree_cat: string | null;
  category_qual_cat: string | null;
  /** «активно» / «не активно» / «не было» — по сроку действия категории. */
  category_active: string | null;
  experience_age_other: number | null;
  n_unique_subjects: number | null;
  min_parallel: number | null;
  max_parallel: number | null;
  n_unique_parallel: number | null;
  is_exam_subject: number | null;
  main_subject_group: string | null;
  is_ped_education: number | null;
  high_type_education: string | null;
  n_courses: number | null;
  hours_courses: number | null;
  n_gia_courses: number | null;
  has_pp: number | null;
  /** Кодировка ноутбука: 0 — остался, 1 — ушёл, 2 — перевёлся; null — исход неизвестен. */
  target: number | null;
}

export const FEATURE_LABELS: Record<Exclude<keyof TeacherYearFeatures, "teacherId" | "year">, string> =
  {
    main_position_cat: "Категория должности",
    academic_degree_cat: "Учёная степень (кат.)",
    category_qual_cat: "Квалификационная категория (кат.)",
    category_active: "Действие категории",
    experience_age_other: "Непедагогический стаж, лет",
    n_unique_subjects: "Разных предметов",
    min_parallel: "Мин. параллель",
    max_parallel: "Макс. параллель",
    n_unique_parallel: "Разных параллелей",
    is_exam_subject: "Подготовка к ЕГЭ/ОГЭ",
    main_subject_group: "Основная группа предметов",
    is_ped_education: "Педагогическое образование",
    high_type_education: "Высший уровень образования",
    n_courses: "Курсов ПК/ПП за год",
    hours_courses: "Часов ПК/ПП за год",
    n_gia_courses: "Курсов по ГИА за год",
    has_pp: "Профпереподготовка за год",
    target: "target (0/1/2 ноутбука)",
  };

/** Пороги «критической нагрузки» (ноутбук «Неделя 5_НС_Учителя_Семинар»). */

export const CRITICAL_LOAD = {
  /** Стаж педагогической работы строго меньше. */
  maxExperienceExclusive: 2,
  /** Разных предметов не меньше. */
  minSubjects: 5,
} as const;

export function isCriticalLoad(pedExperience: number | null, subjects: number | null): boolean {
  return (
    pedExperience != null &&
    subjects != null &&
    pedExperience < CRITICAL_LOAD.maxExperienceExclusive &&
    subjects >= CRITICAL_LOAD.minSubjects
  );
}
