import { describe, expect, it } from "vitest";
import type { User } from "../../domain/user";
import { AccessDeniedError } from "../contracts/errors";
import { createMockDataSource } from "./mockDataSource";
import { getMockIndex } from "./mockDataset";

const index = getMockIndex();

const [own, other] = index.ds.schools;

const head: User = { id: "h", name: "H", role: "education_head" };

const director: User = {
  id: "d",
  name: "D",
  role: "school_director",
  schoolId: own.id,
};

const latestYear = index.ds.years[index.ds.years.length - 1];

const filters = { year: latestYear, district: null };

describe("director scope (имитация серверной авторизации)", () => {
  const dir = createMockDataSource(director);
  const sys = createMockDataSource(head);
  it("список школ директора содержит только его школу", async () => {
    const rows = await dir.schools.list(filters);
    expect(rows.map((r) => r.schoolId)).toEqual([own.id]);
    expect((await sys.schools.list(filters)).length).toBe(index.ds.schools.length);
  });
  it("фильтр округа не расширяет scope директора", async () => {
    const rows = await dir.schools.list({
      year: latestYear,
      district: other.district,
    });
    expect(rows.map((r) => r.schoolId)).toEqual([own.id]);
  });
  it("карточка чужой школы → 403 (IDOR), даже для несуществующего id", async () => {
    await expect(dir.schools.getProfile(other.id, latestYear)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await expect(dir.schools.getProfile("sch-does-not-exist", latestYear)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await expect(dir.schools.getProfile(own.id, latestYear)).resolves.toMatchObject({
      school: { id: own.id },
    });
  });
  it("реестр педагогов директора — только своя школа", async () => {
    const page = await dir.teachers.list({
      ...filters,
      page: 1,
      pageSize: 1000,
      search: null,
      subject: null,
      qualificationCategory: null,
      outcome: null,
      ageMin: null,
      ageMax: null,
      pedExpMin: null,
      pedExpMax: null,
    });
    expect(page.total).toBeGreaterThan(0);
    expect(new Set(page.items.map((t) => t.schoolId))).toEqual(new Set([own.id]));
  });
  it("профиль педагога чужой школы → 403", async () => {
    const foreign = index.ds.teacherSnapshots.find(
      (s) =>
        s.schoolId !== own.id &&
        !(index.snapshotsByTeacher.get(s.teacherId) ?? []).some((x) => x.schoolId === own.id),
    )!;
    await expect(dir.teachers.getProfile(foreign.teacherId)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });
  it("системные агрегаты недоступны директору; сводка считается только по своей школе", async () => {
    await expect(dir.dashboard.getDistrictBreakdown(filters)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    const s = await dir.dashboard.getSummary(filters);
    expect(s.schoolCount).toBe(1);
    expect(s.current.teacherCount).toBe(
      index.snapshotsByYear.get(latestYear)!.filter((x) => x.schoolId === own.id).length,
    );
  });
  it("прогноз по чужой школе из справочника запрещён", async () => {
    const { snapshotToForecastInput } = await import("../../services/forecast/featureMapping");
    const { validateForecastInput } = await import("../../services/forecast/validation");
    const input = index.ds.teacherSnapshots
      .filter((s) => s.schoolId === own.id)
      .map((s) => snapshotToForecastInput(s, [], []))
      .find((i) => validateForecastInput(i).length === 0)!;
    await expect(
      dir.forecast.predict({
        ...input,
        school: { mode: "reference", schoolId: other.id },
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(dir.forecast.predict(input)).resolves.toMatchObject({
      isMock: true,
    });
  });
});

describe("график нагрузки (стаж × число предметов)", () => {
  it("директор видит только педагогов своей школы; критерий — стаж < 2 и ≥ 5 предметов", async () => {
    const dir = createMockDataSource(director);
    const sys = createMockDataSource(head);
    const own = await dir.analytics.getLoadScatter(filters, false);
    const all = await sys.analytics.getLoadScatter(filters, true);
    expect(own.total).toBeGreaterThan(0);
    expect(new Set(own.points.map((p) => p.schoolName))).toEqual(
      new Set([index.schoolById.get(director.schoolId!)!.name]),
    );
    expect(all.years).toEqual(index.ds.years);
    for (const p of all.points) expect(p.critical).toBe(p.x < 2 && p.y >= 5);
    expect(all.criticalCount).toBe(all.points.filter((p) => p.critical).length);
  });
});

describe("mobility aggregation on mock dataset", () => {
  it("распределение за период согласовано с исходами", async () => {
    const sys = createMockDataSource(head);
    const s = await sys.dashboard.getSummary(filters);
    const period = index.ds.periods.find((p) => p.toYear === latestYear)!;
    const outcomes = index.outcomesByFromYear.get(period.fromYear)!;
    expect(s.mobility!.total).toBe(outcomes.length);
    expect(s.mobility!.counts.leave).toBe(outcomes.filter((o) => o.status === 2).length);
    expect(s.mobility!.counts.move).toBe(outcomes.filter((o) => o.status === 1).length);
  });
  it("для первого года среза мобильность не наблюдается", async () => {
    const sys = createMockDataSource(head);
    const s = await sys.dashboard.getSummary({
      year: index.ds.years[0],
      district: null,
    });
    expect(s.mobility).toBeNull();
  });
});
