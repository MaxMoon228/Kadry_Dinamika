/**
 * MOCK. Детерминированная эвристика для проверки UI-контракта калькулятора.
 * Это НЕ обученная модель и НЕ результат анализа данных: коэффициенты заданы вручную.
 *
 * Вклады признаков считаются точными значениями Шепли по группам признаков в пространстве
 * вероятностей, поэтому сумма вкладов равна (итоговая вероятность − базовая) — так же,
 * как будет устроен ответ реальной модели с SHAP.
 */

import type { FeatureContribution, MobilityProbabilities } from "../../domain/forecast";
import { MOBILITY_KEYS } from "../../domain/mobility";

export const MOCK_MODEL_VERSION = "mock-heuristic-0.1";

export const FEATURE_SCHEMA_VERSION = "1.0";

export interface HeuristicFeatures {
  age: number;
  pedagogicalExperienceYears: number;
  qualificationCategory: string | null;
  isClassTeacher: boolean;
  trainingCount: number;
  hasRetraining: boolean;
  studentsPerTeacher: number | null;
  preprofessional: boolean;
}

type Logits = { move: number; leave: number };

interface Term {
  feature: string;
  label: string;
  display: (f: HeuristicFeatures) => string;
  delta: (f: HeuristicFeatures) => Logits;
}

const BASE: Logits = { move: -2.4, leave: -2.0 };

const TERMS: Term[] = [
  {
    feature: "age",
    label: "Возраст",
    display: (f) => `${f.age} лет`,
    delta: (f) =>
      f.age >= 60
        ? { move: -0.3, leave: 1.2 }
        : f.age < 30
          ? { move: 0.5, leave: 0.3 }
          : { move: 0, leave: -0.1 },
  },
  {
    feature: "pedagogical_experience_years",
    label: "Педагогический стаж",
    display: (f) => `${f.pedagogicalExperienceYears} лет`,
    delta: (f) =>
      f.pedagogicalExperienceYears < 3
        ? { move: 0.4, leave: 0.4 }
        : f.pedagogicalExperienceYears >= 20
          ? { move: -0.3, leave: 0 }
          : { move: 0, leave: 0 },
  },
  {
    feature: "qualification_category",
    label: "Квалификационная категория",
    display: (f) => f.qualificationCategory ?? "Без категории",
    delta: (f) =>
      f.qualificationCategory === "Высшая" || f.qualificationCategory === "Первая"
        ? { move: -0.2, leave: -0.3 }
        : { move: 0.2, leave: 0.1 },
  },
  {
    feature: "is_class_teacher",
    label: "Классное руководство",
    display: (f) => (f.isClassTeacher ? "Да" : "Нет"),
    delta: (f) => (f.isClassTeacher ? { move: -0.2, leave: -0.1 } : { move: 0.05, leave: 0.05 }),
  },
  {
    feature: "training_count",
    label: "Повышение квалификации",
    display: (f) =>
      f.trainingCount === 0
        ? "нет программ"
        : `${f.trainingCount} прогр.${f.hasRetraining ? ", есть ПП" : ""}`,
    delta: (f) => ({
      move: f.hasRetraining ? 0.25 : 0,
      leave: f.trainingCount === 0 ? 0.3 : -0.1,
    }),
  },
  {
    feature: "students_per_teacher",
    label: "Учащихся на педагога (школа)",
    display: (f) => (f.studentsPerTeacher == null ? "нет данных" : String(f.studentsPerTeacher)),
    delta: (f) =>
      f.studentsPerTeacher != null && f.studentsPerTeacher > 16
        ? { move: 0.2, leave: 0.15 }
        : { move: 0, leave: 0 },
  },
  {
    feature: "preprofessional_direction",
    label: "Предпрофессиональные классы",
    display: (f) => (f.preprofessional ? "Преподаёт" : "Не преподаёт"),
    delta: (f) => (f.preprofessional ? { move: 0.05, leave: -0.15 } : { move: 0, leave: 0 }),
  },
];

function softmax(l: Logits): MobilityProbabilities {
  const es = 1;
  const em = Math.exp(l.move);
  const el = Math.exp(l.leave);
  const z = es + em + el;
  return { stay: es / z, move: em / z, leave: el / z };
}

export const MOCK_BASE_PROBABILITIES = softmax(BASE);

export function mockPredict(f: HeuristicFeatures): {
  probabilities: MobilityProbabilities;
  contributions: FeatureContribution[];
} {
  const deltas = TERMS.map((t) => t.delta(f));
  const n = TERMS.length;
  const value = (mask: number): MobilityProbabilities => {
    const l = { ...BASE };
    for (let i = 0; i < n; i++)
      if (mask & (1 << i)) {
        l.move += deltas[i].move;
        l.leave += deltas[i].leave;
      }
    return softmax(l);
  };
  const cache = new Map<number, MobilityProbabilities>();
  const v = (m: number) => {
    if (!cache.has(m)) cache.set(m, value(m));
    return cache.get(m)!;
  };
  const fact = [1];
  for (let i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;
  const contributions: FeatureContribution[] = TERMS.map((term, i) => {
    const impact: MobilityProbabilities = { stay: 0, move: 0, leave: 0 };
    for (let mask = 0; mask < 1 << n; mask++) {
      if (mask & (1 << i)) continue;
      let size = 0;
      for (let j = 0; j < n; j++) if (mask & (1 << j)) size++;
      const w = (fact[size] * fact[n - size - 1]) / fact[n];
      const a = v(mask | (1 << i));
      const b = v(mask);
      for (const k of MOBILITY_KEYS) impact[k] += w * (a[k] - b[k]);
    }
    return {
      feature: term.feature,
      label: term.label,
      displayValue: term.display(f),
      impact,
    };
  });
  const full = v((1 << n) - 1);
  contributions.sort((a, b) => maxAbs(b.impact) - maxAbs(a.impact));
  return { probabilities: full, contributions };
}

function maxAbs(p: MobilityProbabilities): number {
  return Math.max(Math.abs(p.stay), Math.abs(p.move), Math.abs(p.leave));
}
