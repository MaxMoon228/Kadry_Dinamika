"""
Сборка реального датасета для сайта.

Повторяет пайплайн ноутбука «Неделя 4_ДЗ_Рачайочечки.ipynb» (команда «Рачайочечки»)
шаг за шагом и получает итоговую таблицу df_final (одна строка = учитель × год).
Дополнительно сохраняет детали, нужные карточкам сайта (предметы × параллели,
записи об образовании и ПК/ПП, исходы периодов).

Запуск:
    python scripts/real-data/build_real_dataset.py --src "D:/CU/KAdri"

Результат: public/data/real-dataset.json — статический файл, который сайт загружает
при старте (в dev-сервере и в сборке для GitHub Pages).
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import time
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

YEARS = [2022, 2023, 2024]
FORMAT = "kd-real-dataset@1"


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ----------------------------------------------------------------------------- загрузка


def read_years(path: Path) -> list[pd.DataFrame]:
    frames = []
    for y in YEARS:
        df = pd.read_excel(path, sheet_name=str(y))
        df["year"] = y
        frames.append(df)
    return frames


# ----------------------------------------------------------------------------- ноутбук: Учитель


def build_pedagog(src: Path):
    raw = read_years(src / "Педагоги.xlsx")
    df = pd.concat(raw, axis=0)
    df = df.rename(
        columns={
            "ID образовательной организации": "school_num",
            "Основная должность": "main_position",
            "Направление деятельности": "speciality",
            "Пол": "sex",
            "Возраст": "age",
            "Ученая степень": "academic_degree",
            "Квалификационная категория (педагогического работника)": "category_qual",
            "Дата присвоения квалификационной категории": "category_date",
            "Срок действия квалификационной категории": "category_due",
            "Общий стаж работы": "experience_age_all",
            "Стаж педагогической работы": "experience_age_pedagogic",
            "Предмет": "subject",
            "Параллель": "parallel",
            "Имеет классное руководство": "class_manager",
        }
    )

    keywords = ["педагог", "учитель", "методист", "преподават", "воспитатель", "тьютор"]
    matching_pedagog = {
        item
        for item in df.main_position.values
        if any(sub in str(item).lower() for sub in keywords)
    }
    matching_pedagog = {i for i in matching_pedagog if "заместитель" not in str(i).lower()}
    keywords_manager = ["заместитель", "ведущий", "заведующий", "руководитель", "начальник", "главный"]
    matching_manager = {
        item
        for item in df.main_position.values
        if any(sub in str(item).lower() for sub in keywords_manager)
    }
    matching_other = set(df.main_position.unique()).difference(matching_pedagog | matching_manager)
    matching_dict = {}
    for v in matching_pedagog:
        matching_dict[v] = "учитель"
    for v in matching_manager:
        matching_dict[v] = "руководитель"
    for v in matching_other:
        matching_dict[v] = "другой"
    df["main_position_cat"] = df["main_position"].map(matching_dict).fillna("не_найдено")

    df["sex"] = df["sex"].map({"Мужской": 1, "Женский": 0})

    def find_first(text, kw):
        if pd.isna(text):
            return "не_найдено"
        text = str(text).lower()
        for word, code in kw.items():
            if word in text:
                return code
        return "не_найдено"

    df["academic_degree_cat"] = df["academic_degree"].apply(
        lambda t: find_first(t, {"доктор": "доктор", "кандидат": "кандидат"})
    )
    df["category_qual_cat"] = df["category_qual"].apply(
        lambda t: find_first(t, {"высшая": "высшая", "первая": "первая", "вторая": "вторая"})
    )

    df["category_date"] = pd.to_numeric(df["category_date"], errors="coerce").astype("Int64")
    df["category_due"] = pd.to_numeric(df["category_due"], errors="coerce").astype("Int64")
    due = df["category_due"]
    df["category_active"] = np.where(
        due.isna(), "не было", np.where(due.fillna(0) > df["year"], "активно", "не активно")
    )

    df["experience_age_other"] = df.experience_age_all - df.experience_age_pedagogic
    df["n_unique_subjects"] = df.groupby(["year", "id"])["subject"].transform("nunique")
    df["min_parallel"] = df.groupby(["year", "id"])["parallel"].transform("min")
    df["max_parallel"] = df.groupby(["year", "id"])["parallel"].transform("max")
    df["n_unique_parallel"] = df.groupby(["year", "id"])["parallel"].transform("nunique")
    df["class_manager"] = df["class_manager"].map({"Да": 1, "Нет": 0})
    return raw, df


# ----------------------------------------------------------------------------- ноутбук: Образование, ПК-ПП, Школы


def build_edu(src: Path) -> pd.DataFrame:
    df = pd.concat(read_years(src / "Образование.xlsx"), axis=0)
    df = df.rename(
        columns={
            "Тип образования": "type_education",
            "Наименование учебного заведения": "edu_org_name",
            "Дата окончания": "date_pass",
            "Специализация": "specialization_edu",
            "Квалификация": "qualification",
        }
    )
    df["date_pass"] = pd.to_numeric(df["date_pass"], errors="coerce").astype("Int64")

    def change_type_education(v):
        if v in ["Высшее образование - подготовка кадров высшей квалификации", "Аспирантура"]:
            return "Аспирантура"
        if v in [
            "Высшее образование",
            "Высшее образование - специалитет, магистратура",
            "Высшее образование - бакалавриат",
        ]:
            return "Высшее образование"
        if v in ["Среднее профессиональное образование"]:
            return "СПО"
        if v in [
            "Неполное высшее образование",
            "Среднее (полное) общее образование",
            "Среднее общее образование",
            "Основное общее образование",
        ]:
            return "Школа"
        return "Нет информации"

    df["high_type_education"] = df["type_education"].map(change_type_education)
    priority = ["Аспирантура", "Высшее образование", "СПО", "Школа", "Нет информации"]

    def best(group):
        vals = set(group.values)
        for cat in priority:
            if cat in vals:
                return cat
        return group.iloc[0]

    df["high_type_education"] = df.groupby("id")["high_type_education"].transform(best)
    return df


def build_pkpp(src: Path) -> pd.DataFrame:
    df = pd.concat(read_years(src / "ПК-ПП.xlsx"), axis=0)
    df = df.rename(
        columns={
            "Наименование программы": "name_prog",
            "Программа профессиональной переподготовки(ПП)/повышения квалификации(ПК)": "type_prog",
            "Количество часов": "hours_tot",
            "Дата получения документа/освоения программы": "date_done",
        }
    )
    df["is_pedagog"] = df["name_prog"].str.contains("преподавания|курса", na=False, case=False).astype(int)
    return df


def build_school(src: Path) -> pd.DataFrame:
    df = pd.read_excel(src / "Школы.xlsx")
    return df.rename(
        columns={
            "Школа": "school_num",
            "Округ": "district",
            "Кол-во зданий": "buildings_num",
            "Общая численность контингента": "students_num",
        }
    )


# ----------------------------------------------------------------------------- ноутбук: шаг 2 — чистка текста


def clean_text(s: pd.Series) -> pd.Series:
    s = s.str.lower()
    s = s.str.replace("ё", "е")
    s = s.str.replace(r"\s+", " ", regex=True)
    s = s.str.strip(" .,;:")
    s = s.replace(["-", ""], np.nan)
    return s


def find_typos(s: pd.Series, min_freq=100, max_freq=3) -> dict[str, str]:
    words = s.dropna().str.findall(r"[а-я]{6,}").explode().value_counts()
    frequent = list(words[words >= min_freq].index)
    rare = words[words <= max_freq].index
    typos = {}
    for word in rare:
        match = difflib.get_close_matches(word, frequent, n=1, cutoff=0.88)
        if match:
            right = match[0]
            if right[0] == word[0] and right[-2:] == word[-2:] and abs(len(right) - len(word)) <= 2:
                typos[word] = right
    return typos


def fix_typos(s: pd.Series, typos: dict[str, str]) -> pd.Series:
    return s.str.replace(r"[а-я]+", lambda m: typos.get(m.group(0), m.group(0)), regex=True)


def clean_all(ped, edu, pk, school):
    frames = {"Педагоги": ped, "Образование": edu, "ПК-ПП": pk, "Школы": school}
    text_cols = {
        "Педагоги": ["main_position", "speciality", "academic_degree", "category_qual", "subject"],
        "Образование": ["type_education", "edu_org_name", "specialization_edu", "qualification"],
        "ПК-ПП": ["name_prog", "type_prog"],
        "Школы": ["district"],
    }
    for name, cols in text_cols.items():
        for col in cols:
            frames[name][col] = clean_text(frames[name][col])

    free_text_cols = {
        "Педагоги": ["main_position", "speciality", "subject"],
        "Образование": ["edu_org_name", "specialization_edu", "qualification"],
        "ПК-ПП": ["name_prog"],
    }
    n_typos = 0
    for name, cols in free_text_cols.items():
        for col in cols:
            typos = find_typos(frames[name][col])
            frames[name][col] = fix_typos(frames[name][col], typos)
            n_typos += len(typos)

    pos = ped["main_position"]
    pos = pos.str.replace(r"\s*-\s*", "-", regex=True)
    pos = pos.str.replace("допонительного", "дополнительного")
    pos = pos.replace(
        {
            "педагог организатор": "педагог-организатор",
            "преподаватель-организатор обж": "преподаватель-организатор основ безопасности жизнедеятельности",
            "педагог-организатор обж": "преподаватель-организатор основ безопасности жизнедеятельности",
            "педагог организатор безопасности жизнедеятельности": "преподаватель-организатор основ безопасности жизнедеятельности",
        }
    )
    pos = pos.mask(pos.str.startswith("учитель ") | pos.str.startswith("учитель,"), "учитель")
    pos = pos.mask(pos.str.startswith("воспитатель "), "воспитатель")
    ped["main_position"] = pos

    subj = ped["subject"]
    subj = subj.str.replace(r"^иностранный язык \((\w+)\)$", r"\1 язык", regex=True)
    subj = subj.replace(
        {
            "физическая культура (адаптивная физическая культура)": "адаптивная физическая культура",
            "физическая культура адаптивная": "адаптивная физическая культура",
            "вероятность и статистика": "теория вероятностей и статистика",
        }
    )
    ped["subject"] = subj

    edu["type_education"] = edu["type_education"].replace(
        {
            "среднее (полное) общее образование": "среднее общее образование",
            "высшее образование - подготовка кадров высшей квалификации": "аспирантура",
        }
    )
    ped["academic_degree"] = ped["academic_degree"].replace({"кандидат наук 1": "кандидат наук"})

    org = edu["edu_org_name"]
    org = org.str.replace(r'["""“”]', "", regex=True)
    org = org.str.replace(
        r"^(фгбоу|фгаоу|гбоу|гаоу|гоу|фгоу|ноу|чоу|ано|моу|оу)\s+(во|впо|спо|дпо)?\s*", "", regex=True
    )
    org = org.replace(
        {
            "мпгу": "московский педагогический государственный университет",
            "мгпу": "московский городской педагогический университет",
        }
    )
    edu["edu_org_name"] = org
    ped["n_unique_subjects"] = ped.groupby(["year", "id"])["subject"].transform("nunique")
    return n_typos


