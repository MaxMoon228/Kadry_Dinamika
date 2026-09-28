# Архитектура системы

## 1. Целевая схема

```
┌──────────────────────────── Browser ────────────────────────────┐
│ React + TypeScript + Vite                                        │
│ pages → hooks(useAsync) → DataSource (repositories/services)     │
│                     │ VITE_DATA_SOURCE=mock │ =api               │
│               MockDataSource          ApiDataSource (fetch)      │
└──────────────────────────────────────────┬──────────────────────┘
                                           │ HTTPS, JWT (OIDC)
┌──────────────────────── Backend (FastAPI) ▼──────────────────────┐
│ api/ (routers)  → authz dependency (role, school scope)          │
│ services/       → аналитика, реестр, прогноз                     │
│ repositories/   → SQL (SQLAlchemy), всегда с WHERE по scope      │
└───────────────┬───────────────────────────────┬──────────────────┘
                │                               │
        ┌───────▼────────┐             ┌────────▼─────────────┐
        │ PostgreSQL      │             │ Inference service    │
        │ raw / core /    │             │ (в процессе API или  │
        │ marts / ml      │             │  отдельный сервис)   │
        │ + RLS           │             │ feature pipeline     │
        └───────▲────────┘             │ + model artifact     │
                │                       └────────▲─────────────┘
        ┌───────┴────────┐                       │
        │ ETL (Python)    │  datasets  ┌─────────┴──────────┐
        │ raw → normalized├──────────► │ ML pipeline         │
        │ → marts         │            │ train/eval/calib    │
        └─────────────────┘            │ → MLflow registry   │
                                       └────────────────────┘
```

## 2. Frontend

| Слой | Путь | Ответственность |
|---|---|---|
| Domain | `src/domain/*` | Нормализованные сущности и value types (Teacher, School, MobilityClass, ForecastInput…) |
| Raw contract | `src/data/contracts/raw.ts` | Строки исходных таблиц с оригинальными названиями колонок |
| Normalized | `src/data/contracts/normalized.ts` | Результат ETL: срезы, исходы, отчёт качества |
| API DTO | `src/data/contracts/dto.ts` | Формы ответов backend (агрегаты, страницы, профили) |
| Interfaces | `src/data/contracts/repositories.ts` | `DashboardRepository`, `SchoolRepository`, `TeacherRepository`, `AnalyticsRepository`, `DataCatalogRepository`, `ForecastService`, `ModelService` |
| ETL (эталон) | `src/data/adapters/normalize.ts` | Исполняемая спецификация правил нормализации и построения target |
| Selectors | `src/data/selectors/*` | Чистые функции агрегации (доли, группировки, derived features) |
| Mock | `src/data/mock/*`, `src/services/*/mock*` | Синтетические raw-строки → тот же ETL → имитация backend со scope |
| API | `src/data/api/apiDataSource.ts`, `src/services/api/httpClient.ts` | HTTP-реализации тех же интерфейсов |
| Auth | `src/auth/*` | Роли, права, scope, демо-сессия |
| Theme | `src/theme/*`, `src/index.css` | Semantic tokens, light/dark/system |
| UI | `src/components/*`, `src/pages/*` | Только отображение; данные через `useData()` |

Правила:
- Страницы не импортируют mock, генератор или HTTP.
- Fetch не вызывается в компонентах: только через DataSource.
- Агрегаты считает «сервер» (mock имитирует его). При реальном датасете клиент получает только агрегаты и страницы реестра.
- Смена пользователя пересоздаёт DataSource (`DataProvider`).

## 3. Backend (план, не реализован)

```
backend/
  app/
    main.py
    api/v1/            dashboard.py, schools.py, teachers.py, analytics.py,
                       forecast.py, model.py, data.py, admin.py
    core/              config.py, security.py (OIDC/JWT), authz.py (RBAC + scope)
    schemas/           Pydantic-модели = DTO из docs/API_CONTRACT.md
    services/          analytics_service.py, registry_service.py, forecast_service.py
    repositories/      sql/*.py — все запросы принимают Scope
    ml/                feature_pipeline.py (импорт пакета ml), model_loader.py
  tests/               test_authz.py (IDOR), test_contracts.py, test_analytics.py
ml/                    (отдельный Python-пакет, используется и backend, и обучением)
  data/                загрузка raw, валидация (pandera / great_expectations)
  features/            pipeline.py — ЕДИНЫЙ для train и inference
  training/            train.py, search.py
  evaluation/          metrics.py, calibration.py, fairness.py, reports/
  inference/           predictor.py
  explainability/      shap_explainer.py
  artifacts/           (локально; в production — MLflow/S3)
etl/                   raw → core → marts (SQL + Python), идемпотентные загрузки
```

### База данных (PostgreSQL)

| Схема | Таблицы |
|---|---|
| `raw` | `teacher_rows`, `education_rows`, `training_rows`, `school_rows` — как в источнике + `load_id`, `source_file`, `loaded_at` |
| `core` | `school`, `school_year`, `teacher`, `teacher_year`, `teacher_assignment`, `teacher_education`, `teacher_training`, `mobility_outcome` |
| `marts` | `school_year_kpi`, `district_year_kpi`, `mobility_by_group` (материализованные представления) |
| `ml` | `feature_snapshot` (версионированные признаки), `inference_log`, `model_registry_ref` |
| `auth` | `app_user`, `user_role(user_id, role, school_id)` |

Row-Level Security на `core.teacher_year`, `core.mobility_outcome` и `marts.*` по `school_id` через `current_setting('app.school_scope')`. Это второй рубеж после проверки в сервисе.

## 4. Inference

```
POST /api/v1/forecast
   → authz (forecast:use, school scope для reference-школы)
   → pydantic validation (ForecastInput v1.0)
   → feature_pipeline.transform(input, school_features_from_db)   ← тот же код, что в обучении
   → model.predict_proba (champion из MLflow, загружен при старте)
   → calibrator.transform
   → shap_explainer (TreeExplainer) → top-k вкладов по каждому классу
   → inference_log (без PII)
   → ForecastResult
```

Требование consistency: `ml.features.pipeline` — единственная реализация преобразований. Её версия (`feature_schema_version`) хранится в артефакте модели и возвращается в ответе. Если версия схемы входа не поддерживается моделью, сервис возвращает 422.

## 5. Нефункциональные требования

- Производительность: агрегаты берутся из marts (< 300 мс), реестр отдаётся с серверной пагинацией (page/pageSize ≤ 200), прогноз < 500 мс p95.
- Безопасность: OIDC, RBAC, school scope, RLS, аудит доступа к карточкам педагогов.
- Приватность: только обезличенные ID, минимизация полей (см. AUTHORIZATION_MODEL.md).
- Наблюдаемость: структурированные логи, метрики latency, мониторинг дрейфа (ML_ARCHITECTURE.md).
