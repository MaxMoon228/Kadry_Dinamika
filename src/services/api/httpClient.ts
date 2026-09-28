import {
  AccessDeniedError,
  DataAccessError,
  NotFoundError,
  ValidationError,
  type FieldError,
} from "../../data/contracts/errors";

export type QueryValue = string | number | boolean | null | undefined;

export interface HttpClientOptions {
  baseUrl: string;
  /** Токен доступа (OIDC/JWT). Авторизация и scope определяются backend по токену. */
  getAccessToken?: () => string | null;
  timeoutMs?: number;
}

export interface HttpClient {
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

function buildUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(base.replace(/\/$/, "") + path, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  return url.toString();
}

async function toError(res: Response): Promise<DataAccessError> {
  let body: { detail?: string | { loc?: (string | number)[]; msg: string }[] } = {};
  try {
    body = await res.json();
  } catch {
    /* пустое тело */
  }
  if (res.status === 403)
    return new AccessDeniedError(typeof body.detail === "string" ? body.detail : undefined);
  if (res.status === 404)
    return new NotFoundError(typeof body.detail === "string" ? body.detail : undefined);
  if (res.status === 422) {
    const fields: FieldError[] = Array.isArray(body.detail)
      ? body.detail.map((d) => ({
          field: (d.loc ?? []).filter((x) => x !== "body").join("."),
          message: d.msg,
        }))
      : [];
    return new ValidationError(fields);
  }
  return new DataAccessError(
    typeof body.detail === "string" ? body.detail : `Ошибка сервера (${res.status})`,
    res.status,
    "http_error",
  );
}

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const request = async <T>(
    method: "GET" | "POST",
    path: string,
    query?: Record<string, QueryValue>,
    body?: unknown,
  ): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = opts.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    try {
      const res = await fetch(buildUrl(opts.baseUrl, path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: "include",
      });
      if (!res.ok) throw await toError(res);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof DataAccessError) throw e;
      throw new DataAccessError(
        "Сервер недоступен. Проверьте подключение к API.",
        0,
        "network_error",
      );
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    get: (path, query) => request("GET", path, query),
    post: (path, body) => request("POST", path, undefined, body),
  };
}
