import { describe, expect, it } from "vitest";
import type { Task, TaskType } from "../lib/db";
import { rankTasks, WEIGHTS, type NextUpContext } from "../lib/nextup";

function mk(id: number, moduleId: number, order: number, type: TaskType = "read", est = 3, isMilestone = false): Task {
  return { id, courseId: 1, moduleId, order, type, title: `t${id}`, estMinutes: est, status: "todo", isMilestone };
}
const ctx = (over: Partial<NextUpContext> = {}): NextUpContext => ({
  remainingMinutes: 20,
  recentTypes: [],
  dueByModule: {},
  ...over,
});

describe("rankTasks (Next Up)", () => {
  it("không có task todo thì trả mảng rỗng", () => {
    expect(rankTasks([], ctx())).toEqual([]);
    expect(rankTasks([{ ...mk(1, 1, 1), status: "done" }], ctx())).toEqual([]);
  });

  it("giữ thứ tự trong cùng module khi mọi thứ khác bằng nhau", () => {
    const r = rankTasks([mk(1, 1, 1), mk(2, 1, 2), mk(3, 1, 3, "read", 3, true)], ctx());
    expect(r[0].task.id).toBe(1);
    expect(r[0].parts.proximity).toBe(r[1].parts.proximity);
  });

  it("module gần mốc hơn được ưu tiên", () => {
    const tasks = [
      mk(1, 1, 1, "read", 3, true),
      mk(2, 2, 2), mk(3, 2, 3), mk(4, 2, 4), mk(5, 2, 5, "read", 3, true),
    ];
    const r = rankTasks(tasks, ctx());
    expect(r[0].task.id).toBe(1);
    expect(r[0].reasons[0]).toContain("mốc");
  });

  it("module có nhiều thẻ ôn đến hạn được ưu tiên khi các thứ khác bằng nhau", () => {
    const tasks = [
      mk(1, 1, 1), mk(2, 1, 2), mk(3, 1, 3), mk(4, 1, 4, "read", 3, true),
      mk(5, 2, 5), mk(6, 2, 6), mk(7, 2, 7), mk(8, 2, 8, "read", 3, true),
    ];
    const r = rankTasks(tasks, ctx({ dueByModule: { 2: 4 } }));
    expect(r[0].task.moduleId).toBe(2);
  });

  it("hết giờ thì module có task vừa thời lượng còn lại thắng module toàn task quá dài", () => {
    const tasks = [
      mk(1, 1, 1, "read", 5), mk(2, 1, 2, "read", 5), mk(3, 1, 3), mk(4, 1, 4, "read", 3, true),
      mk(5, 2, 5, "read", 3), mk(6, 2, 6, "read", 3), mk(7, 2, 7), mk(8, 2, 8, "read", 3, true),
    ];
    const r = rankTasks(tasks, ctx({ remainingMinutes: 3 }));
    expect(r[0].task.id).toBe(5);
  });

  it("ưu tiên loại task khác với 2 task vừa làm", () => {
    const tasks = [
      mk(1, 1, 1, "read"), mk(2, 1, 2, "read"), mk(3, 1, 3, "read"), mk(4, 1, 4, "read", 3, true),
      mk(5, 2, 5, "flashcard"), mk(6, 2, 6, "read"), mk(7, 2, 7, "read"), mk(8, 2, 8, "read", 3, true),
    ];
    const r = rankTasks(tasks, ctx({ recentTypes: ["read", "read"] }));
    expect(r[0].task.id).toBe(5);
  });

  it("score bằng tổng có trọng số của các thành phần và lý do không quá 2 dòng", () => {
    const r = rankTasks([mk(1, 1, 1, "read", 3, true)], ctx({ dueByModule: { 1: 2 } }));
    const p = r[0].parts;
    const expected =
      WEIGHTS.proximity * p.proximity + WEIGHTS.forgetting * p.forgetting + WEIGHTS.fit * p.fit + WEIGHTS.variety * p.variety;
    expect(r[0].score).toBeCloseTo(expected, 10);
    expect(r[0].reasons.length).toBeGreaterThan(0);
    expect(r[0].reasons.length).toBeLessThanOrEqual(2);
  });
});