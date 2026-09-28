import { can, canViewSchool, scopeOf, type Permission } from "../../auth/access";
import type { SchoolId, Year } from "../../domain/common";
import type { MobilityOutcome, MobilityPeriod } from "../../domain/mobility";
import type { TeacherYearSnapshot } from "../../domain/teacher";
import type { AccessScope, User } from "../../domain/user";
import type { GlobalFilters } from "../contracts/dto";
import { AccessDeniedError } from "../contracts/errors";
import { periodEndingIn } from "../selectors/mobility";
import { getMockIndex, type DatasetIndex } from "./mockDataset";

/**
 * Контекст «mock-сервера»: датасет + текущий пользователь. Все выборки проходят через
 * scope-фильтры так же, как SQL-запросы с WHERE school_id = :scope на backend.
 */

export class MockContext {
  readonly scope: AccessScope;
  constructor(
    readonly user: User,
    readonly index: DatasetIndex = getMockIndex(),
    readonly latencyMs = 0,
  ) {
    this.scope = scopeOf(user);
  }
  async respond<T>(fn: () => T): Promise<T> {
    if (this.latencyMs > 0)
      await new Promise((r) => setTimeout(r, this.latencyMs * (0.6 + Math.random() * 0.8)));
    return fn();
  }
  require(permission: Permission): void {
    if (!can(this.user, permission)) throw new AccessDeniedError();
  }
  /** Школы в scope пользователя с учётом фильтра округа (для директора округ игнорируется). */
  schoolIds(filters?: Pick<GlobalFilters, "district">): SchoolId[] {
    const all = this.index.ds.schools;
    if (this.scope.kind === "school") {
      const own = this.scope.schoolId;
      return all.filter((s) => s.id === own).map((s) => s.id);
    }
    const d = filters?.district ?? null;
    return all.filter((s) => d == null || s.district === d).map((s) => s.id);
  }
  canViewSchool(id: SchoolId): boolean {
    return canViewSchool(this.scope, id);
  }
  snapshots(
    year: Year,
    filters?: Pick<GlobalFilters, "district">,
    schoolIds?: SchoolId[],
  ): TeacherYearSnapshot[] {
    const ids = new Set(schoolIds ?? this.schoolIds(filters));
    return (this.index.snapshotsByYear.get(year) ?? []).filter((s) => ids.has(s.schoolId));
  }
  /** Исходы периода по педагогам, работавшим в fromYear в школах scope. */
  outcomes(
    period: MobilityPeriod,
    filters?: Pick<GlobalFilters, "district">,
    schoolIds?: SchoolId[],
  ): MobilityOutcome[] {
    const ids = new Set(schoolIds ?? this.schoolIds(filters));
    return (this.index.outcomesByFromYear.get(period.fromYear) ?? []).filter((o) =>
      ids.has(o.fromSchoolId),
    );
  }
  periodFor(year: Year): MobilityPeriod | null {
    return periodEndingIn(this.index.ds.periods, year);
  }
}
