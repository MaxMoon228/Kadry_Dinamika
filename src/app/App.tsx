import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider, useSession } from "../auth/SessionProvider";
import { Chip, DemoTag, Select } from "../components/ui";
import { ErrorState, ForbiddenState, PageSkeleton } from "../components/states";
import ThemeToggle from "../components/ThemeToggle";
import ErrorBoundary from "../components/ErrorBoundary";
import type { GlobalFilters } from "../data/contracts/dto";
import { DataProvider, useData } from "../data/DataProvider";
import type { ForecastInput } from "../domain/forecast";
import { ROLE_LABEL, type Role } from "../domain/user";
import { useAsync } from "../hooks/useAsync";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppContext, useApp, type AppCtx } from "./AppContext";
import { PAGE_PERMISSION, PAGE_TITLE, navItems, type NavItem } from "./navigation";
import { useHashRoute, type Route } from "./router";
import Overview from "../pages/Overview";
import Schools from "../pages/Schools";
import SchoolProfile from "../pages/SchoolProfile";
import Staff from "../pages/Staff";
import TeacherProfile from "../pages/TeacherProfile";
import Dynamics from "../pages/Dynamics";
import Mobility from "../pages/Mobility";
import Forecast from "../pages/Forecast";
import Calculator from "../pages/Calculator";
import Analytics from "../pages/Analytics";
import DataModel from "../pages/DataModel";
import Monitoring from "../pages/Monitoring";

const ROLES: Role[] = ["education_head", "school_director", "analyst"];

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <SessionProvider>
          <DataProvider>
            <Shell />
          </DataProvider>
        </SessionProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

function Shell() {
  const data = useData();
  const { route, query, navigate, setQuery } = useHashRoute();
  const dict = useAsync(() => data.dictionaries.get(), [data]);
  const [prefill, setPrefill] = useState<ForecastInput | null>(null);
  const setFilters = useCallback(
    (patch: Partial<GlobalFilters>) => {
      const q: Record<string, string | null> = {};
      if ("year" in patch) q.year = patch.year == null ? null : String(patch.year);
      if ("district" in patch) q.district = patch.district ?? null;
      setQuery(q);
    },
    [setQuery],
  );
  const ctx = useMemo<AppCtx | null>(() => {
    if (dict.status !== "success") return null;
    const d = dict.data;
    const qYear = Number(query.get("year"));
    const year = d.years.includes(qYear) ? qYear : d.years[d.years.length - 1];
    const qDistrict = query.get("district");
    const district =
      d.scopeSchool == null && qDistrict && d.districts.includes(qDistrict) ? qDistrict : null;
    return {
      route,
      navigate: (r: Route) => navigate(r),
      filters: { year, district },
      setFilters,
      dictionaries: d,
      calculatorPrefill: prefill,
      openCalculator: (input) => {
        setPrefill(input);
        navigate({ page: "calculator" });
      },
    };
  }, [dict.status, dict.data, query, route, navigate, setFilters, prefill]);
  if (dict.status === "error")
    return (
      <div className="p-10">
        <ErrorState error={dict.error} onRetry={dict.reload} />
      </div>
    );
  if (!ctx)
    return (
      <div className="mx-auto max-w-[1180px] p-10">
        <PageSkeleton />
      </div>
    );
  return (
    <AppContext.Provider value={ctx}>
      <Layout />
    </AppContext.Provider>
  );
}

