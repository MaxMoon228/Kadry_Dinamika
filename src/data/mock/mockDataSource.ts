import type { User } from "../../domain/user";
import { MockForecastService } from "../../services/forecast/mockForecastService";
import { MockModelService } from "../../services/model/mockModelService";
import type { DataSource } from "../contracts/repositories";
import { MockContext } from "./context";
import {
  mockAnalyticsRepository,
  mockCatalogRepository,
  mockDashboardRepository,
  mockDictionaryRepository,
  mockSchoolRepository,
  mockTeacherRepository,
} from "./mockRepositories";

/** MOCK / DEMO источник данных для конкретного пользователя (имитация серверного scope). */

export function createMockDataSource(user: User, latencyMs = 0): DataSource {
  const ctx = new MockContext(user, undefined, latencyMs);
  const forecast = new MockForecastService(ctx);
  return {
    kind: "mock",
    dictionaries: mockDictionaryRepository(ctx),
    dashboard: mockDashboardRepository(ctx),
    schools: mockSchoolRepository(ctx),
    teachers: mockTeacherRepository(ctx),
    analytics: mockAnalyticsRepository(ctx),
    catalog: mockCatalogRepository(ctx),
    model: new MockModelService(ctx, forecast),
    forecast,
  };
}
