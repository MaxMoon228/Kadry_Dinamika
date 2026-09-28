import { describe, expect, it } from "vitest";
import { createMockDataSource } from "../../data/mock/mockDataSource";
import { getMockIndex } from "../../data/mock/mockDataset";
import { ValidationError } from "../../data/contracts/errors";
import { FORECAST_INPUT_SCHEMA_VERSION, type ForecastInput } from "../../domain/forecast";
import { MOBILITY_KEYS } from "../../domain/mobility";
import { MOCK_BASE_PROBABILITIES, mockPredict } from "./mockModel";
import { validateForecastInput, validateForecastResult } from "./validation";

const school = getMockIndex().ds.schools[0];

const valid: ForecastInput = {
  schemaVersion: FORECAST_INPUT_SCHEMA_VERSION,
  referenceYear: 2024,
  teacher: {
    gender: "female",
    age: 31,
    mainPosition: "Учитель",
    activityDirection: "Математика",
    academicDegree: null,
    qualificationCategory: "Первая",
    qualificationAssignedAt: "2021-05-15",
    totalExperienceYears: 8,
    pedagogicalExperienceYears: 6,
    subjects: ["Математика"],
    parallels: ["7", "8"],
    isClassTeacher: false,
    preprofessionalDirection: null,
  },
  education: [
    {
      educationType: "Высшее образование",
      specialization: "Математика",
      qualification: "Учитель математики",
      graduationYear: 2016,
    },
  ],
  training: {
    programCount: 1,
    totalHours: 36,
    hasRetraining: false,
    lastDocumentDate: "2023-05-10",
  },
  school: { mode: "reference", schoolId: school.id },
};

describe("ForecastInput validation", () => {
  it("валидный профиль проходит", () => {
    expect(validateForecastInput(valid)).toEqual([]);
  });
  it("ловит несогласованный стаж и возраст", () => {
    const e = validateForecastInput({
      ...valid,
      teacher: {
        ...valid.teacher,
        pedagogicalExperienceYears: 10,
        totalExperienceYears: 8,
      },
    });
    expect(e.map((x) => x.field)).toContain("teacher.pedagogicalExperienceYears");
    const e2 = validateForecastInput({
      ...valid,
      teacher: { ...valid.teacher, age: 16 },
    });
    expect(e2.map((x) => x.field)).toContain("teacher.age");
  });
  it("запрещает даты позже среза (утечка будущего)", () => {
    const e = validateForecastInput({
      ...valid,
      training: { ...valid.training, lastDocumentDate: "2025-02-01" },
    });
    expect(e.map((x) => x.field)).toContain("training.lastDocumentDate");
  });
  it("проверяет ручные школьные признаки", () => {
    const e = validateForecastInput({
      ...valid,
      school: {
        mode: "manual",
        district: "ЦАО",
        buildingCount: 0,
        studentCount: 500,
        teacherCount: 40,
      },
    });
    expect(e.map((x) => x.field)).toContain("school.buildingCount");
  });
});

describe("ForecastResult contract (mock)", () => {
  const ds = createMockDataSource({ id: "a", name: "A", role: "analyst" });
  it("вероятности трёх классов суммируются в 1, predictedClass = argmax", async () => {
    const r = await ds.forecast.predict(valid);
    expect(validateForecastResult(r)).toEqual([]);
    expect(r.isMock).toBe(true);
    expect(r.modelVersion).toBeTruthy();
    expect(Object.keys(r.probabilities).sort()).toEqual(["leave", "move", "stay"]);
  });
  it("невалидный вход → ValidationError", async () => {
    await expect(
      ds.forecast.predict({
        ...valid,
        teacher: { ...valid.teacher, subjects: [] },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
  it("вклады признаков (Шепли) в сумме дают итог минус базовую вероятность", () => {
    const { probabilities, contributions } = mockPredict({
      age: 62,
      pedagogicalExperienceYears: 2,
      qualificationCategory: null,
      isClassTeacher: false,
      trainingCount: 0,
      hasRetraining: false,
      studentsPerTeacher: 18,
      preprofessional: false,
    });
    for (const k of MOBILITY_KEYS) {
      const sum = contributions.reduce((a, c) => a + c.impact[k], 0);
      expect(sum).toBeCloseTo(probabilities[k] - MOCK_BASE_PROBABILITIES[k], 10);
    }
  });
  it("validateForecastResult обнаруживает нарушения контракта", () => {
    const bad = {
      probabilities: { stay: 0.5, move: 0.3, leave: 0.3 },
      predictedClass: 2,
      modelVersion: "",
      featureSchemaVersion: "1.0",
    } as never;
    const problems = validateForecastResult(bad);
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});