# ----------------------------------------------------------------------------- ноутбук: шаг 3–5


SUBJECT_GROUPS = {
    "иностранные языки": ["англ", "немец", "француз", "испан", "китай", "итальян", "арабск", "иностран"],
    "русский язык и литература": ["русск", "литератур", "чтени", "родной язык", "словесн", "речев", "ритори"],
    "математика и информатика": ["математ", "алгебр", "геометр", "информат", "программ", "вероятност", "статистик", "робот"],
    "физкультура и обж": ["физическая культура", "безопасност", "обж", "ритмик", "плавани", "шахмат", "спорт"],
    "естественные науки": ["физик", "физич", "хими", "биолог", "географ", "естествозн", "окружающий мир", "астроном", "эколог"],
    "общественные науки": ["истори", "обществозн", "экономик", "право", "духовно", "православ", "этик", "религи"],
    "искусство и технология": ["музык", "изобразительн", "искусств", "художествен", "технолог", "черчени", "труд"],
}


def get_subject_group(subject) -> str:
    if pd.isna(subject):
        return "другое"
    for group, words in SUBJECT_GROUPS.items():
        if any(w in subject for w in words):
            return group
    return "другое"


def make_target(df_presence: pd.DataFrame) -> pd.DataFrame:
    last_year = df_presence["year"].max()
    nxt = df_presence[["id", "school_num", "year"]].copy()
    nxt["year"] = nxt["year"] - 1
    nxt = nxt.rename(columns={"school_num": "school_next_year"})
    df = df_presence.merge(nxt, on=["id", "year"], how="left")
    df["target"] = np.where(
        df["year"] == last_year,
        np.nan,
        np.where(
            df["school_next_year"].isna(), 1, np.where(df["school_next_year"] == df["school_num"], 0, 2)
        ),
    )
    return df


