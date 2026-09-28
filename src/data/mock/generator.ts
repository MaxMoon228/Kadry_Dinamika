/**
 * MOCK / DEMO. Генератор СИНТЕТИЧЕСКИХ строк в формате исходных таблиц (Приложение 1).
 * Значения вымышлены, названия школ и справочники — иллюстративные.
 * Не использовать для обучения моделей и выводов исследования.
 *
 * Генерируется «сырой» вид (строки педагог × предмет × параллель, накопительные записи
 * образования, разные форматы дат, единичные дубли), чтобы mock проходил тот же путь
 * raw → normalize → selectors, что и реальные данные.
 */

import type {
  RawDataset,
  RawEducationRow,
  RawSchoolRow,
  RawTeacherRow,
  RawTrainingRow,
} from "../contracts/raw";

export const MOCK_YEARS = [2022, 2023, 2024] as const;

export const MOCK_DISTRICTS = ["ЦАО", "САО", "СВАО", "ЮАО", "ЗАО", "ЮЗАО"] as const;

export const MOCK_SUBJECTS = [
  "Математика",
  "Русский язык",
  "Литература",
  "Физика",
  "Химия",
  "Биология",
  "История",
  "Обществознание",
  "Информатика",
  "Английский язык",
  "География",
  "Физическая культура",
  "Начальные классы",
] as const;

const TEACHER_POSITIONS = ["Учитель"];

const OTHER_POSITIONS = [
  "Педагог-организатор",
  "Педагог-психолог",
  "Социальный педагог",
  "Учитель-логопед",
  "Педагог дополнительного образования",
];

const PREPROF = [
  "IT-вертикаль",
  "Инженерная вертикаль",
  "Медицинская вертикаль",
  "Академическая вертикаль",
  "Педагогическая вертикаль",
];

const INSTITUTIONS = [
  "МПГУ",
  "ГАОУ ВО МГПУ",
  "РГПУ им. А. И. Герцена",
  "МГУ им. М. В. Ломоносова",
  "Региональный педагогический университет",
  "Педагогический колледж № 18",
];

const SPECIALIZATIONS: Record<string, [string, string]> = {
  Математика: ["Математика", "Учитель математики"],
  "Русский язык": ["Филология", "Учитель русского языка и литературы"],
  Литература: ["Филология", "Учитель русского языка и литературы"],
  Физика: ["Физика", "Учитель физики"],
  Химия: ["Химия", "Учитель химии"],
  Биология: ["Биология", "Учитель биологии"],
  История: ["История", "Учитель истории"],
  Обществознание: ["История", "Учитель истории и обществознания"],
  Информатика: ["Информатика", "Учитель информатики"],
  "Английский язык": ["Иностранный язык", "Учитель английского языка"],
  География: ["География", "Учитель географии"],
  "Физическая культура": ["Физическая культура", "Учитель физической культуры"],
  "Начальные классы": ["Педагогика и методика начального образования", "Учитель начальных классов"],
};

const TRAINING_PROGRAMS = [
  "Функциональная грамотность: развиваем в средней и старшей школе",
  "Цифровая образовательная среда: инструменты учителя",
  "Реализация требований обновлённых ФГОС",
  "Школа современного учителя",
  "Инклюзивное образование в общеобразовательной школе",
  "Профориентация в предпрофессиональных классах",
  "Оценивание образовательных результатов",
];

const RETRAINING_PROGRAMS = [
  "Педагогическое образование: учитель информатики",
  "Менеджмент в образовании",
  "Педагогика и психология",
];

const PROVIDERS = [
  "ГАОУ ДПО «Корпоративный университет»",
  "ГАОУ ВО МГПУ, ИДПО",
  "Академия Минпросвещения России",
  "МЦКО",
];

// --------------------------------------------------------------------- PRNG

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MockTeacherState {
  id: string;
  schoolIdx: number;
  gender: "Ж" | "М";
  age: number;
  totalExp: number;
  pedExp: number;
  position: string;
  subjects: string[];
  parallels: Record<string, string[]>;
  degree: string | null;
  category: string | null;
  categoryDate: string | null;
  preprof: string | null;
  classLead: boolean;
  education: {
    type: string;
    inst: string;
    date: string;
    spec: string;
    qual: string;
  }[];
  trainings: {
    name: string;
    type: "ПК" | "ПП";
    org: string;
    hours: number;
    date: string;
  }[];
}

export interface MockGeneratorOptions {
  seed?: number;
  schoolCount?: number;
}

