import type { ReactNode } from "react";
import type { Permission } from "../auth/access";
import type { AccessScope } from "../domain/user";
import type { PageKey, Route } from "./router";

function icon(d: string) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  overview: icon("M4 13h6V4H4v9zm0 7h6v-5H4v5zm8 0h6V11h-6v9zm0-16v5h6V4h-6z"),
  schools: icon(
    "M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01",
  ),
  staff: icon(
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  ),
  dynamics: icon("M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"),
  mobility: icon("M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"),
  forecast: icon("M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2"),
  calculator: icon(
    "M9 7h6M9 11h6M9 15h4M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z",
  ),
  analytics: icon("M3 3v18h18M8 13l3 3 3-4 4 5"),
  data: icon(
    "M12 3C7 3 3 4.5 3 6.5S7 10 12 10s9-1.5 9-3.5S17 3 12 3zM3 6.5v11C3 19.5 7 21 12 21s9-1.5 9-3.5v-11M3 12c0 2 4 3.5 9 3.5s9-1.5 9-3.5",
  ),
  monitoring: icon("M22 12h-4l-3 9L9 3l-3 9H2"),
};

export interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
  route: Route;
  /** Какие страницы подсвечивают этот пункт. */
  matches: PageKey[];
}

/** Права, необходимые для открытия страницы (UX-guard; данные защищает backend). */

export const PAGE_PERMISSION: Partial<Record<PageKey, Permission>> = {
  schools: "schools:list",
  school: "school:view",
  staff: "teachers:view",
  teacher: "teachers:view",
  forecast: "forecast:use",
  calculator: "forecast:use",
  analytics: "analytics:view",
  data: "data:catalog",
  monitoring: "model:monitoring",
};

export const PAGE_TITLE: Record<PageKey, string> = {
  overview: "Обзор",
  schools: "Школы",
  school: "Карточка школы",
  staff: "Педагогический состав",
  teacher: "Профиль педагога",
  dynamics: "Кадровая динамика",
  mobility: "Трудовая мобильность",
  forecast: "Прогноз мобильности",
  calculator: "Калькулятор прогноза",
  analytics: "Аналитика",
  data: "Данные и модель",
  monitoring: "Мониторинг модели",
  not_found: "Страница не найдена",
};

export function navItems(scope: AccessScope, can: (p: Permission) => boolean): NavItem[] {
  const items: NavItem[] = [
    {
      key: "overview",
      label: scope.kind === "school" ? "Обзор школы" : "Обзор",
      icon: ICONS.overview,
      route: { page: "overview" },
      matches: ["overview"],
    },
  ];
  if (scope.kind === "school")
    items.push({
      key: "my-school",
      label: "Моя школа",
      icon: ICONS.schools,
      route: { page: "school", id: scope.schoolId },
      matches: ["school"],
    });
  else if (can("schools:list"))
    items.push({
      key: "schools",
      label: "Школы",
      icon: ICONS.schools,
      route: { page: "schools" },
      matches: ["schools", "school"],
    });
  const rest: (NavItem & { perm?: Permission })[] = [
    {
      key: "staff",
      label: "Педагогический состав",
      icon: ICONS.staff,
      route: { page: "staff" },
      matches: ["staff", "teacher"],
      perm: "teachers:view",
    },
    {
      key: "dynamics",
      label: "Кадровая динамика",
      icon: ICONS.dynamics,
      route: { page: "dynamics" },
      matches: ["dynamics"],
    },
    {
      key: "mobility",
      label: "Трудовая мобильность",
      icon: ICONS.mobility,
      route: { page: "mobility" },
      matches: ["mobility"],
    },
    {
      key: "forecast",
      label: "Прогноз мобильности",
      icon: ICONS.forecast,
      route: { page: "forecast" },
      matches: ["forecast"],
      perm: "forecast:use",
    },
    {
      key: "calculator",
      label: "Калькулятор прогноза",
      icon: ICONS.calculator,
      route: { page: "calculator" },
      matches: ["calculator"],
      perm: "forecast:use",
    },
    {
      key: "analytics",
      label: "Аналитика",
      icon: ICONS.analytics,
      route: { page: "analytics" },
      matches: ["analytics"],
      perm: "analytics:view",
    },
    {
      key: "data",
      label: "Данные и модель",
      icon: ICONS.data,
      route: { page: "data" },
      matches: ["data"],
      perm: "data:catalog",
    },
    {
      key: "monitoring",
      label: "Мониторинг модели",
      icon: ICONS.monitoring,
      route: { page: "monitoring" },
      matches: ["monitoring"],
      perm: "model:monitoring",
    },
  ];
  return [...items, ...rest.filter((i) => !i.perm || can(i.perm))];
}