# ----------------------------------------------------------------------------- экспорт


class Strings:
    """Словарь строк: в JSON хранятся индексы, чтобы файл был компактным."""

    def __init__(self) -> None:
        self.items: list[str] = []
        self.index: dict[str, int] = {}

    def __call__(self, v) -> int:
        if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA:
            return -1
        v = str(v)
        if v == "" or v == "nan":
            return -1
        i = self.index.get(v)
        if i is None:
            i = len(self.items)
            self.items.append(v)
            self.index[v] = i
        return i


ACRONYMS = re.compile(
    r"(?<![а-яa-z])(егэ|огэ|гиа|обж|изо|икт|фгос|фгбоу|фгаоу|гбоу|мгу|мпгу|мгпу|мгппу|рф|ссср|рсфср|"
    r"мосгорисполкома|пк|пп|it|ит|3d|оо|доо|спо|впо|дпо)(?![а-яa-z])"
)


def cap(v):
    """Ноутбук приводит текст к нижнему регистру; для показа на сайте — первая буква заглавная
    и аббревиатуры (ЕГЭ, ОБЖ, ИЗО…) прописными."""
    if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA:
        return None
    v = ACRONYMS.sub(lambda m: m.group(0).upper() if m.group(0) != "мосгорисполкома" else "Мосгорисполкома", str(v))
    return v[:1].upper() + v[1:] if v else None


