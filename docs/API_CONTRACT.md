# API Contract (v1)

Base URL: `/api/v1`. Формат: JSON, UTF-8. Авторизация: `Authorization: Bearer <JWT>`. Scope пользователя определяется сервером по токену, клиент его **не передаёт**.

TypeScript-типы — источник истины для клиента: `src/data/contracts/dto.ts`, `src/domain/forecast.ts`, `src/domain/model.ts`. Pydantic-схемы backend должны совпадать с ними (генерация OpenAPI → сравнение в CI).

## Общие параметры

| Параметр | Тип | Описание |
|---|---|---|
| `year` | int | Год среза (обязателен для аналитики) |
| `district` | string? | Фильтр округа; для директора игнорируется |

Ошибки: `403 {detail}` — вне scope; `404 {detail}` — не найдено (только для system scope); `422 {detail:[{loc,msg}]}` — валидация (формат FastAPI).

## Эндпоинты

| Метод | Путь | Ответ | Permission |
|---|---|---|---|
| GET | `/dictionaries` | `Dictionaries` (справочники, годы, периоды, meta, scopeSchool) | любой |
| GET | `/dashboard/summary?year&district` | `DashboardSummary` | любой (scope) |
| GET | `/dashboard/districts?year&district` | `DistrictBreakdown` | `system:view` |
| GET | `/schools?year&district` | `SchoolSummaryRow[]` | `school:view` (scope) |
| GET | `/schools/{school_id}?year` | `SchoolProfileDto` | `school:view` + scope |
| GET | `/teachers?year&district&page&page_size&sort&search&subject&qualification_category&outcome&age_min&age_max&ped_exp_min&ped_exp_max` | `Page<TeacherRegistryRow>` | `teachers:view` (scope) |
| GET | `/teachers/{teacher_id}?year` | `TeacherProfileDto` | `teachers:view` + scope |
| GET | `/analytics/composition?year&district` | `CompositionSummary` | `analytics:view` |
| GET | `/analytics/training?year&district` | `TrainingSummary` | `analytics:view` |
| GET | `/analytics/dynamics?year&district&subject` | `DynamicsSummary` | `analytics:view` |
| GET | `/analytics/mobility?year&district` | `MobilityOverview` | `analytics:view` |
| GET | `/analytics/mobility/breakdown?year&district&dimension` | `MobilityGroupRow[]` | `analytics:view` (`district` → `system:view`) |
| GET | `/analytics/scatter?year&district&x&y&limit` | `ScatterPoint[]` (≤ limit, сэмплирование на сервере) | `analytics:view` |
| GET | `/analytics/heatmap?year&district` | `HeatmapDto` | `analytics:view` |
| GET | `/analytics/load-scatter?year&district&all_years` | `LoadScatterDto` (все точки «педагог × год»: стаж × число предметов, флаг критической нагрузки, данные для подсказки) | любой (scope) |
| GET | `/data/catalog` | `DataCatalog` | `data:catalog` |
| POST | `/forecast` | `ForecastResult` | `forecast:use` |
| GET | `/forecast/overview?year&district&group_by` | `ForecastOverview` | `forecast:use` (`district` → `system:view`) |
| GET | `/model/metadata` | `ModelMetadata` | `model:view_summary` |
| GET | `/model/metrics` | `ModelMetrics` | `model:view_technical` |
| GET | `/model/importance` | `GlobalFeatureImportance` | `model:view_summary` |
| GET | `/model/monitoring` | `InferenceMonitoringSummary` | `model:monitoring` |
| POST | `/admin/model/retrain` | `{job_id}` (202) | `model:retrain` (только admin, вне UI) |
| POST | `/admin/model/promote` | `{model_version}` | `model:retrain` + ручное подтверждение |

Сортировка реестра: `sort=-age` (минус — по убыванию). Поля: `teacherId`, `schoolName`, `age`, `pedagogicalExperienceYears`, `totalExperienceYears`, `qualificationCategory`. `page_size ≤ 200`.

## Семантика мобильности

- `MobilityDistribution.period = {fromYear, toYear}`, где `toYear = fromYear + 1`.
- В аналитических эндпоинтах «за год Y» означает период `Y−1 → Y`. Если периода нет, приходит `mobility: null` или `distribution: null`.
- В реестре `outcome` — исход периода `year → year+1` (для последнего года `null`).
- `MobilityGroupRow.suppressed = true`, если группа меньше порога; доли и счётчики в этом случае обнуляются.

## GET /analytics/load-scatter

