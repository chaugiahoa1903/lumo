import { describe, expect, it } from "vitest";
import { pickByMode, rankModulesByGoal, type GoalModule } from "../lib/goalfit";

const mods: GoalModule[] = [
  { id: 1, title: "Chapter 1. Joins", text: "inner join left join combine tables on matching keys join join", minutes: 30 },
  { id: 2, title: "Chapter 2. Filtering", text: "where clause filter rows numbers text conditions where where", minutes: 30 },
  { id: 3, title: "Chapter 3. Design", text: "schema create table foreign key primary key design planning", minutes: 30 },
  { id: 4, title: "Appendix A. Functions", text: "functions operators reference where join design", minutes: 20, optional: true },
];

describe("rankModulesByGoal", () => {
  it("module đúng chủ đề điểm cao nhất", () => {
    const r = rankModulesByGoal("I want to join tables", mods);
    const best = [...r].sort((a, b) => b.score - a.score)[0];
    expect(best.id).toBe(1);
    expect(best.matched).toContain("join");
  });
  it("mục tiêu rỗng hoặc toàn từ không có trong sách thì mọi điểm bằng 0", () => {
    expect(rankModulesByGoal("", mods).every((x) => x.score === 0)).toBe(true);
    expect(rankModulesByGoal("zzzqqq xxxyyy", mods).every((x) => x.score === 0)).toBe(true);
  });
  it("điểm nằm trong 0..1", () => {
    for (const x of rankModulesByGoal("filter rows with where", mods)) {
      expect(x.score).toBeGreaterThanOrEqual(0);
      expect(x.score).toBeLessThanOrEqual(1.0001);
    }
  });
});

describe("pickByMode", () => {
  const ranks = rankModulesByGoal("filter rows where condition", mods);
  it("full: mọi module trừ phụ lục", () => {
    expect([...pickByMode(ranks, mods, "full")].sort()).toEqual([1, 2, 3]);
  });
  it("skim chọn ít hơn core, và luôn có module liên quan nhất", () => {
    const skim = pickByMode(ranks, mods, "skim");
    const core = pickByMode(ranks, mods, "core");
    expect(skim.has(2)).toBe(true);
    expect(skim.size).toBeLessThanOrEqual(core.size);
  });
  it("không chọn phụ lục ở skim/core và không chọn module điểm 0", () => {
    const core = pickByMode(rankModulesByGoal("schema foreign key", mods), mods, "core");
    expect(core.has(4)).toBe(false);
    expect(core.has(3)).toBe(true);
  });
  it("không lấp thêm module điểm thấp chỉ để đủ thời gian", () => {
    const only = pickByMode(rankModulesByGoal("inner join left join", mods), mods, "core");
    expect(only.has(1)).toBe(true);
    for (const id of only) {
      const r = rankModulesByGoal("inner join left join", mods).find((q) => q.id === id)!;
      const top = Math.max(...rankModulesByGoal("inner join left join", mods).map((q) => q.score));
      expect(r.score).toBeGreaterThanOrEqual(top * 0.45 - 1e-9);
    }
  });
});
