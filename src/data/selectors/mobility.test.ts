import { describe, expect, it } from "vitest";
import type { MobilityClass } from "../../domain/mobility";
import { MIN_GROUP_SIZE, countOutcomes, groupRow, mobilityByGroup, sharesOf } from "./mobility";

describe("mobility aggregation", () => {
  it("считает три класса отдельно", () => {
    expect(countOutcomes([0, 0, 1, 2, 2, 2] as MobilityClass[])).toEqual({
      stay: 2,
      move: 1,
      leave: 3,
    });
  });
  it("доли всегда суммируются ровно в 100", () => {
    for (const c of [
      { stay: 1, move: 1, leave: 1 },
      { stay: 2, move: 1, leave: 0 },
      { stay: 997, move: 2, leave: 1 },
      { stay: 7, move: 11, leave: 13 },
    ]) {
      const s = sharesOf(c);
      expect(Math.round((s.stay + s.move + s.leave) * 10) / 10).toBe(100);
    }
    expect(sharesOf({ stay: 0, move: 0, leave: 0 })).toEqual({
      stay: 0,
      move: 0,
      leave: 0,
    });
  });
  it("подавляет группы меньше порога", () => {
    const small = groupRow("мало", [2, 2] as MobilityClass[]);
    expect(small.suppressed).toBe(true);
    expect(small.shares).toEqual({ stay: 0, move: 0, leave: 0 });
    const big = groupRow("много", Array(MIN_GROUP_SIZE).fill(0) as MobilityClass[]);
    expect(big.suppressed).toBe(false);
    expect(big.shares.stay).toBe(100);
  });
  it("группирует по ключу и соблюдает заданный порядок", () => {
    const items = [
      ...Array(6).fill({ g: "B", status: 0 }),
      ...Array(5).fill({ g: "A", status: 2 }),
    ] as { g: string; status: MobilityClass }[];
    const rows = mobilityByGroup(items, (i) => i.g, ["A", "B"]);
    expect(rows.map((r) => r.group)).toEqual(["A", "B"]);
    expect(rows[0].shares.leave).toBe(100);
    expect(rows[1].counts.stay).toBe(6);
  });
});
