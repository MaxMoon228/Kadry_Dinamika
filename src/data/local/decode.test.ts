import { describe, expect, it } from "vitest";
import { DatasetIndex } from "../mock/mockDataset";
import { decodeRealDataset, REAL_DATASET_FORMAT, type RealDatasetFile } from "./realDataset";

/** Синтетический мини-файл в формате экспорта build_real_dataset.py (без реальных данных). */

function file(): RealDatasetFile {
  const col = (...v: number[]) => v;
  // строки: 0 Южный округ, 1 Учитель, 2 Математика, 3 Высшая, 4 учитель, 5 активно, 6 высшая, 7 не_найдено, 8 математика и информатика, 9 Высшее образование
  return {
    format: REAL_DATASET_FORMAT,
    version: "test",
    generatedAt: "2026-01-01",
    source: "test",
    years: [2022, 2023, 2024],
    strings: [
      "Южный округ",
      "Учитель",
      "Математика",
      "Высшая",
      "учитель",
      "активно",
      "высшая",
      "не_найдено",
      "математика и информатика",
      "Высшее образование",
    ],
    teachers: ["a", "b"],
    schools: [
      [7, 0, 3, 900],
      [12, 0, 1, 400],
    ],
    snapshots: {
      t: col(0, 0, 1),
      y: col(2022, 2023, 2022),
      s: col(7, 12, 7),
      pos: col(1, 1, 1),
      dir: col(-1, -1, -1),
      sex: col(0, 0, 1),
      age: col(30, 31, 50),
      deg: col(-1, -1, -1),
      cat: col(3, 3, -1),
      catFrom: col(2020, 2020, -1),
      catTo: col(2025, 2025, -1),
      expAll: col(5, 6, 25),
      expPed: col(1, 2, 20),
      cls: col(1, 0, -1),
      asg: [[2 * 16 + 5, 2 * 16 + 6], [2 * 16 + 15], []],
      posCat: col(4, 4, 4),
      degCat: col(7, 7, 7),
      catCat: col(6, 6, 7),
      catActive: col(5, 5, -1),
      expOther: col(4, 4, 5),
      nSubj: col(1, 1, 0),
      minPar: col(5, -1, -1),
      maxPar: col(6, -1, -1),
      nPar: col(2, 0, 0),
      exam: col(0, 0, 0),
      subjGroup: col(8, 8, -1),
      pedEdu: col(1, 1, 0),
      highEdu: col(9, 9, -1),
      nCourses: col(0, 1, 0),
      hours: col(0, 16, 0),
      nGia: col(0, 1, 0),
      hasPP: col(0, 0, 0),
      // ноутбук: a 2022 → перевёлся (2), b 2022 → ушёл (1)
      target: col(2, -1, 1),
      status: col(1, -1, 2),
      toSchool: col(12, -1, -1),
    },
    education: { t: col(0), type: col(9), org: col(-1), date: col(2015), spec: col(2), qual: col(-1), first: col(2022) },
    training: { t: col(0), name: col(2), pp: col(0), hours: col(16), year: col(2023), gia: col(1) },
    report: {
      rawRowCounts: { teachers: 3, education: 1, training: 1, schools: 2 },
      exactDuplicatesRemoved: { teachers: 0, education: 0, training: 0, schools: 0 },
      cumulativeEducationCollapsed: 0,
      conflictingTeacherYears: 0,
      multiSchoolTeacherYears: 0,
      unknownSchoolRows: 0,
      missingValues: {},
      unknownCategoryValues: [],
    },
  };
}

describe("decodeRealDataset", () => {
  const ds = decodeRealDataset(file());
  const index = new DatasetIndex(ds);

  it("школы — суррогатный id по номеру, сортировка по номеру", () => {
    expect(ds.schools.map((s) => [s.id, s.name])).toEqual([
      ["sch-7", "Школа № 7"],
      ["sch-12", "Школа № 12"],
    ]);
    expect(index.schoolYear("sch-7", 2022)).toMatchObject({ teacherCount: 2, studentCount: 900 });
  });

  it("срезы: предметы × параллели, категория, даты-годы", () => {
    const a = index.snapshot("a", 2022)!;
    expect(a.assignments).toEqual([
      { subject: "Математика", parallel: "5" },
      { subject: "Математика", parallel: "6" },
    ]);
    expect(index.snapshot("a", 2023)!.assignments).toEqual([{ subject: "Математика", parallel: null }]);
    expect(a.qualificationCategory).toBe("Высшая");
    expect(a.qualificationValidUntil).toBe("2025-01-01");
    expect(a.gender).toBe("female");
    expect(index.snapshot("b", 2022)!.isClassTeacher).toBeNull();
  });

  it("исходы в кодировке сайта; периоды без исходов не публикуются", () => {
    expect(ds.periods).toEqual([{ fromYear: 2022, toYear: 2023 }]);
    expect(index.outcomeByKey.get("a|2022")).toMatchObject({ status: 1, toSchoolId: "sch-12" });
    expect(index.outcomeByKey.get("b|2022")).toMatchObject({ status: 2, toSchoolId: null });
    expect(index.features("b", 2022)!.target).toBe(1);
  });

  it("метаданные: реальный набор без предпроф. классов и организатора ПК", () => {
    expect(index.meta.isMock).toBe(false);
    expect(index.isAvailable("preprofessional")).toBe(false);
    expect(ds.training[0]).toMatchObject({ programType: "ПК", documentDate: "2023-01-01", provider: null });
  });

  it("отклоняет неизвестный формат", () => {
    expect(() => decodeRealDataset({ ...file(), format: "other" })).toThrow();
  });
});