- `all_years=false` — только срез `year`, `true` — все годы.
- `points[]`: `teacherId`, `year`, `x` (педагогический стаж), `y` (число разных предметов), `critical`, `schoolName`, `age`, `mainPosition`, `qualificationCategory`, `topSubjects` (≤ 3), `status` (исход `year → year+1` или `null`).
- `thresholds = {maxExperienceExclusive: 2, minSubjects: 5}` — критерий критической нагрузки.
- `leaveShareCritical` и `leaveShareOther` — доля ушедших из системы среди точек с известным исходом; `null`, если группа меньше `MIN_GROUP_SIZE`.
- Ответ содержит десятки тысяч точек (~17 тыс. за год), поэтому backend должен отдавать его сжатым (gzip/br).

## Метаданные набора данных

`Dictionaries.meta`: `isMock`, `origin` (текстовое описание источника), `unavailableFields` (`preprofessional`, `trainingProvider` — UI скрывает зависящие от них разрезы). `TeacherProfileDto.datasetFeatures` — строка итоговой таблицы (`TeacherYearFeatures`) или `null`.

## POST /forecast

### ForecastInput (schemaVersion "1.0")

```json
{
  "schemaVersion": "1.0",
  "referenceYear": 2024,
  "teacher": {
    "gender": "female",
    "age": 31,
    "mainPosition": "Учитель",
    "activityDirection": "Математика",
    "academicDegree": null,
    "qualificationCategory": "Первая",
    "qualificationAssignedAt": "2021-05-15",
    "totalExperienceYears": 8,
    "pedagogicalExperienceYears": 6,
    "subjects": ["Математика"],
    "parallels": ["7", "8"],
    "isClassTeacher": false,
    "preprofessionalDirection": null
  },
  "education": [
    { "educationType": "Высшее образование", "specialization": "Математика", "qualification": "Учитель математики", "graduationYear": 2016 }
  ],
  "training": { "programCount": 1, "totalHours": 36, "hasRetraining": false, "lastDocumentDate": "2023-05-10" },
  "school": { "mode": "reference", "schoolId": "sch-1a2b3c4d" }
}
```

`school` бывает двух видов:
- `{"mode":"reference","schoolId":…}` — **предпочтительно**: сервер сам берёт округ, число зданий, контингент и число педагогов из `school_year` за `referenceYear` (как при обучении). Директору доступна только своя школа.
- `{"mode":"manual","district","buildingCount","studentCount","teacherCount"}` — сценарный анализ «что если». `students_per_teacher` всегда вычисляет сервер.

Правила валидации (`src/services/forecast/validation.ts`, дублируются в Pydantic): возраст 18–80; `0 ≤ pedagogical ≤ total ≤ age − 14`; не меньше одного предмета; все даты ≤ `referenceYear-12-31`; при `programCount = 0` часы равны 0, ПП нет, даты нет.

### ForecastResult

```json
{
  "requestId": "req-…",
  "generatedAt": "2026-09-28T13:00:00Z",
  "probabilities": { "stay": 0.81, "move": 0.08, "leave": 0.11 },
  "predictedClass": 0,
  "modelVersion": "catboost-2025.01.0",
  "featureSchemaVersion": "1.0",
  "calibrated": true,
  "isMock": false,
  "explanation": {
    "method": "shap",
    "baseProbabilities": { "stay": 0.80, "move": 0.08, "leave": 0.12 },
    "contributions": [
      { "feature": "age", "label": "Возраст", "displayValue": "31 лет", "impact": { "stay": -0.02, "move": 0.03, "leave": -0.01 } }
    ],
    "note": "…"
  },
  "resolvedSchool": { "district": "ЦАО", "buildingCount": 2, "studentCount": 980, "teacherCount": 72, "studentsPerTeacher": 13.6 },
  "warnings": []
}
```

Инварианты (проверяются клиентом в `validateForecastResult`): вероятности ∈ [0,1], их сумма = 1 ± 1e−3; `predictedClass = argmax`; `modelVersion` и `featureSchemaVersion` не пустые. `impact` — вклады в вероятность класса (в долях). Для SHAP в пространстве log-odds сервер переводит вклады в вероятности (или передаёт `method: "shap"` с пояснением в `note`), а сумма вкладов ≈ `probabilities − baseProbabilities`.

`predictedClass` — argmax по калиброванным вероятностям. Если выбран порог для класса 2 (см. ML_TRAINING_PLAN §6), сервер возвращает его в `warnings` или в отдельном поле `decisionPolicy` (расширение v1.1).
