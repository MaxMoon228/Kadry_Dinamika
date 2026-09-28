/**
 * Политика доступа (RBAC + school scope). Используется:
 *  - UI — для навигации, скрытия фильтров и guard-ов маршрутов (только UX, не защита данных);
 *  - mock-backend — для имитации серверной авторизации.
 * В production решение об авторизации принимает backend (docs/AUTHORIZATION_MODEL.md).
 */

import type { SchoolId } from "../domain/common";
import type { AccessScope, Role, User } from "../domain/user";

export type Permission =
  | "system:view"
  | "schools:list"
  | "school:view"
  | "teachers:view"
  | "analytics:view"
  | "forecast:use"
  | "model:view_summary"
  | "model:view_technical"
  | "model:monitoring"
  | "data:catalog"
  | "model:retrain"; // агрегаты по всей системе, округа // список всех школ // карточка школы (в пределах scope) // реестр и профили педагогов (в пределах scope) // метрики, признаки, распределения // только backend/admin CLI, во frontend не выдаётся

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  education_head: [
    "system:view",
    "schools:list",
    "school:view",
    "teachers:view",
    "analytics:view",
    "forecast:use",
    "model:view_summary",
    "data:catalog",
  ],
  analyst: [
    "system:view",
    "schools:list",
    "school:view",
    "teachers:view",
    "analytics:view",
    "forecast:use",
    "model:view_summary",
    "model:view_technical",
    "model:monitoring",
    "data:catalog",
  ],
  school_director: [
    "school:view",
    "teachers:view",
    "analytics:view",
    "forecast:use",
    "model:view_summary",
  ],
};

export function assertValidUser(user: User): void {
  if (user.role === "school_director" && !user.schoolId) {
    throw new Error("Для роли «Директор школы» обязателен schoolId");
  }
}

export function scopeOf(user: User): AccessScope {
  assertValidUser(user);
  return user.role === "school_director"
    ? { kind: "school", schoolId: user.schoolId }
    : { kind: "system" };
}

export function can(user: User, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function canViewSchool(scope: AccessScope, schoolId: SchoolId): boolean {
  return scope.kind === "system" || scope.schoolId === schoolId;
}

/** Ограничивает набор школ scope-ом пользователя. */

export function restrictSchoolIds(scope: AccessScope, all: SchoolId[]): SchoolId[] {
  return scope.kind === "system" ? all : all.filter((id) => id === scope.schoolId);
}

export function isSchoolScoped(
  scope: AccessScope,
): scope is { kind: "school"; schoolId: SchoolId } {
  return scope.kind === "school";
}
