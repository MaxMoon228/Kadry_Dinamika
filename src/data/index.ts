import type { User } from "../domain/user";
import { createApiDataSource } from "./api/apiDataSource";
import type { DataSource, DataSourceKind } from "./contracts/repositories";
import { fetchRealDataset } from "./local/realDataset";
import { createMockDataSource } from "./mock/mockDataSource";
import { DatasetIndex, setActiveIndex } from "./mock/mockDataset";

export function configuredDataSourceKind(): DataSourceKind {
  const v = import.meta.env.VITE_DATA_SOURCE;
  return v === "api" ? "api" : v === "local" ? "local" : "mock";
}

/** Загрузка датасета до первого рендера (нужна только режиму local). */

export async function bootstrapDataSource(): Promise<void> {
  if (configuredDataSourceKind() !== "local") return;
  setActiveIndex(new DatasetIndex(await fetchRealDataset()));
}

/** Единая точка выбора реализации. Страницы получают DataSource через useData(). */

export function createDataSource(user: User, getAccessToken: () => string | null): DataSource {
  const kind = configuredDataSourceKind();
  if (kind === "api") {
    return createApiDataSource({
      baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      getAccessToken,
    });
  }
  const latency = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? (kind === "local" ? 0 : 250));
  return createMockDataSource(user, Number.isFinite(latency) ? latency : 250, kind);
}