export function generateMockRawDataset(opts: MockGeneratorOptions = {}): RawDataset {
  const rnd = mulberry32(opts.seed ?? 20240901);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  const chance = (p: number) => rnd() < p;
  const date = (year: number, fmt: "iso" | "ru" = "iso") => {
    const m = String(int(1, 12)).padStart(2, "0");
    const d = String(int(1, 28)).padStart(2, "0");
    return fmt === "iso" ? `${year}-${m}-${d}` : `${d}.${m}.${year}`;
  };
  const schoolCount = opts.schoolCount ?? 24;
  const schools = Array.from({ length: schoolCount }, (_, i) => ({
    name: `ГБОУ Школа № ${1100 + i * 23 + int(0, 9)}`,
    district: MOCK_DISTRICTS[i % MOCK_DISTRICTS.length],
    buildings: int(1, 5),
    students: int(700, 2600),
    /** «Климат» школы влияет на вероятность ухода — только чтобы демо-графики различались. */
    risk: between(-0.5, 0.6),
  }));
  let nextId = 100000;
  const newTeacher = (schoolIdx: number, year: number, young: boolean): MockTeacherState => {
    const age = young
      ? int(22, 34)
      : Math.round(
          Math.min(72, Math.max(23, between(24, 66) + (chance(0.4) ? between(-4, 6) : 0))),
        );
    const pedExp = Math.max(0, Math.min(age - 21, Math.round(between(0, age - 21))));
    const totalExp = Math.min(age - 18, pedExp + int(0, 6));
    const isTeacher = chance(0.9);
    const main = pick(MOCK_SUBJECTS);
    const subjects = [main];
    if (main !== "Начальные классы" && chance(0.25))
      subjects.push(pick(MOCK_SUBJECTS.filter((s) => s !== "Начальные классы" && s !== main)));
    const parallels: Record<string, string[]> = {};
    for (const s of subjects) {
      const pool =
        s === "Начальные классы" ? ["1", "2", "3", "4"] : ["5", "6", "7", "8", "9", "10", "11"];
      const n = s === "Начальные классы" ? 1 : int(1, 4);
      parallels[s] = Array.from(new Set(Array.from({ length: n }, () => pick(pool)))).sort(
        (a, b) => Number(a) - Number(b),
      );
    }
    const category =
      pedExp < 2
        ? null
        : chance(0.38)
          ? "Высшая категория"
          : chance(0.45)
            ? "Первая категория"
            : chance(0.05)
              ? "Вторая категория"
              : null;
    const [spec, qual] = SPECIALIZATIONS[main];
    const gradYear = year - Math.max(0, age - int(21, 24));
    const education = [
      {
        type: chance(0.88) ? "Высшее образование" : "Среднее профессиональное образование",
        inst: pick(INSTITUTIONS),
        date: date(gradYear),
        spec,
        qual,
      },
    ];
    if (chance(0.22))
      education.push({
        type: "Дополнительное профессиональное образование",
        inst: pick(INSTITUTIONS),
        date: date(Math.min(year, gradYear + int(2, 15))),
        spec: "Педагогическое образование",
        qual: qual,
      });
    return {
      id: String(nextId++),
      schoolIdx,
      gender: chance(0.82) ? "Ж" : "М",
      age,
      totalExp,
      pedExp,
      position: isTeacher ? pick(TEACHER_POSITIONS) : pick(OTHER_POSITIONS),
      subjects,
      parallels,
      degree: chance(0.035) ? "Кандидат наук" : chance(0.004) ? "Доктор наук" : null,
      category,
      categoryDate: category ? date(Math.max(2012, year - int(0, 6))) : null,
      preprof: chance(0.16) ? pick(PREPROF) : null,
      classLead: isTeacher && chance(0.45),
      education,
      trainings: [],
    };
  };
  const teacherRows: RawTeacherRow[] = [];
  const educationRows: RawEducationRow[] = [];
  const trainingRows: RawTrainingRow[] = [];
  const schoolRows: RawSchoolRow[] = [];
  let active: MockTeacherState[] = [];
  schools.forEach((_, si) => {
    const n = int(40, 95);
    for (let k = 0; k < n; k++) active.push(newTeacher(si, MOCK_YEARS[0], false));
  });
  MOCK_YEARS.forEach((year, yi) => {
    // --- следующий год: исходы и найм
    if (yi > 0) {
      const survivors: MockTeacherState[] = [];
      const leftBySchool = new Array(schools.length).fill(0);
      for (const t of active) {
        const s = schools[t.schoolIdx];
        let leave = -2.3 + s.risk * 0.8;
        let move = -2.7 + s.risk * 0.5;
        if (t.age >= 60) leave += 1.3;
        if (t.age < 30) {
          move += 0.7;
          leave += 0.4;
        }
        if (t.pedExp < 3) leave += 0.5;
        if (t.category) {
          leave -= 0.4;
          move -= 0.2;
        }
        if (t.classLead) move -= 0.25;
        if (t.trainings.length === 0) leave += 0.25;
        const pl = Math.exp(leave);
        const pm = Math.exp(move);
        const z = 1 + pl + pm;
        const r = rnd();
        if (r < pl / z) {
          leftBySchool[t.schoolIdx]++;
          continue;
        }
        if (r < (pl + pm) / z) {
          leftBySchool[t.schoolIdx]++;
          const sameDistrict = schools
            .map((x, i) => i)
            .filter((i) => i !== t.schoolIdx && schools[i].district === s.district);
          const others = schools.map((_, i) => i).filter((i) => i !== t.schoolIdx);
          t.schoolIdx = chance(0.6) && sameDistrict.length ? pick(sameDistrict) : pick(others);
          t.classLead = false;
        }
        t.age += 1;
        t.pedExp += 1;
        t.totalExp += 1;
        if (!t.category && t.pedExp >= 2 && chance(0.12)) {
          t.category = "Первая категория";
          t.categoryDate = date(year);
        } else if (t.category === "Первая категория" && chance(0.08)) {
          t.category = "Высшая категория";
          t.categoryDate = date(year);
        }
        if (chance(0.1)) t.classLead = !t.classLead && t.position === "Учитель";
        survivors.push(t);
      }
      leftBySchool.forEach((n, si) => {
        const hires = Math.max(0, Math.round(n * between(0.6, 1.1)));
        for (let k = 0; k < hires; k++) survivors.push(newTeacher(si, year, chance(0.55)));
      });
      active = survivors;
    }

    // --- обучение в текущем году
    for (const t of active) {
      const n = chance(0.45) ? (chance(0.25) ? 2 : 1) : 0;
      for (let k = 0; k < n; k++) {
        const pp = chance(0.07);
        t.trainings.push({
          name: pp ? pick(RETRAINING_PROGRAMS) : pick(TRAINING_PROGRAMS),
          type: pp ? "ПП" : "ПК",
          org: pick(PROVIDERS),
          hours: pp ? pick([252, 288, 520]) : pick([16, 18, 24, 36, 48, 72, 108]),
          date: date(year),
        });
      }
    }

    // --- выгрузка строк года
    for (const s of schools) {
      s.students = Math.round(s.students * between(0.97, 1.05));
      schoolRows.push({
        Год: String(year),
        Школа: s.name,
        Округ: s.district,
        "Количество зданий": String(s.buildings),
        "Общая численность контингента": String(s.students),
      });
    }
    for (const t of active) {
      const school = schools[t.schoolIdx];
      for (const subj of t.subjects) {
        for (const par of t.parallels[subj]) {
          const row: RawTeacherRow = {
            Год: String(year),
            Идентификатор: t.id,
            "Краткое наименование образовательной организации": school.name,
            "Основная должность": t.position,
            "Направление деятельности":
              t.position === "Учитель" ? t.subjects[0] : "Воспитательная работа",
            Пол: t.gender,
            Возраст: chance(0.004) ? null : String(t.age),
            "Учёная степень": t.degree,
            "Квалификационная категория": t.category ?? (chance(0.5) ? "Без категории" : null),
            "Дата присвоения квалификационной категории":
              t.categoryDate && chance(0.2)
                ? t.categoryDate.split("-").reverse().join(".")
                : t.categoryDate,
            "Срок действия квалификационной категории":
              t.categoryDate && chance(0.7)
                ? `${Number(t.categoryDate.slice(0, 4)) + 5}${t.categoryDate.slice(4)}`
                : null,
            "Общий стаж работы": String(t.totalExp),
            "Стаж педагогической работы": String(t.pedExp),
            Предмет: subj,
            Параллель: par,
            "Преподаёт в предпрофессиональных классах": t.preprof,
            "Имеет классное руководство": t.classLead ? "Да" : "Нет",
          };
          teacherRows.push(row);
          if (chance(0.003)) teacherRows.push({ ...row });
        }
      }

      // накопительный итог: все записи об образовании повторяются каждый год
      for (const e of t.education) {
        if (Number(e.date.slice(0, 4)) > year) continue;
        educationRows.push({
          Год: String(year),
          Идентификатор: t.id,
          "Тип образования": e.type,
          "Наименование учебного заведения": e.inst,
          "Дата окончания": e.date,
          Специализация: e.spec,
          Квалификация: e.qual,
        });
      }
      for (const c of t.trainings.filter((c) => c.date.startsWith(String(year)))) {
        trainingRows.push({
          Год: String(year),
          Идентификатор: t.id,
          "Наименование программы": c.name,
          "Программа профессиональной переподготовки (ПП) или программа повышения квалификации (ПК)":
            c.type,
          "Организатор программы": c.org,
          "Количество часов": String(c.hours),
          "Дата получения документа": c.date,
        });
      }
    }
  });
  return {
    teachers: teacherRows,
    education: educationRows,
    training: trainingRows,
    schools: schoolRows,
  };
}
