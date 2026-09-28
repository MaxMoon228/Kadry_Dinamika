import {
  FORECAST_INPUT_SCHEMA_VERSION,
  type ForecastInput,
  type ForecastResult,
} from "../../domain/forecast";

import { MOBILITY_CLASS_BY_KEY, MOBILITY_KEYS } from "../../domain/mobility";
import type { FieldError } from "../../data/contracts/errors";

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Валидация ForecastInput. Та же схема проверяется на backend (Pydantic);
 * клиентская проверка нужна для UX и раннего обнаружения ошибок контракта.
 */

export function validateForecastInput(input: ForecastInput): FieldError[] {
  const errors: FieldError[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });
  const cutoff = `${input.referenceYear}-12-31`;
  if (input.schemaVersion !== FORECAST_INPUT_SCHEMA_VERSION)
    err("schemaVersion", `Ожидается версия схемы ${FORECAST_INPUT_SCHEMA_VERSION}`);
  if (!isInt(input.referenceYear) || input.referenceYear < 2000 || input.referenceYear > 2100)
    err("referenceYear", "Некорректный год среза");
  const t = input.teacher;
  if (!isInt(t.age) || t.age < 18 || t.age > 80)
    err("teacher.age", "Возраст — целое число от 18 до 80");
  if (!isNum(t.totalExperienceYears) || t.totalExperienceYears < 0)
    err("teacher.totalExperienceYears", "Общий стаж не может быть отрицательным");
  else if (isInt(t.age) && t.totalExperienceYears > t.age - 14)
    err("teacher.totalExperienceYears", "Общий стаж не согласуется с возрастом");
  if (!isNum(t.pedagogicalExperienceYears) || t.pedagogicalExperienceYears < 0)
    err("teacher.pedagogicalExperienceYears", "Педагогический стаж не может быть отрицательным");
  else if (isNum(t.totalExperienceYears) && t.pedagogicalExperienceYears > t.totalExperienceYears)
    err("teacher.pedagogicalExperienceYears", "Педагогический стаж не может превышать общий");
  if (!t.subjects.length) err("teacher.subjects", "Укажите хотя бы один предмет");
  if (t.qualificationAssignedAt && t.qualificationAssignedAt > cutoff)
    err("teacher.qualificationAssignedAt", "Дата присвоения категории позже даты среза");
  if (t.qualificationAssignedAt && !t.qualificationCategory)
    err("teacher.qualificationAssignedAt", "Дата указана, но категория не выбрана");
  input.education.forEach((e, i) => {
    if (!e.educationType) err(`education.${i}.educationType`, "Укажите тип образования");
    if (
      e.graduationYear != null &&
      (!isInt(e.graduationYear) ||
        e.graduationYear < 1950 ||
        e.graduationYear > input.referenceYear)
    )
      err(`education.${i}.graduationYear`, "Год окончания должен быть не позже года среза");
  });
  const tr = input.training;
  if (!isInt(tr.programCount) || tr.programCount < 0 || tr.programCount > 100)
    err("training.programCount", "Число программ — целое от 0 до 100");
  if (!isNum(tr.totalHours) || tr.totalHours < 0 || tr.totalHours > 10000)
    err("training.totalHours", "Часы — от 0 до 10 000");
  if (tr.programCount === 0 && (tr.totalHours > 0 || tr.hasRetraining || tr.lastDocumentDate))
    err("training.programCount", "Нет программ — часы, ПП и дата должны быть пустыми");
  if (tr.programCount > 0 && tr.totalHours === 0)
    err("training.totalHours", "Укажите суммарное количество часов");
  if (tr.lastDocumentDate && tr.lastDocumentDate > cutoff)
    err("training.lastDocumentDate", "Дата документа позже даты среза (утечка будущего)");
  const s = input.school;
  if (s.mode === "reference") {
    if (!s.schoolId) err("school.schoolId", "Выберите школу");
  } else {
    if (!s.district) err("school.district", "Укажите округ");
    if (!isInt(s.buildingCount) || s.buildingCount < 1 || s.buildingCount > 50)
      err("school.buildingCount", "Количество зданий — от 1 до 50");
    if (!isInt(s.studentCount) || s.studentCount < 1)
      err("school.studentCount", "Численность учащихся — положительное целое");
    if (!isInt(s.teacherCount) || s.teacherCount < 1)
      err("school.teacherCount", "Число педагогов — положительное целое");
  }
  return errors;
}

/** Проверка ответа сервиса на соответствие контракту ForecastResult. */

export function validateForecastResult(r: ForecastResult): string[] {
  const problems: string[] = [];
  const p = r.probabilities;
  for (const k of MOBILITY_KEYS)
    if (!isNum(p[k]) || p[k] < 0 || p[k] > 1) problems.push(`probabilities.${k} вне [0, 1]`);
  const sum = p.stay + p.move + p.leave;
  if (Math.abs(sum - 1) > 1e-3) problems.push(`Сумма вероятностей ${sum.toFixed(4)} ≠ 1`);
  const argmax = MOBILITY_KEYS.reduce((best, k) => (p[k] > p[best] ? k : best), MOBILITY_KEYS[0]);
  if (r.predictedClass !== MOBILITY_CLASS_BY_KEY[argmax])
    problems.push("predictedClass не совпадает с максимальной вероятностью");
  if (!r.modelVersion) problems.push("Не указана версия модели");
  if (!r.featureSchemaVersion) problems.push("Не указана версия схемы признаков");
  return problems;
}
