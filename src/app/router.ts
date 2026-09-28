import { useCallback, useEffect, useState } from "react";

/**
 * Минимальный hash-роутер (без зависимостей): работает при любом base path,
 * в том числе в Figma Make preview. Глобальные фильтры хранятся в query-строке.
 */

export type Route =
  | { page: "overview" }
  | { page: "schools" }
  | {
      page: "school";
      id: string;
    }
  | { page: "staff" }
  | { page: "teacher"; id: string }
  | {
      page: "dynamics";
    }
  | { page: "mobility" }
  | { page: "forecast" }
  | { page: "calculator" }
  | {
      page: "analytics";
    }
  | { page: "data" }
  | { page: "monitoring" }
  | {
      page: "not_found";
      path: string;
    };

export type PageKey = Route["page"];

const SIMPLE: Record<string, PageKey> = {
  "": "overview",
  overview: "overview",
  schools: "schools",
  staff: "staff",
  dynamics: "dynamics",
  mobility: "mobility",
  forecast: "forecast",
  calculator: "calculator",
  analytics: "analytics",
  data: "data",
  monitoring: "monitoring",
};

export function parseHash(hash: string): { route: Route; query: URLSearchParams } {
  const raw = hash.replace(/^#/, "");
  const [path, qs = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(qs);
  if (parts.length <= 1 && (parts[0] ?? "") in SIMPLE)
    return { route: { page: SIMPLE[parts[0] ?? ""] } as Route, query };
  if (parts.length === 2 && parts[0] === "schools")
    return { route: { page: "school", id: parts[1] }, query };
  if (parts.length === 2 && parts[0] === "teachers")
    return { route: { page: "teacher", id: parts[1] }, query };
  return { route: { page: "not_found", path: "/" + parts.join("/") }, query };
}

export function routePath(r: Route): string {
  switch (r.page) {
    case "school":
      return `/schools/${encodeURIComponent(r.id)}`;
    case "teacher":
      return `/teachers/${encodeURIComponent(r.id)}`;
    case "not_found":
      return r.path;
    default:
      return `/${r.page}`;
  }
}

export function useHashRoute() {
  const [state, setState] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setState(parseHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = useCallback(
    (r: Route, opts: { replace?: boolean; query?: URLSearchParams } = {}) => {
      const q = opts.query ?? parseHash(window.location.hash).query;
      const qs = q.toString();
      const hash = `#${routePath(r)}${qs ? `?${qs}` : ""}`;
      if (opts.replace) {
        history.replaceState(null, "", hash);
        setState(parseHash(hash));
      } else {
        window.location.hash = hash;
      }
      if (!opts.replace) window.scrollTo(0, 0);
    },
    [],
  );
  const setQuery = useCallback((patch: Record<string, string | null>) => {
    const { route, query } = parseHash(window.location.hash);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") query.delete(k);
      else query.set(k, v);
    }
    const qs = query.toString();
    const hash = `#${routePath(route)}${qs ? `?${qs}` : ""}`;
    history.replaceState(null, "", hash);
    setState(parseHash(hash));
  }, []);
  return { route: state.route, query: state.query, navigate, setQuery };
}
