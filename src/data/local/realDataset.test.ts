// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { User } from "../../domain/user";
import { createMockDataSource } from "../mock/mockDataSource";
import { DatasetIndex, setActiveIndex } from "../mock/mockDataset";
import { decodeRealDataset, type RealDatasetFile } from "./realDataset";

/**
 * Интеграционная проверка на реальном файле public/data/real-dataset.json
 * (пропускается, если файл не собран).
 */

const FILE = path.resolve(__dirname, "../../../public/data/real-dataset.json");
const exists = fs.existsSync(FILE);

describe.skipIf(!exists)("реальный датасет (public/data)", () => {
  const ds = exists
    ? decodeRealDataset(JSON.parse(fs.readFileSync(FILE, "utf-8")) as RealDatasetFile)
    : null!;
  const index = exists ? new DatasetIndex(ds) : null!;

  it("совпадает с итоговой таблицей ноутбука «Неделя 4»", () => {
    expect(ds.teacherSnapshots.length).toBe(52723);
    expect(ds.features?.length).toBe(52723);
    expect(ds.outcomes.length).toBe(34790);
    expect(ds.schools.length).toBe(266);
    expect(ds.years).toEqual([2022, 2023, 2024]);
    expect(ds.periods.map((p) => p.fromYear)).toEqual([2022, 2023]);
    const keys = new Set(ds.teacherSnapshots.map((s) => `${s.teacherId}|${s.year}`));
    expect(keys.size).toBe(52723);
  });

  it("кодировка target переведена в классы сайта (1 — перешёл, 2 — ушёл)", () => {
    for (const o of ds.outcomes.slice(0, 5000)) {
      const f = index.features(o.teacherId, o.period.fromYear)!;
      expect({ 0: 0, 1: 2, 2: 1 }[f.target as 0 | 1 | 2]).toBe(o.status);
    }
    const leave = ds.outcomes.filter((o) => o.status === 2).length / ds.outcomes.length;
    expect(leave).toBeGreaterThan(0.12);
    expect(leave).toBeLessThan(0.14);
  });

  it("все репозитории отвечают на реальных данных за разумное время", async () => {
    setActiveIndex(index);
    const users: User[] = [
      { id: "h", name: "h", role: "education_head" },
      { id: "d", name: "d", role: "school_director", schoolId: ds.schools[0].id },
    ];
    try {
      for (const user of users) {
        const src = createMockDataSource(user, 0, "local");
        const f = { year: 2023, district: null };
        const timings: Record<string, number> = {};
        const time = async <T>(name: string, fn: () => Promise<T>) => {
          const t0 = performance.now();
          const r = await fn();
          timings[name] = Math.round(performance.now() - t0);
          return r;
        };
        const dict = await time("dictionaries", () => src.dictionaries.get());
        expect(dict.meta.isMock).toBe(false);
        await time("summary", () => src.dashboard.getSummary(f));
        if (user.role !== "school_director")
          await time("districts", () => src.dashboard.getDistrictBreakdown(f));
        await time("schools", () => src.schools.list(f));
        await time("schoolProfile", () => src.schools.getProfile(ds.schools[0].id, 2023));
        const page = await time("teachers", () =>
          src.teachers.list({
            ...f,
            page: 1,
            pageSize: 25,
            search: null,
            subject: null,
            qualificationCategory: null,
            outcome: null,
            ageMin: null,
            ageMax: null,
            pedExpMin: null,
            pedExpMax: null,
          }),
        );
        const profile = await time("teacherProfile", () =>
          src.teachers.getProfile(page.items[0].teacherId, 2023),
        );
        expect(profile.datasetFeatures).not.toBeNull();
        await time("composition", () => src.analytics.getComposition(f));
        await time("dynamics", () => src.analytics.getDynamics(f, null));
        await time("mobility", () => src.analytics.getMobilityOverview(f));
        await time("heatmap", () => src.analytics.getHeatmap(f));
        const load = await time("loadScatter", () => src.analytics.getLoadScatter(f, false));
        const loadAll = await time("loadScatterAll", () => src.analytics.getLoadScatter(f, true));
        if (user.role === "education_head") {
          expect(loadAll.total).toBe(52723);
          expect(load.criticalCount).toBeGreaterThan(0);
        }
        await time("importance", () => src.model.getGlobalImportance());
        await time("forecastOverview", () => src.model.getForecastOverview(f, "age_group"));
        console.log(user.role, JSON.stringify(timings));
        for (const [k, v] of Object.entries(timings)) expect(v, k).toBeLessThan(8000);
      }
    } finally {
      setActiveIndex(null);
    }
  }, 120_000);
});
