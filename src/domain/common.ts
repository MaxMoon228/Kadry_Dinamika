/** Год среза данных (год, к которому относится запись источника). */

export type Year = number;

export type SchoolId = string;

export type TeacherId = string;

/** Дата в формате ISO 8601 (YYYY-MM-DD). */

export type IsoDate = string;

export type SortDirection = "asc" | "desc";

export interface SortSpec<F extends string = string> {
  field: F;
  direction: SortDirection;
}

export interface PageRequest<F extends string = string> {
  /** Номер страницы, начиная с 1. */
  page: number;
  pageSize: number;
  sort?: SortSpec<F>;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Результат группировки «значение признака → число». */

export interface CountByGroup {
  group: string;
  value: number;
}
