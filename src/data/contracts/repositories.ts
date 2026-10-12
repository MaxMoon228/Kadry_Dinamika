/**
 * Интерфейсы доступа к данным. Страницы и компоненты зависят только от них.
 * Реализации: MockDataSource (src/data/mock) и ApiDataSource (src/data/api).
 *
 * Access scope НЕ передаётся параметром: в production его определяет backend по токену
 * пользователя. Mock-реализация создаётся для конкретного пользователя и имитирует
 * серверную авторизацию.
 */

import type { Page, SchoolId, TeacherId } from "../../domain/common";
import type { ForecastInput, ForecastResult } from "../../domain/forecast";
import type { MobilityGroupRow } from "../../domain/mobility";
import type {
  ForecastOverview,
  GlobalFeatureImportance,
  InferenceMonitoringSummary,
  ModelMetadata,
  ModelMetrics,
} from "../../domain/model";

import type {
  CompositionSummary,
  DashboardSummary,
  DataCatalog,
  Dictionaries,
  DistrictBreakdown,
  DynamicsSummary,
  GlobalFilters,
  HeatmapDto,
  LoadScatterDto,
  MobilityDimension,
  MobilityOverview,
  NumericMetric,
  ScatterPoint,
  SchoolListQuery,
  SchoolProfileDto,
  SchoolSummaryRow,
  TeacherListQuery,
  TeacherProfileDto,
  TeacherRegistryRow,
  TrainingSummary,
} from "./dto";

export interface DictionaryRepository {
  get(): Promise<Dictionaries>;
}

export interface DashboardRepository {
  getSummary(filters: GlobalFilters): Promise<DashboardSummary>;
  /** Только system scope. */
  getDistrictBreakdown(filters: GlobalFilters): Promise<DistrictBreakdown>;
}

export interface SchoolRepository {
  list(query: SchoolListQuery): Promise<SchoolSummaryRow[]>;
  getProfile(schoolId: SchoolId, year: number): Promise<SchoolProfileDto>;
}

export interface TeacherRepository {
  list(query: TeacherListQuery): Promise<Page<TeacherRegistryRow>>;
  getProfile(teacherId: TeacherId, year?: number): Promise<TeacherProfileDto>;
}

export interface AnalyticsRepository {
  getComposition(filters: GlobalFilters): Promise<CompositionSummary>;
  getTraining(filters: GlobalFilters): Promise<TrainingSummary>;
  getDynamics(filters: GlobalFilters, subject: string | null): Promise<DynamicsSummary>;
  getMobilityOverview(filters: GlobalFilters): Promise<MobilityOverview>;
  getMobilityBreakdown(
    filters: GlobalFilters,
    dimension: MobilityDimension,
  ): Promise<MobilityGroupRow[]>;
  getScatter(
    filters: GlobalFilters,
    x: NumericMetric,
    y: NumericMetric,
    limit: number,
  ): Promise<ScatterPoint[]>;
  getHeatmap(filters: GlobalFilters): Promise<HeatmapDto>;
  /** Нагрузка молодых педагогов: стаж × число предметов; allYears — все срезы сразу. */
  getLoadScatter(filters: GlobalFilters, allYears: boolean): Promise<LoadScatterDto>;
}

export interface DataCatalogRepository {
  get(): Promise<DataCatalog>;
}

export interface ForecastService {
  predict(input: ForecastInput): Promise<ForecastResult>;
}

export interface ModelService {
  getMetadata(): Promise<ModelMetadata>;
  getMetrics(): Promise<ModelMetrics>;
  getGlobalImportance(): Promise<GlobalFeatureImportance | null>;
  getForecastOverview(
    filters: GlobalFilters,
    groupBy: "district" | "age_group" | "subject",
  ): Promise<ForecastOverview | null>;
  getMonitoringSummary(): Promise<InferenceMonitoringSummary>;
}

/** mock — синтетика; local — реальный датасет из public/data (in-memory, статический JSON); api — backend. */

export type DataSourceKind = "mock" | "local" | "api";

export interface DataSource {
  kind: DataSourceKind;
  dictionaries: DictionaryRepository;
  dashboard: DashboardRepository;
  schools: SchoolRepository;
  teachers: TeacherRepository;
  analytics: AnalyticsRepository;
  catalog: DataCatalogRepository;
  model: ModelService;
  forecast: ForecastService;
}