def to_int(v) -> int:
    if v is None or v is pd.NA or (isinstance(v, float) and np.isnan(v)):
        return -1
    return int(v)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="D:/CU/KAdri", help="папка с Педагоги/Образование/ПК-ПП/Школы.xlsx")
    ap.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[2] / "public" / "data" / "real-dataset.json"),
    )
    args = ap.parse_args()
    src = Path(args.src)
    out = Path(args.out)
    sys.stdout.reconfigure(encoding="utf-8")

    log("Чтение Педагоги.xlsx …")
    raw_ped, ped = build_pedagog(src)
    log("Чтение Образование.xlsx …")
    edu = build_edu(src)
    log("Чтение ПК-ПП.xlsx …")
    pk = build_pkpp(src)
    school = build_school(src)
    raw_counts = {"teachers": len(ped), "education": len(edu), "training": len(pk), "schools": len(school)}

    unknown_school_rows = int((~ped["school_num"].isin(school["school_num"])).sum())
    ped = ped[ped["school_num"].isin(school["school_num"])]
    ped = ped.reset_index(drop=True)
    edu = edu.reset_index(drop=True)
    pk = pk.reset_index(drop=True)

    dup_edu = int(edu.duplicated().sum())
    dup_pk = int(pk.duplicated().sum())
    edu = edu.drop_duplicates().reset_index(drop=True)
    pk = pk.drop_duplicates().reset_index(drop=True)

    log("Чистка текста и поиск опечаток …")
    n_typos = clean_all(ped, edu, pk, school)

    ped["subject_group"] = ped["subject"].apply(get_subject_group)
    ped["is_exam_subject"] = ped["subject"].str.contains("егэ|огэ|гиа", na=False).astype(int)
    ped_words = "педагог|учител|преподава|методик"
    edu["is_ped_education"] = (
        edu["specialization_edu"].str.contains(ped_words, na=False)
        | edu["qualification"].str.contains(ped_words, na=False)
        | edu["edu_org_name"].str.contains(ped_words, na=False)
    ).astype(int)
    pk["is_gia_course"] = pk["name_prog"].str.contains("итоговой аттестации|экзамен", na=False).astype(int)
    pk["type_prog"] = pk["type_prog"].map({"пп": 1, "пк": 0})

    # --- target (по исходным листам до фильтрации школ, как в ноутбуке)
    presence = pd.concat(raw_ped)[["id", "ID образовательной организации", "year"]]
    presence = presence.rename(columns={"ID образовательной организации": "school_num"}).drop_duplicates()
    multi_school = int(presence.duplicated(["id", "year"]).sum())
    presence = presence.drop_duplicates(["id", "year"])
    df_target = make_target(presence)

    # --- итоговая таблица df_final
    person_cols = [
        "id", "year", "school_num", "main_position", "main_position_cat", "sex", "age",
        "academic_degree_cat", "category_qual_cat", "category_active",
        "experience_age_all", "experience_age_pedagogic", "experience_age_other",
        "n_unique_subjects", "min_parallel", "max_parallel", "n_unique_parallel",
    ]
    df_teacher = ped.drop_duplicates(["id", "year"])[person_cols]
    teacher_agg = (
        ped.groupby(["id", "year"])
        .agg(
            class_manager=("class_manager", "max"),
            is_exam_subject=("is_exam_subject", "max"),
            main_subject_group=("subject_group", lambda x: x.value_counts().index[0]),
        )
        .reset_index()
    )
    edu_agg = (
        edu.groupby(["id", "year"])
        .agg(is_ped_education=("is_ped_education", "max"), high_type_education=("high_type_education", "first"))
        .reset_index()
    )
    pk_agg = (
        pk.groupby(["id", "year"])
        .agg(
            n_courses=("name_prog", "count"),
            hours_courses=("hours_tot", "sum"),
            n_gia_courses=("is_gia_course", "sum"),
            has_pp=("type_prog", "max"),
        )
        .reset_index()
    )
    df_final = (
        df_teacher.merge(teacher_agg, on=["id", "year"], how="left")
        .merge(school, on="school_num", how="left")
        .merge(edu_agg, on=["id", "year"], how="left")
        .merge(pk_agg, on=["id", "year"], how="left")
        .merge(df_target[["id", "year", "target", "school_next_year"]], on=["id", "year"], how="left")
    )
    pk_cols = ["n_courses", "hours_courses", "n_gia_courses", "has_pp"]
    df_final[pk_cols] = df_final[pk_cols].fillna(0).astype(int)
    df_final["is_ped_education"] = df_final["is_ped_education"].fillna(0).astype(int)
    df_final["high_type_education"] = df_final["high_type_education"].fillna("Нет информации")
    df_final = df_final.reset_index(drop=True)
    log(f"df_final: {df_final.shape}, известный исход: {int(df_final['target'].notna().sum())}")

    # --- детали срезов: исходный (до чистки) текст для дат/категорий не нужен — берём очищенный
    ped_first = ped.drop_duplicates(["id", "year"]).set_index(["id", "year"])
    S = Strings()
    teacher_ids = sorted(df_final["id"].unique())
    tidx = {t: i for i, t in enumerate(teacher_ids)}

    assign = (
        ped[["id", "year", "subject", "parallel"]]
        .dropna(subset=["subject"])
        .drop_duplicates()
        .sort_values(["id", "year", "parallel", "subject"])
    )
    assign_map: dict[tuple, list[int]] = {}
    for row in assign.itertuples(index=False):
        par = to_int(row.parallel)
        code = S(cap(row.subject)) * 16 + (par if 0 <= par <= 14 else 15)
        assign_map.setdefault((row.id, row.year), []).append(code)

    CAT = {"высшая": "Высшая", "первая": "Первая", "вторая": "Вторая"}
    TARGET_TO_SITE = {0: 0, 1: 2, 2: 1}  # ноутбук: 1 — ушёл, 2 — перевёлся; сайт: 1 — перешёл, 2 — ушёл

    cols: dict[str, list] = {k: [] for k in [
        "t", "y", "s", "pos", "dir", "sex", "age", "deg", "cat", "catFrom", "catTo",
        "expAll", "expPed", "cls", "asg",
        "posCat", "degCat", "catCat", "catActive", "expOther", "nSubj", "minPar", "maxPar", "nPar",
        "exam", "subjGroup", "pedEdu", "highEdu", "nCourses", "hours", "nGia", "hasPP",
        "target", "status", "toSchool",
    ]}
    for r in df_final.itertuples(index=False):
        p = ped_first.loc[(r.id, r.year)]
        cols["t"].append(tidx[r.id])
        cols["y"].append(int(r.year))
        cols["s"].append(int(r.school_num))
        cols["pos"].append(S(cap(r.main_position)))
        cols["dir"].append(S(cap(p["speciality"])))
        cols["sex"].append(to_int(r.sex))
        cols["age"].append(to_int(r.age))
        cols["deg"].append(S(cap(p["academic_degree"])))
        cols["cat"].append(S(CAT.get(r.category_qual_cat)))
        cols["catFrom"].append(to_int(p["category_date"]))
        cols["catTo"].append(to_int(p["category_due"]))
        cols["expAll"].append(to_int(r.experience_age_all))
        cols["expPed"].append(to_int(r.experience_age_pedagogic))
        cols["cls"].append(to_int(r.class_manager))
        cols["asg"].append(assign_map.get((r.id, r.year), []))
        cols["posCat"].append(S(r.main_position_cat))
        cols["degCat"].append(S(r.academic_degree_cat))
        cols["catCat"].append(S(r.category_qual_cat))
        cols["catActive"].append(S(r.category_active))
        cols["expOther"].append(to_int(r.experience_age_other))
        cols["nSubj"].append(to_int(r.n_unique_subjects))
        cols["minPar"].append(to_int(r.min_parallel))
        cols["maxPar"].append(to_int(r.max_parallel))
        cols["nPar"].append(to_int(r.n_unique_parallel))
        cols["exam"].append(to_int(r.is_exam_subject))
        cols["subjGroup"].append(S(r.main_subject_group))
        cols["pedEdu"].append(to_int(r.is_ped_education))
        cols["highEdu"].append(S(r.high_type_education))
        cols["nCourses"].append(to_int(r.n_courses))
        cols["hours"].append(to_int(r.hours_courses))
        cols["nGia"].append(to_int(r.n_gia_courses))
        cols["hasPP"].append(to_int(r.has_pp))
        tg = to_int(r.target)
        cols["target"].append(tg)
        cols["status"].append(TARGET_TO_SITE.get(tg, -1))
        cols["toSchool"].append(to_int(r.school_next_year))

    # --- образование: схлопываем повторы накопительного итога (год первого появления)
    ids = set(teacher_ids)
    e = edu[edu["id"].isin(ids)].copy()
    key = ["id", "type_education", "edu_org_name", "date_pass", "specialization_edu", "qualification"]
    e_first = e.groupby(key, dropna=False)["year"].min().reset_index()
    cumulative = int(len(e) - len(e_first))
    edu_cols: dict[str, list] = {k: [] for k in ["t", "type", "org", "date", "spec", "qual", "first"]}
    for r in e_first.itertuples(index=False):
        if pd.isna(r.type_education):
            continue
        edu_cols["t"].append(tidx[r.id])
        edu_cols["type"].append(S(cap(r.type_education)))
        edu_cols["org"].append(S(cap(r.edu_org_name)))
        edu_cols["date"].append(to_int(r.date_pass))
        edu_cols["spec"].append(S(cap(r.specialization_edu)))
        edu_cols["qual"].append(S(cap(r.qualification)))
        edu_cols["first"].append(int(r.year))

    # --- ПК/ПП
    t = pk[pk["id"].isin(ids)]
    tr_cols: dict[str, list] = {k: [] for k in ["t", "name", "pp", "hours", "year", "gia"]}
    for r in t.itertuples(index=False):
        if pd.isna(r.name_prog):
            continue
        done = pd.to_numeric(pd.Series([r.date_done]), errors="coerce").iloc[0]
        if pd.isna(done):
            d = pd.to_datetime(r.date_done, errors="coerce")
            done = d.year if not pd.isna(d) else r.year
        tr_cols["t"].append(tidx[r.id])
        tr_cols["name"].append(S(cap(r.name_prog)))
        tr_cols["pp"].append(to_int(r.type_prog))
        tr_cols["hours"].append(to_int(r.hours_tot))
        tr_cols["year"].append(int(done))
        tr_cols["gia"].append(to_int(r.is_gia_course))

    schools_out = [
        [int(r.school_num), S(cap(r.district)), to_int(r.buildings_num), to_int(r.students_num)]
        for r in school.itertuples(index=False)
    ]

    missing = {
        "Педагоги.Возраст": int(df_final["age"].isna().sum()),
        "Педагоги.Квалификационная категория": int((df_final["category_qual_cat"] == "не_найдено").sum()),
        "Педагоги.Направление деятельности": int(ped_first["speciality"].isna().sum()),
        "Образование: нет записей у педагога": int(len(ids - set(e["id"]))),
    }
    report = {
        "rawRowCounts": raw_counts,
        "exactDuplicatesRemoved": {"teachers": 0, "education": dup_edu, "training": dup_pk, "schools": 0},
        "cumulativeEducationCollapsed": cumulative,
        "conflictingTeacherYears": 0,
        "multiSchoolTeacherYears": multi_school,
        "unknownSchoolRows": unknown_school_rows,
        "missingValues": missing,
        "unknownCategoryValues": [],
        "typosFixed": n_typos,
        "finalRows": int(len(df_final)),
        "finalColumns": int(df_final.shape[1] - 1),
        "knownTargetRows": int(df_final["target"].notna().sum()),
    }

    payload = {
        "format": FORMAT,
        "version": f"real-donm-{date.today().isoformat()}",
        "generatedAt": date.today().isoformat(),
        "source": "Неделя 4_ДЗ_Рачайочечки.ipynb · df_final",
        "years": YEARS,
        "strings": S.items,
        "teachers": teacher_ids,
        "schools": schools_out,
        "snapshots": cols,
        "education": edu_cols,
        "training": tr_cols,
        "report": report,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    log(f"Готово: {out} ({out.stat().st_size / 1e6:.1f} МБ), строк df_final = {len(df_final)}")
    log(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