function Layout() {
  const { route, navigate, filters, setFilters, dictionaries } = useApp();
  const { user, scope, can, switchRole } = useSession();
  const items = navItems(scope, can);
  const isDirector = scope.kind === "school";
  const crumbs: { label: string; route?: Route }[] = [{ label: "СППР" }];
  if (route.page === "school")
    crumbs.push(
      isDirector ? { label: "Моя школа" } : { label: "Школы", route: { page: "schools" } },
      ...(isDirector ? [] : [{ label: PAGE_TITLE.school }]),
    );
  else if (route.page === "teacher")
    crumbs.push(
      { label: PAGE_TITLE.staff, route: { page: "staff" } },
      {
        label: PAGE_TITLE.teacher,
      },
    );
  else crumbs.push({ label: PAGE_TITLE[route.page] });
  const title = route.page === "school" && isDirector ? "Моя школа" : PAGE_TITLE[route.page];
  return (
    <div className="ambient-bg flex min-h-screen text-fg">
      <SideMenu route={route} items={items} onNavigate={navigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] backdrop-blur-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-70"
            style={{ background: "var(--grad-line)" }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 pr-4 pl-16 md:pr-8 md:pl-20">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <nav
                  aria-label="Хлебные крошки"
                  className="flex items-center gap-1.5 text-[12px] text-muted"
                >
                  {crumbs.map((c, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span>/</span>}
                      {c.route ? (
                        <button className="hover:text-accent" onClick={() => navigate(c.route!)}>
                          {c.label}
                        </button>
                      ) : (
                        <span className={i === crumbs.length - 1 ? "text-fg-2" : ""}>
                          {c.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
                <h1 className="mt-0.5 truncate text-[20px] font-semibold text-fg">{title}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Select
                ariaLabel="Год наблюдения"
                value={String(filters.year)}
                onChange={(v) => setFilters({ year: Number(v) })}
                options={dictionaries.years.map((y) => ({
                  value: String(y),
                  label: `${y} год`,
                }))}
              />
              {isDirector ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-muted"
                  title="Фильтр школы закреплён за вашей ролью"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 118 0v4" />
                  </svg>
                  {dictionaries.scopeSchool?.name ?? "Своя школа"}
                </span>
              ) : (
                <Select
                  ariaLabel="Округ"
                  value={filters.district ?? ""}
                  onChange={(v) => setFilters({ district: v || null })}
                  options={[
                    { value: "", label: "Все округа" },
                    ...dictionaries.districts.map((d) => ({
                      value: d,
                      label: d,
                    })),
                  ]}
                />
              )}
              <ThemeToggle />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 px-4 py-2 md:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-medium text-muted">Демо-роль:</span>
              <div
                className="inline-flex flex-wrap rounded-lg border border-line bg-surface-2 p-0.5"
                role="radiogroup"
                aria-label="Демо-роль"
              >
                {ROLES.map((r) => (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={user.role === r}
                    onClick={() => {
                      switchRole(r);
                      navigate({ page: "overview" });
                    }}
                    className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      user.role === r
                        ? "bg-surface text-accent-strong shadow-[var(--shadow-sm)]"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="tnum rounded-md bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent-strong">
                Год: {filters.year}
              </span>
              {filters.district && (
                <Chip label={filters.district} onRemove={() => setFilters({ district: null })} />
              )}
              {dictionaries.meta.isMock ? (
                <DemoTag />
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--glow-border)] bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong"
                  title={dictionaries.meta.origin}
                >
                  <span className="neon-dot h-1.5 w-1.5 rounded-full bg-accent" />
                  Реальные данные ДОНМ
                </span>
              )}
              <span className="hidden text-[11px] text-muted xl:inline">
                Данные:{" "}
                <span className="tnum font-medium text-fg-2">{dictionaries.meta.updatedAt}</span>
              </span>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto max-w-[1180px]">
            <PageRouter />
          </div>
        </main>
      </div>
    </div>
  );
}

function PageRouter() {
  const { route, navigate } = useApp();
  const { scope, can } = useSession();
  const needsRedirect = scope.kind === "school" && route.page === "schools";
  useEffect(() => {
    if (needsRedirect && scope.kind === "school") navigate({ page: "school", id: scope.schoolId });
  }, [needsRedirect, scope, navigate]);
  if (needsRedirect) return <PageSkeleton />;
  const perm = PAGE_PERMISSION[route.page];
  if (perm && !can(perm))
    return <ForbiddenState title="Недостаточно прав для просмотра этой страницы" />;
  switch (route.page) {
    case "overview":
      return <Overview />;
    case "schools":
      return <Schools />;
    case "school":
      if (scope.kind === "school" && route.id !== scope.schoolId)
        return (
          <ForbiddenState
            title="Недостаточно прав для просмотра этой школы"
            note="Роль «Директор школы» даёт доступ только к данным своей образовательной организации."
            action={
              <button
                className="text-[13px] font-medium text-accent hover:underline"
                onClick={() => navigate({ page: "school", id: scope.schoolId })}
              >
                Перейти к моей школе →
              </button>
            }
          />
        );
      return <SchoolProfile id={route.id} key={route.id} />;
    case "staff":
      return <Staff />;
    case "teacher":
      return <TeacherProfile id={route.id} key={route.id} />;
    case "dynamics":
      return <Dynamics />;
    case "mobility":
      return <Mobility />;
    case "forecast":
      return <Forecast />;
    case "calculator":
      return <Calculator />;
    case "analytics":
      return <Analytics />;
    case "data":
      return <DataModel />;
    case "monitoring":
      return <Monitoring />;
    case "not_found":
      return (
        <ForbiddenState title="Страница не найдена" note={`Адрес ${route.path} не существует.`} />
      );
  }
}

const MENU_WIDTH = 272;

/**
 * Выдвижное меню: в свёрнутом виде видна только кнопка «☰». Наведение (или клик
 * на сенсорных устройствах) выдвигает полупрозрачную панель поверх страницы;
 * кнопка при этом оказывается в правом верхнем углу панели.
 */
function SideMenu({
  route,
  items,
  onNavigate,
}: {
  route: Route;
  items: NavItem[];
  onNavigate: (r: Route) => void;
}) {
  const { user } = useSession();
  const { dictionaries } = useApp();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  };

  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && hide()}
    >
      <button
        type="button"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={open}
        aria-controls="side-menu"
        onClick={() => setOpen((o) => !o)}
        className={`fixed top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 ease-out ${
          open
            ? "border-[var(--glow-border)] bg-surface-2 text-accent shadow-[0_0_18px_-4px_var(--glow-strong)]"
            : "border-line bg-[var(--menu-bg)] text-fg-2 backdrop-blur-xl hover:text-accent hover:shadow-[0_0_18px_-4px_var(--glow-strong)]"
        }`}
        style={{ left: open ? MENU_WIDTH - 52 : 12 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path
            d="M4 6h16"
            className="transition-transform duration-300"
            style={{
              transformOrigin: "12px 6px",
              transform: open ? "translateX(4px) scaleX(0.6)" : undefined,
            }}
          />
          <path d="M4 12h16" />
          <path
            d="M4 18h16"
            className="transition-transform duration-300"
            style={{
              transformOrigin: "12px 18px",
              transform: open ? "translateX(4px) scaleX(0.6)" : undefined,
            }}
          />
        </svg>
      </button>

      {/* Невидимая зона у левого края: подвести курсор к краю экрана тоже открывает меню */}
      {!open && <div aria-hidden className="fixed top-16 bottom-0 left-0 z-40 w-2" />}

      <aside
        id="side-menu"
        aria-hidden={!open}
        className={`menu-panel fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-[var(--glow-border)] shadow-[8px_0_40px_-12px_var(--glow-strong)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
        style={{ width: MENU_WIDTH }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px"
          style={{ background: "var(--grad-line)", opacity: 0.6 }}
        />
        <nav className="mt-[72px] flex-1 overflow-y-auto px-3 py-2" aria-label="Основная навигация">
          {items.map((item) => {
            const active = item.matches.includes(route.page);
            return (
              <button
                key={item.key}
                tabIndex={open ? 0 : -1}
                onClick={() => onNavigate(item.route)}
                aria-current={active ? "page" : undefined}
                className={`relative mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium transition-all ${
                  active ? "text-fg" : "text-fg-2 hover:bg-[var(--surface-hover)] hover:text-fg"
                }`}
                style={
                  active
                    ? {
                        background: "var(--grad-accent-soft)",
                        boxShadow: "inset 0 0 0 1px var(--glow-border)",
                      }
                    : undefined
                }
              >
                {active && (
                  <span
                    aria-hidden
                    className="grad-accent absolute top-2 bottom-2 left-0 w-[3px] rounded-full shadow-[0_0_10px_var(--glow-strong)]"
                  />
                )}
                <span
                  className={
                    active ? "text-accent drop-shadow-[0_0_6px_var(--glow-strong)]" : "text-faint"
                  }
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center gap-2.5 py-1">
            <div className="grad-accent flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white shadow-[0_0_12px_-2px_var(--glow-strong)]">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-medium text-fg">{user.name}</div>
              <div className="truncate text-[11px] text-muted">{ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          {dictionaries.scopeSchool && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-[11.5px] text-fg-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 118 0v4" />
              </svg>
              <span className="truncate">{dictionaries.scopeSchool.name}</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
