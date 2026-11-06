import { describe, expect, it } from "vitest";
import type { Module, Review, Task } from "../lib/db";
import { computeMastery } from "../lib/mastery";
import { BADGES, type Stats } from "../lib/badges";
import { levelInfo, sumXp } from "../lib/xp";

const mod = { id: 1, courseId: 1, title: "A", order: 0 } as Module;
const t = (o: Partial<Task>) =>
  ({ courseId: 1, moduleId: 1, order: 0, type: "read", title: "t", estMinutes: 1, status: "done", isMilestone: false, ...o }) as Task;
const rv = (taskId: number, reps: number) => ({ taskId, courseId: 1, ease: 2.5, intervalDays: 1, reps, lapses: 0, dueAt: 0 }) as Review;

describe("levelInfo", () => {
  it("ngưỡng cấp", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, span: 100, toNext: 100 });
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100)).toMatchObject({ level: 2, into: 0, span: 200 });
    expect(levelInfo(299).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
  });

  it("có tên cho mọi cấp", () => {
    expect(levelInfo(1_000_000).title.length).toBeGreaterThan(0);
  });
});

describe("sumXp", () => {
  it("task theo loại, bài ôn theo XP đã ghi, tách XP hôm nay", () => {
    const now = new Date(2026, 10, 15, 12, 0).getTime();
    const day = 86_400_000;
    const ev = [
      { id: 1, type: "task_done", ts: now, payload: { taskType: "read" } },
      { id: 2, type: "task_done", ts: now, payload: { taskType: "flashcard" } },
      { id: 3, type: "review_done", ts: now - day, payload: { xp: 40 } },
    ];
    expect(sumXp(ev, now)).toEqual({ total: 58, today: 18 });
  });
});

describe("computeMastery", () => {
  const tasks = [t({ id: 1, type: "read" }), t({ id: 2, type: "flashcard", answer: "x" }), t({ id: 3, type: "recall", answer: "y" })];

  it("còn task chưa làm thì 0 sao", () => {
    const m = computeMastery([mod], [t({ id: 1, status: "todo" }), tasks[1]], []);
    expect(m[0].stars).toBe(0);
  });

  it("xong mọi task: 1 sao", () => {
    expect(computeMastery([mod], tasks, [rv(2, 0), rv(3, 0)])[0].stars).toBe(1);
  });

  it("thẻ ôn đúng ít nhất 1 lần: 2 sao", () => {
    expect(computeMastery([mod], tasks, [rv(2, 1), rv(3, 1)])[0].stars).toBe(2);
  });

  it("thiếu một thẻ (dưới 80%) thì chưa lên sao", () => {
    expect(computeMastery([mod], tasks, [rv(2, 1), rv(3, 0)])[0].stars).toBe(1);
  });

  it("đúng liên tiếp 2 lần: 3 sao", () => {
    expect(computeMastery([mod], tasks, [rv(2, 2), rv(3, 3)])[0].stars).toBe(3);
  });
});

describe("huy hiệu", () => {
  const base: Stats = {
    tasksDone: 0,
    modulesExplored: 0,
    modulesMastered: 0,
    reviewSessions: 0,
    firstTryCards: 0,
    streak: 0,
    level: 1,
    earlyBird: false,
    comeback: false,
  };
  const ids = (s: Stats) => BADGES.filter((b) => b.test(s)).map((b) => b.id);

  it("chưa học thì chưa có huy hiệu", () => {
    expect(ids(base)).toEqual([]);
  });

  it("task đầu tiên và chuỗi 7 ngày", () => {
    expect(ids({ ...base, tasksDone: 1 })).toContain("first_step");
    const s = ids({ ...base, streak: 7 });
    expect(s).toContain("streak3");
    expect(s).toContain("streak7");
  });

  it("id huy hiệu không trùng nhau", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});