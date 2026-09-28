import { describe, expect, it } from "vitest";
import type { RawDataset, RawTeacherRow } from "../contracts/raw";
import { normalizeCategory, normalizeDataset, parseDate, schoolIdFromName } from "./normalize";

function row(
  year: number,
  id: string,
  school: string,
  subject: string,
  parallel: string,
  extra: Partial<RawTeacherRow> = {},
): RawTeacherRow {
  return {
    Год: String(year),
    Идентификатор: id,
    "Краткое наименование образовательной организации": school,
    "Основная должность": "Учитель",
    "Направление деятельности": subject,
    Пол: "Ж",
    Возраст: "40",
    "Учёная степень": null,
    "Квалификационная категория": "Высшая категория",
    "Дата присвоения квалификационной категории": "15.03.2020",
    "Срок действия квалификационной категории": null,
    "Общий стаж работы": "18",
    "Стаж педагогической работы": "15",
    Предмет: subject,
    Параллель: parallel,
    "Преподаёт в предпрофессиональных классах": null,
    "Имеет классное руководство": "Нет",
    ...extra,
  };
}

const schools = (year: number) => [
  {
    Год: String(year),
    Школа: "Школа А",
    Округ: "ЦАО",
    "Количество зданий": "2",
    "Общая численность контингента": "1000",
  },
  {
    Год: String(year),
    Школа: "Школа Б",
    Округ: "САО",
    "Количество зданий": "1",
    "Общая численность контингента": "600",
  },
];

const raw: RawDataset = {
  schools: [...schools(2022), ...schools(2023)],
  teachers: [
    // T1 — два предмета × две параллели → 4 строки, остаётся в школе А
    row(2022, "T1", "Школа А", "Математика", "5"),
    row(2022, "T1", "Школа А", "Математика", "6"),
    row(2022, "T1", "Школа А", "Информатика", "7"),
    row(2022, "T1", "Школа А", "Информатика", "7"), // точный дубль
    row(2023, "T1", "Школа А", "Математика", "6"),

    // T2 — переходит из А в Б
    row(2022, "T2", "Школа А", "История", "9"),
    row(2023, "T2", "Школа Б", "История", "9"),

    // T3 — уходит из системы
    row(2022, "T3", "Школа Б", "Химия", "10"),
  ],
  education: [
    // накопительный итог: одна запись повторена в 2022 и 2023
    {
      Год: "2022",
      Идентификатор: "T1",
      "Тип образования": "Высшее образование",
      "Наименование учебного заведения": "МПГУ",
      "Дата окончания": "2005-06-30",
      Специализация: "Математика",
      Квалификация: "Учитель математики",
    },
    {
      Год: "2023",
      Идентификатор: "T1",
      "Тип образования": "Высшее образование",
      "Наименование учебного заведения": "МПГУ",
      "Дата окончания": "2005-06-30",
      Специализация: "Математика",
      Квалификация: "Учитель математики",
    },
  ],
  training: [],
};

describe("normalizeDataset", () => {
  const ds = normalizeDataset(raw);
  it("схлопывает строки «предмет × параллель» в один срез педагог-год", () => {
    const t1 = ds.teacherSnapshots.filter((s) => s.teacherId === "T1" && s.year === 2022);
    expect(t1).toHaveLength(1);
    expect(t1[0].assignments).toEqual([
      { subject: "Математика", parallel: "5" },
      { subject: "Математика", parallel: "6" },
      { subject: "Информатика", parallel: "7" },
    ]);
    expect(ds.report.exactDuplicatesRemoved.teachers).toBe(1);
  });
  it("нормализует типы и справочные значения", () => {
    const t1 = ds.teacherSnapshots.find((s) => s.teacherId === "T1" && s.year === 2022)!;
    expect(t1.gender).toBe("female");
    expect(t1.age).toBe(40);
    expect(t1.qualificationCategory).toBe("Высшая");
    expect(t1.qualificationAssignedAt).toBe("2020-03-15");
    expect(t1.isClassTeacher).toBe(false);
  });
  it("строит трёхклассовую целевую переменную по соседним срезам", () => {
    expect(ds.periods).toEqual([{ fromYear: 2022, toYear: 2023 }]);
    const status = Object.fromEntries(ds.outcomes.map((o) => [o.teacherId, o.status]));
    expect(status).toEqual({ T1: 0, T2: 1, T3: 2 });
    const t2 = ds.outcomes.find((o) => o.teacherId === "T2")!;
    expect(t2.toSchoolId).toBe(schoolIdFromName("Школа Б"));
  });
  it("дедуплицирует накопительные записи образования", () => {
    expect(ds.education).toHaveLength(1);
    expect(ds.education[0].firstSeenYear).toBe(2022);
    expect(ds.report.cumulativeEducationCollapsed).toBe(1);
  });
  it("считает teacherCount школы как derived-показатель", () => {
    const a2022 = ds.schoolSnapshots.find(
      (s) => s.schoolId === schoolIdFromName("Школа А") && s.year === 2022,
    )!;
    expect(a2022.teacherCount).toBe(2);
    expect(a2022.studentCount).toBe(1000);
  });
});

describe("primitives", () => {
  it("parseDate поддерживает ISO и DD.MM.YYYY", () => {
    expect(parseDate("2021-09-01")).toBe("2021-09-01");
    expect(parseDate("1.9.2021")).toBe("2021-09-01");
    expect(parseDate("—")).toBeNull();
  });
  it("normalizeCategory сводит варианты написания", () => {
    expect(normalizeCategory("Первая категория").value).toBe("Первая");
    expect(normalizeCategory("Без категории").value).toBeNull();
    expect(normalizeCategory("Педагог-методист").unknown).toBe("Педагог-методист");
  });
  it("schoolIdFromName устойчив к кавычкам и пробелам", () => {
    expect(schoolIdFromName("ГБОУ «Школа  № 1»")).toBe(schoolIdFromName("гбоу школа № 1"));
  });
});
