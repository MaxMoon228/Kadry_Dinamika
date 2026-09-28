import { describe, expect, it } from "vitest";
import type { User } from "../domain/user";
import { can, canViewSchool, restrictSchoolIds, scopeOf } from "./access";

const head: User = { id: "h", name: "H", role: "education_head" };

const analyst: User = { id: "a", name: "A", role: "analyst" };

const director: User = {
  id: "d",
  name: "D",
  role: "school_director",
  schoolId: "sch-1",
};

describe("RBAC", () => {
  it("руководитель и аналитик имеют system scope, директор — school scope", () => {
    expect(scopeOf(head)).toEqual({ kind: "system" });
    expect(scopeOf(analyst)).toEqual({ kind: "system" });
    expect(scopeOf(director)).toEqual({ kind: "school", schoolId: "sch-1" });
  });
  it("директор без schoolId — невалидная сессия", () => {
    expect(() =>
      scopeOf({
        id: "x",
        name: "X",
        role: "school_director",
      } as unknown as User),
    ).toThrow();
  });
  it("директор не видит список школ и системные агрегаты", () => {
    expect(can(director, "schools:list")).toBe(false);
    expect(can(director, "system:view")).toBe(false);
    expect(can(director, "school:view")).toBe(true);
  });
  it("технические страницы модели — только аналитик; retrain не выдаётся во frontend", () => {
    expect(can(analyst, "model:view_technical")).toBe(true);
    expect(can(analyst, "model:monitoring")).toBe(true);
    expect(can(head, "model:view_technical")).toBe(false);
    for (const u of [head, analyst, director]) expect(can(u, "model:retrain")).toBe(false);
  });
  it("school scope ограничивает набор школ одной своей", () => {
    const s = scopeOf(director);
    expect(canViewSchool(s, "sch-1")).toBe(true);
    expect(canViewSchool(s, "sch-2")).toBe(false);
    expect(restrictSchoolIds(s, ["sch-1", "sch-2", "sch-3"])).toEqual(["sch-1"]);
    expect(restrictSchoolIds(scopeOf(head), ["sch-1", "sch-2"])).toEqual(["sch-1", "sch-2"]);
  });
});
