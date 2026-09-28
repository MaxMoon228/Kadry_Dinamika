# План обучения модели (после получения реального датасета)

Порядок следует CRISP-DM (лекция 3) и Приложению 2. Каждый шаг даёт артефакт, который проверяется до перехода к следующему.

## Шаг 0. Окружение
- Python 3.12, `pandas`, `pyarrow`, `scikit-learn`, `catboost`, `lightgbm`/`xgboost`, `imbalanced-learn`, `shap`, `mlflow`, `pandera`, `matplotlib`/`plotly`, `pytest`.
- Отдельный репозиторий или каталог `ml/` (не во frontend). Данные хранятся вне git, в git только конфиги и код.
- `random_state=42` везде; фиксируются версии библиотек (`uv lock`/`poetry.lock`).

## Шаг 1. Понимание данных (EDA) → `reports/01_eda.html`
1. Загрузка raw и отчёт ETL (DATA_INTEGRATION_PLAN §9): ответы на открытые вопросы §1.
2. Размеры: педагогов, школ и срезов по годам; стабильность ID между годами.
3. Распределения признаков по годам (выявление дрейфа 2022→2024).
4. Пропуски и выбросы (IQR / z-score), невозможные значения.
5. Распределение target по P1 и P2, по округам, возрасту и стажу.
6. Связи признаков с target: доли классов по группам, Cramér's V и mutual information. Результаты должны совпадать с визуализациями страницы «Трудовая мобильность».

## Шаг 2. Формализация target и выборок → `data/processed/*.parquet`
- `teacher_year` + `mobility_outcome` → `train_P1.parquet` (признаки 2022, исход 2023), `test_P2.parquet` (признаки 2023, исход 2024), `inference_P3.parquet` (признаки 2024).
- Проверки: одна строка на `(teacher_id, t)`; нет признаков из t+1 (unit-тест: изменение данных t+1 не меняет признаки t).

## Шаг 3. Feature pipeline → `ml/features/pipeline.py`, `schema v1.0`
- Реализовать признаки из ML_ARCHITECTURE §3 как `sklearn`-трансформер (`fit` на train, `transform` на всём).
- Тот же код вызывается из inference-сервиса (`build_features(ForecastInput)`).
- Сохранить `feature_schema.json` (имена, типы, допустимые категории, версии).
- Тест consistency: для 100 педагогов P2 признаки, построенные из БД и из эквивалентного `ForecastInput`, совпадают побитово.

## Шаг 4. Baselines → MLflow experiment `mobility-baselines`
1. Dummy (prior, stratified).
2. Multinomial LogReg: L2 и L1 (`saga`), `C ∈ logspace(-3, 2)`, `class_weight ∈ {None, balanced}`.
3. Для каждого: CV на P1 (`StratifiedGroupKFold`, group = teacher_id), затем метрики на P2.

## Шаг 5. Деревья и бустинг
- Random Forest: `n_estimators 300–800`, `max_depth`, `min_samples_leaf`, `class_weight=balanced_subsample`.
- HistGB / LightGBM / XGBoost: `learning_rate`, `max_depth`/`num_leaves`, `min_child_samples`, регуляризация; `class_weight` через sample weights.
- CatBoost: `depth 4–8`, `l2_leaf_reg`, `iterations` с early stopping на внутреннем фолде, `cat_features` нативно, `auto_class_weights ∈ {None, Balanced, SqrtBalanced}`.
- Подбор: Optuna, 50–100 trials на модель, целевая функция = Macro F1 на CV при ограничении log loss.
- Oversampling (SMOTE-NC) пробуется только как отдельный эксперимент внутри `imblearn.Pipeline`.

## Шаг 6. Пороги и политика решения
- Базовое правило: argmax калиброванных вероятностей.
- Опционально: порог τ для класса 2 максимизирует F2(2) на CV train. На P2 он проверяется один раз.

## Шаг 7. Калибровка
- Temperature scaling (бустинг) и isotonic / sigmoid (`CalibratedClassifierCV`) на внутренних фолдах train.
- Отчёт: reliability diagrams по классам, ECE и Brier до и после калибровки на P2.

## Шаг 8. Оценка и выбор (ML_ARCHITECTURE §5, §7)
- Сводная таблица: Balanced Acc, Macro/Weighted F1, P/R/F1/F2 по классам, ROC-AUC OvR, PR-AUC, log loss, Brier, ECE, latency p95 на CPU.
- Bootstrap-интервалы на P2; разрыв CV↔P2 (переобучение и дрейф).
- Confusion matrix с бизнес-интерпретацией.
- Выбор по критерию «качество + устойчивость + калибровка + объяснимость + deployability».

## Шаг 9. Интерпретация (Приложение 2, этап 10)
- Глобально: permutation importance, SHAP summary по классам, PDP/ICE (возраст, пед. стаж, часы ПК, учащихся на педагога).
- Локально: SHAP waterfall для типичных и атипичных случаев.
- Slice analysis ошибок. Выводы о подтверждении гипотезы с формулировками «связано с», а не «вызывает».

## Шаг 10. Fairness и sanity
- Метрики по полу, возрастным группам и округам (ML_ARCHITECTURE §11).
- Leakage-стоп: AUC > 0.95, один признак > 50% важности или скачок качества после добавления школьного агрегата требуют расследования.

## Шаг 11. Обогащение (Приложение 2, этап 9)
- Внешние источники (социально-экономические индексы округов) подключаются только как версионированные справочники с датой ≤ среза.
- Каждое обогащение оформляется отдельным экспериментом с A/B-сравнением к текущему лучшему.

## Шаг 12. Упаковка и регистрация
- Артефакт: pipeline + model + calibrator + explainer background + `feature_schema.json` + model card (данные, метрики, ограничения, fairness, запреты использования).
- `mlflow.register_model` → Staging → approval → Production (alias `champion`).
- Backend `/model/metadata` и `/model/metrics` читают из реестра, frontend получает их без изменений UI.

## Шаг 13. Переключение frontend
- `VITE_DATA_SOURCE=api`. Калькулятор начнёт получать `isMock=false`, `calibrated=true`, `method="shap"`. Предупреждения mock исчезнут автоматически, потому что они привязаны к полям ответа.

## Критерии готовности первой production-модели
- Macro F1 на P2 заметно выше LogReg-baseline (интервалы не пересекаются) **или** равна ему, но с лучшей калибровкой и объяснимостью (тогда выбирается LogReg).
- Recall класса 2 не ниже согласованного с заказчиком уровня.
- ECE ≤ 0.05, fairness-гэпы ≤ 0.1.
- Воспроизводимость: повторный запуск по `git_commit` + `dataset_version` даёт те же метрики (±0.005).
