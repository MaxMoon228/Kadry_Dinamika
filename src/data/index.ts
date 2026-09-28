import type { User } from "../domain/user";
import { createApiDataSource } from "./api/apiDataSource";
import type { DataSource, DataSourceKind } from "./contracts/repositories";
import { createMockDataSource } from "./mock/mockDataSource";

export function configuredDataSourceKind(): DataSourceKind {
  return import.meta.env.VITE_DATA_SOURCE === "api" ? "api" : "mock";
}

/** Единая точка выбора реализации. Страницы получают DataSource через useData(). */

export function createDataSource(user: User, getAccessToken: () => string | null): DataSource {
  if (configuredDataSourceKind() === "api") {
    return createApiDataSource({
      baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      getAccessToken,
    });
  }
  const latency = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 250);
  return createMockDataSource(user, Number.isFinite(latency) ? latency : 250);
}
