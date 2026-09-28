# СППР «Кадровая динамика»

Прототип системы поддержки принятия решений для исследовательского проекта «Стратегия управления кадровой динамикой» (курс «Научная Студия»). Предмет — трудовая мобильность учителей общеобразовательных школ: анализ состава, динамики и мобильности, прогноз трёх исходов (0 — остался в школе, 1 — перешёл в другую школу, 2 — ушёл из системы образования).

> **Статус.** Frontend работает на **синтетических mock-данных**, которые генерируются в браузере в формате исходных таблиц ДОНМ 2022–2024 гг. Реальный датасет **не подключён**, ML-модель **не обучена**. Калькулятор использует демонстрационную эвристику и явно помечает результат как mock. Приложение подготовлено к замене mock на REST API без переписывания UI.

## Быстрый старт

```bash
pnpm install        # или: npx pnpm@10.34.3 install
pnpm dev            # → http://localhost:8443
pnpm test           # unit-тесты
pnpm build          # typecheck + production build
```

## Возможности
- Роли: руководитель системы образования, аналитик, директор школы. Директор видит только свою школу, в том числе при ручном вводе URL.
- Страницы: Обзор, Школы / Моя школа, Педагогический состав (серверная пагинация реестра), Кадровая динамика, Трудовая мобильность, Прогноз, Калькулятор, Аналитика, Данные и модель, Мониторинг модели (только аналитик).
- Светлая, тёмная и системная тема (lavender / violet / indigo / blue). Статусы мобильности различаются цветом, светлотой и иконкой.
- Слой данных: raw → ETL → normalized → DTO; интерфейсы репозиториев с mock- и API-реализациями.
- ForecastService (`POST /forecast`) с валидацией, калибровкой в контракте и SHAP-совместимым объяснением.

## Документация
| Файл | Содержание |
|---|---|
| [docs/CURRENT_STATE_AUDIT.md](docs/CURRENT_STATE_AUDIT.md) | Аудит исходного прототипа и список изменений |
| [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Frontend ↔ FastAPI ↔ PostgreSQL, inference service |
| [docs/DATA_INTEGRATION_PLAN.md](docs/DATA_INTEGRATION_PLAN.md) | Таблицы, ключи, нормализация, target, leakage |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | Поля источника → canonical → UI/ML, derived-признаки |
| [docs/AUTHORIZATION_MODEL.md](docs/AUTHORIZATION_MODEL.md) | RBAC, school scope, IDOR, RLS, приватность |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | REST-эндпоинты и схемы |
| [docs/ML_ARCHITECTURE.md](docs/ML_ARCHITECTURE.md) | Признаки, валидация, модели, калибровка, explainability, MLOps, этика |
| [docs/ML_TRAINING_PLAN.md](docs/ML_TRAINING_PLAN.md) | Пошаговый план обучения после получения данных |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Команды, структура, правила разработки |

## Стек
React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Recharts 3 · Vitest. Проект изначально создан в Figma Make: конфигурация `.figma/` и плагины в `vite.config.ts` сохранены.
