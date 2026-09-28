# Словарь данных

Обозначения: **UI** — используется в интерфейсе; **ML** — кандидат в признаки модели (решение принимается по результатам EDA, см. ML_ARCHITECTURE.md §3); **R/D** — raw (из источника) / derived (вычисляется).

## Таблица 1. «Учителя» → `TeacherYearSnapshot`

| Исходное поле | Canonical | Тип | Null | UI | ML | R/D | Примечание |
|---|---|---|---|---|---|---|---|
| Идентификатор | `teacher_id` | string | нет | да (обезличен) | нет (ключ) | R | Стабильность между годами требует проверки |
| Краткое наименование ОО | `school_id` | string (FK) | нет | да | через school-признаки | R→ключ | Суррогат от названия |
| Основная должность | `main_position` | category | да | да | да | R | Может отличаться при совместительстве |
| Направление деятельности | `activity_direction` | category | да | да | да | R | Например «Математика» |
| Пол | `gender` | enum female/male | да | да (профиль) | осторожно | R | Чувствительный: нужен fairness-аудит |
| Возраст | `age` | int | да | да | да | R | Чувствительный |
| Учёная степень | `academic_degree` | category | да | да | да | R | Кандидат / доктор наук |
| Квалификационная категория | `qualification_category` | category | да (= без категории) | да | да | R | Высшая / Первая / Вторая |
| Дата присвоения категории | `qualification_assigned_at` | date | да | да | через derived | R | |
| Срок действия категории | `qualification_valid_until` | date | да | да | через derived | R | Может быть бессрочной (приказ № 196) |
| Общий стаж работы | `total_experience_years` | number | да | да | да | R | |
| Стаж педагогической работы | `pedagogical_experience_years` | number | да | да | да | R | |
| Предмет | `assignments[].subject` | category (multi) | да | да | да | R | Строки дублируются по предметам |
| Параллель | `assignments[].parallel` | category (multi) | да | да | да | R | «5», «10»… |
| Преподаёт в предпроф. классах | `preprofessional_direction` | category / NULL | да | да | да | R | Значение = направление |
| Имеет классное руководство | `is_class_teacher` | bool | да | да | да | R | Да/Нет |
| (Год среза) | `year` | int | нет | да | нет (split) | R | Способ задания уточняется |

## Таблица 2. «Образование» → `TeacherEducation[]`

| Исходное поле | Canonical | Тип | Null | UI | ML | R/D |
|---|---|---|---|---|---|---|
| Идентификатор | `teacher_id` | string FK | нет | — | — | R |
| Тип образования | `education_type` | category | нет | да | через агрегаты | R |
| Наименование учебного заведения | `institution` | category (high-card) | да | да (профиль) | осторожно | R |
| Дата окончания | `graduation_date` | date | да | да | через derived | R |
| Специализация | `specialization` | category | да | да | да | R |
| Квалификация | `qualification` | category | да | да | да | R |
| — | `first_seen_year` | int | нет | нет | нет | D (ETL) |

## Таблица 3. «Повышение квалификации» → `TeacherTraining[]`

| Исходное поле | Canonical | Тип | Null | UI | ML | R/D |
|---|---|---|---|---|---|---|
| Идентификатор | `teacher_id` | string FK | нет | — | — | R |
| Наименование программы | `program_name` | text | нет | да (профиль) | нет (текст) | R |
| ПП или ПК | `program_type` | enum ПК/ПП | нет | да | через агрегаты | R |
| Организатор программы | `provider` | category | да | да (профиль) | осторожно | R |
| Количество часов | `hours` | number | да | да | через агрегаты | R |
| Дата получения документа | `document_date` | date | да | да | через агрегаты | R |

## Таблица 4. «Школы» → `School` + `SchoolYearSnapshot`

| Исходное поле | Canonical | Тип | Null | UI | ML | R/D |
|---|---|---|---|---|---|---|
| Школа | `school.name` → `school_id` | string | нет | да | нет (ключ) | R |
| Округ | `district` | category | да | да | да | R |
| Количество зданий | `building_count` | int | да | да | да | R |
| Общая численность контингента | `student_count` | int | да | да | да | R |

## Производные признаки

| Canonical | Формула / процедура | UI | ML | Leakage-контроль |
|---|---|---|---|---|
| `teacher_count` (школа, год) | count distinct `teacher_id` в `teacher_year` (школа, t) | да | да | только t |
| `students_per_teacher` | `student_count / teacher_count` (t) | да | да | только t |
| `teacher_count_change` | `teacher_count(t) − teacher_count(first year)` | да | нет | в модели только прошлые годы |
| `under35_share`, `over60_share` | доля педагогов с age < 35 / ≥ 60 среди известных | да | school-level | только t |
| `with_category_share` | доля Высшая + Первая | да | school-level | только t |
| `subject_count`, `parallel_count` | число уникальных предметов / параллелей | да | да | — |
| `training_count` | число документов ПК/ПП с датой ≤ 31.12.t | да | да | дата ≤ среза |
| `training_hours_total` | Σ часов по тем же документам | да | да | дата ≤ среза |
| `training_hours_recent_3y` | Σ часов за (t−2 … t) | да | да | дата ≤ среза |
| `has_professional_retraining` | ∃ ПП с датой ≤ среза | да | да | дата ≤ среза |
| `years_since_last_training` | t − год последнего документа | да | да | NULL, если нет |
| `years_since_qualification` | t − год присвоения категории | да | да | — |
| `qualification_remaining_years` | год окончания срока − t | нет | да | только если срок задан |
| `years_since_graduation` | t − год последнего окончания обучения | да | да | `first_seen_year ≤ t` |
| `has_higher_education` | ∃ тип «Высшее…» | нет | да | — |
| `experience_gap` | total − pedagogical | нет | да | — |
| `school_mobility_prev` | доля исходов 1/2 школы за (t−1 → t) | нет | да | **только прошлый период** |
| `mobility_status` (target) | см. DATA_INTEGRATION_PLAN §8 | да | target | — |

## Поля, которых в источнике нет

Заработная плата, учебная нагрузка в часах, ставки, удовлетворённость, вовлечённость, выгорание, причины ухода, KPI, дата найма в текущую школу, стаж в текущей школе, полная карьерная история, муниципалитет или район (есть только округ). Такие показатели не используются в UI и ML. «Стаж в текущей школе» можно оценить только цензурированно, по числу подряд идущих срезов в той же школе (максимум 3), с явной пометкой «в пределах окна наблюдения».
