import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "../lib/db";
import { clampEvery, isCheckpoint, moduleProgress } from "../lib/progress";

function mk(id: number, moduleId: number, order: number, status: TaskStatus = "todo", isMilestone = false): Task {
  return { id, courseId: 1, moduleId, order, type: "read", title: `t${id}`, estMinutes: 3, status, isMilestone };
}

describe("moduleProgress", () => {
  const tasks = [
    mk(1, 1, 1, "done"), mk(2, 1, 2, "done"), mk(3, 1, 3), mk(4, 1, 4), mk(5, 1, 5, "todo", true),
    mk(6, 2, 6), mk(7, 2, 7, "todo", true),
  ];
  it("tính theo module, không theo cả khóa học", () => {
    const p = moduleProgress(tasks, 1);
    expect(p).toMatchObject({ done: 2, total: 5, pct: 40, left: 3, toMilestone: 3 });
    expect(moduleProgress(tasks, 2)).toMatchObject({ done: 0, total: 2, pct: 0, toMilestone: 2 });
  });
  it("task bỏ qua không tính vào mẫu số", () => {
    const p = moduleProgress([mk(1, 1, 1, "done"), mk(2, 1, 2, "skipped"), mk(3, 1, 3)], 1);
    expect(p).toMatchObject({ done: 1, total: 2, pct: 50 });
  });
  it("hết mốc thì toMilestone là null; module rỗng không chia cho 0", () => {
    expect(moduleProgress([mk(1, 1, 1), mk(2, 1, 2)], 1).toMilestone).toBeNull();
    expect(moduleProgress([], 9)).toMatchObject({ total: 0, pct: 0 });
  });
});

describe("isCheckpoint", () => {
  const base = { every: 7, moduleCompleted: false, milestoneHit: false };
  it("im lặng giữa các checkpoint, chúc mừng mỗi N task", () => {
    expect([1, 2, 3, 4, 5, 6].some((n) => isCheckpoint({ ...base, sessionTasks: n }))).toBe(false);
    expect(isCheckpoint({ ...base, sessionTasks: 7 })).toBe(true);
    expect(isCheckpoint({ ...base, sessionTasks: 8 })).toBe(false);
    expect(isCheckpoint({ ...base, sessionTasks: 14 })).toBe(true);
  });
  it("xong module hoặc chạm mốc thì luôn là checkpoint", () => {
    expect(isCheckpoint({ ...base, sessionTasks: 2, moduleCompleted: true })).toBe(true);
    expect(isCheckpoint({ ...base, sessionTasks: 3, milestoneHit: true })).toBe(true);
  });
  it("giới hạn N trong 6..8", () => {
    expect(clampEvery(3)).toBe(6);
    expect(clampEvery(20)).toBe(8);
    expect(clampEvery(Number.NaN)).toBe(7);
    expect(isCheckpoint({ ...base, every: 3, sessionTasks: 6 })).toBe(true);
  });
});