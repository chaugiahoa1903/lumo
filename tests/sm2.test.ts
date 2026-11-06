import { describe, expect, it } from "vitest";
import { DAY_MS, initialSrs, nextSrs } from "../lib/sm2";

describe("SM-2", () => {
  it("đúng liên tiếp: 1, 6, 15 ngày", () => {
    let s = initialSrs();
    const intervals: number[] = [];
    for (let i = 0; i < 3; i++) {
      const n = nextSrs(s, "good", 0);
      intervals.push(n.intervalDays);
      s = n;
    }
    expect(intervals).toEqual([1, 6, 15]);
    expect(s.ease).toBe(2.5);
  });

  it("sai thì về 1 ngày, đếm lapse và giảm ease", () => {
    let s = initialSrs();
    for (let i = 0; i < 3; i++) s = nextSrs(s, "good", 0);
    const n = nextSrs(s, "again", 0);
    expect(n.reps).toBe(0);
    expect(n.intervalDays).toBe(1);
    expect(n.lapses).toBe(1);
    expect(n.ease).toBe(2.18);
  });

  it("ease không xuống dưới 1,3", () => {
    let s = initialSrs();
    for (let i = 0; i < 8; i++) s = nextSrs(s, "again", 0);
    expect(s.ease).toBe(1.3);
  });

  it("dueAt = bây giờ + số ngày", () => {
    const n = nextSrs(initialSrs(), "good", 1000);
    expect(n.dueAt).toBe(1000 + DAY_MS);
  });
});