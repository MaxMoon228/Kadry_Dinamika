# Разработка

## Требования
- Node.js 22+ (проверено на 24), pnpm 10 (`.mise.toml`). Если pnpm не установлен глобально: `npx pnpm@10.34.3 <команда>` или `corepack enable`.

## Команды

```bash
pnpm install            # зависимости
pnpm dev                # http://localhost:8443 (порт из vite.config.ts, PORT переопределяет)
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run: unit + smoke-тесты маршрутов (jsdom, ~1 мин)
pnpm build              # typecheck + vite build → dist/
pnpm preview            # предпросмотр сборки
pnpm format             # oxfmt (≥ 0.71; версия 0.2.0 портила TS-типы)
```

Тесты:
- `src/auth/access.test.ts` — права ролей и scope;
- `src/data/adapters/normalize.test.ts` — ETL: схлопывание строк, дедупликация, построение target;
- `src/data/selectors/mobility.test.ts` — агрегация мобильности, доли = 100%, подавление малых групп;
- `src/data/mock/directorScope.test.ts` — scope директора, IDOR, запрет системных агрегатов;
- `src/services/forecast/forecast.test.ts` — контракт ForecastInput/ForecastResult, инвариант Шепли;
- `src/app/App.smoke.test.tsx` — рендер всех маршрутов для каждой роли, guard-ы, калькулятор;
- `src/data/local/decode.test.ts` — декодер формата реального датасета (на синтетическом мини-файле);
- `src/data/local/realDataset.test.ts` — сверка с ноутбуком и время ответов репозиториев на `public/data/real-dataset.json` (пропускается, если файла нет).

## Переменные окружения
Скопируйте `.env.example` в `.env.local`:

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `VITE_DATA_SOURCE` | `mock` | `mock` — синтетика в браузере; `local` — реальный датасет из `public/data/real-dataset.json` (так собирается GitHub Pages); `api` — REST backend |
| `VITE_API_BASE_URL` | `/api/v1` | базовый URL API |
| `VITE_MOCK_LATENCY_MS` | `250` (`0` для local) | задержка in-memory ответов (проверка loading-состояний) |

Секреты во frontend не хранятся.

## Реальные данные (режим local)
1. Датасет лежит в репозитории: `public/data/real-dataset.json` (~15 МБ, GitHub Pages отдаёт его сжатым, ~3 МБ). Vite копирует `public/` в `dist/`, файл доступен по `<BASE_URL>data/real-dataset.json`.
2. Локально: `.env.local` → `VITE_DATA_SOURCE=local`, затем `pnpm dev`. Workflow `.github/workflows/deploy.yml` собирает Pages с этой же переменной.
3. Пересборка из исходных xlsx: `python scripts/real-data/build_real_dataset.py --src "D:/CU/KAdri"` (Python 3.11+, pandas, numpy, openpyxl). Скрипт повторяет ноутбук «Неделя 4_ДЗ_Рачайочечки».
4. До первого рендера `bootstrapDataSource()` (`src/data/index.ts`) загружает и декодирует файл (`src/data/local/realDataset.ts`) и делает его активным набором in-memory источника. Репозитории, scope директора и DTO те же, что у mock. Backend для этого не нужен.

## Шрифты
Основной шрифт — TT Rounds Neue (текст), заголовки и крупные числа — TT Fellows, дополнительный — Comic Sans. Гарнитуры TT — коммерческие (TypeType) и в репозиторий не входят. Подключение:
- либо установить шрифты в систему (подхватываются через `local()`),
- либо положить лицензионные файлы в `public/fonts/`: `TTRoundsNeue-Regular.woff2`, `TTRoundsNeue-Medium.woff2`, `TTRoundsNeue-Bold.woff2`, `TTFellows-Regular.woff2`, `TTFellows-DemiBold.woff2`.

Пока файлов нет, используется Comic Sans.

## Структура `src/`

```
app/          App shell, hash-роутер, навигация, AppContext (глобальные фильтры в URL)
auth/         access.ts (RBAC/scope), SessionProvider, demoUsers (только демо)
components/   ui, charts (theme-aware Recharts), mobility (статусы с иконками), states, ThemeToggle
data/
  contracts/  raw.ts · normalized.ts · dto.ts · repositories.ts · errors.ts
  adapters/   normalize.ts — ETL raw → normalized (эталон правил)
  selectors/  mobility.ts, composition.ts — чистые агрегации
  mock/       generator (MOCK), mockDataset (DatasetIndex, активный набор), context (scope), mockRepositories, mockDataSource
  local/      realDataset.ts — декодер реального датасета (формат kd-real-dataset@1)
  api/        apiDataSource.ts
  index.ts    выбор mock/local/api, bootstrapDataSource()
  DataProvider.tsx
domain/       teacher, school, mobility, education, training, user, forecast, model
hooks/        useAsync
pages/        по одной странице на файл
services/
  api/        httpClient
  forecast/   validation, featureMapping, mockModel, mockForecastService, inferenceLog
  model/      mockModelService
theme/        ThemeProvider (light/dark/system, localStorage `kd-theme`)
```

## Правила
1. Страница получает данные только через `useData()` → репозиторий или сервис, внутри `useAsync` и `<Async>` (loading / error / empty / loaded).
2. Никаких hex-цветов в компонентах: только semantic tokens (`bg-surface`, `text-fg`, `var(--chart-1)`, `MOB[k].color`).
3. Новые показатели добавляются только если поле есть в источнике или однозначно выводится из него. Формулу нужно добавить в `DATA_DICTIONARY.md`.
4. Мобильность всегда подписывается периодом (`2023 → 2024`).
5. Проверки доступа во frontend служат UX. Серверная логика дублируется в mock-контексте и покрывается тестами.

## Как добавить эндпоинт
1. Тип ответа — в `data/contracts/dto.ts`.
2. Метод — в интерфейс в `repositories.ts`.
3. Реализация в `mockRepositories.ts` (через `ctx.snapshots` / `ctx.outcomes`, чтобы соблюдался scope) и в `apiDataSource.ts`.
4. Запись в `docs/API_CONTRACT.md`.

## Роуты
`#/overview`, `#/schools`, `#/schools/:id`, `#/staff`, `#/teachers/:id`, `#/dynamics`, `#/mobility`, `#/forecast`, `#/calculator`, `#/analytics`, `#/data`, `#/monitoring`. Query: `?year=2024&district=ЦАО`.

## Демо-роли
Переключатель «Демо-роль» в шапке имитирует вход разных пользователей (хранится в sessionStorage). Директор привязан к первой школе активного набора (в режиме local — школа с наименьшим номером). Проверка IDOR вручную: скопируйте из-под руководителя адрес другой школы (`#/schools/sch-…`), переключитесь на директора и откройте его.
