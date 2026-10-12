/**
 * API реализации репозиториев (REST, FastAPI). Эндпоинты — docs/API_CONTRACT.md.
 * Пока backend не развёрнут, используется mock (VITE_DATA_SOURCE=mock).
 */

import type { ForecastInput, ForecastResult } from "../../domain/forecast";
import type { GlobalFilters, TeacherListQuery } from "../contracts/dto";
import type { DataSource } from "../contracts/repositories";
import {
  createHttpClient,
  type HttpClientOptions,
  type QueryValue,
} from "../../services/api/httpClient";

import { validateForecastResult } from "../../services/forecast/validation";

const g = (f: GlobalFilters): Record<string, QueryValue> => ({
  year: f.year,
  district: f.district,
});

export function createApiDataSource(opts: HttpClientOptions): DataSource {
  const http = createHttpClient(opts);
  return {
    kind: "api",
    dictionaries: { get: () => http.get("/dictionaries") },
    dashboard: {
      getSummary: (f) => http.get("/dashboard/summary", g(f)),
      getDistrictBreakdown: (f) => http.get("/dashboard/districts", g(f)),
    },
    schools: {
      list: (q) => http.get("/schools", g(q)),
      getProfile: (id, year) => http.get(`/schools/${encodeURIComponent(id)}`, { year }),
    },
    teachers: {
      list: (q: TeacherListQuery) =>
        http.get("/teachers", {
          ...g(q),
          page: q.page,
          page_size: q.pageSize,
          sort: q.sort ? `${q.sort.direction === "desc" ? "-" : ""}${q.sort.field}` : undefined,
          search: q.search,
          subject: q.subject,
          qualification_category: q.qualificationCategory,
          outcome: q.outcome,
          age_min: q.ageMin,
          age_max: q.ageMax,
          ped_exp_min: q.pedExpMin,
          ped_exp_max: q.pedExpMax,
        }),
      getProfile: (id, year) => http.get(`/teachers/${encodeURIComponent(id)}`, { year }),
    },
    analytics: {
      getComposition: (f) => http.get("/analytics/composition", g(f)),
      getTraining: (f) => http.get("/analytics/training", g(f)),
      getDynamics: (f, subject) => http.get("/analytics/dynamics", { ...g(f), subject }),
      getMobilityOverview: (f) => http.get("/analytics/mobility", g(f)),
      getMobilityBreakdown: (f, dimension) =>
        http.get("/analytics/mobility/breakdown", { ...g(f), dimension }),
      getScatter: (f, x, y, limit) => http.get("/analytics/scatter", { ...g(f), x, y, limit }),
      getHeatmap: (f) => http.get("/analytics/heatmap", g(f)),
      getLoadScatter: (f, allYears) =>
        http.get("/analytics/load-scatter", { ...g(f), all_years: allYears }),
    },
    catalog: { get: () => http.get("/data/catalog") },
    model: {
      getMetadata: () => http.get("/model/metadata"),
      getMetrics: () => http.get("/model/metrics"),
      getGlobalImportance: () => http.get("/model/importance"),
      getForecastOverview: (f, groupBy) =>
        http.get("/forecast/overview", { ...g(f), group_by: groupBy }),
      getMonitoringSummary: () => http.get("/model/monitoring"),
    },
    forecast: {
      predict: async (input: ForecastInput) => {
        const result = await http.post<ForecastResult>("/forecast", input);
        const problems = validateForecastResult(result);
        if (problems.length)
          throw new Error(`Ответ /forecast не соответствует контракту: ${problems.join("; ")}`);
        return result;
      },
    },
  };
}
