import { describe, expect, it } from "vitest";
import type { Task } from "../lib/db";
import { formatClock, pickSelected, queueFor, stepTask, upcomingOf } from "../lib/focus";

const t = (id: number, moduleId: number, status: string = "todo") =>
  ({ id, moduleId, status, order: id }) as unknown as Task;

const tasks = [t(1, 1, "done"), t(2, 1), t(3, 1), t(4, 2), t(5, 2), t(6, 2, "skipped")];

describe("formatClock", () => {
  it("định dạng mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(125)).toBe("02:05");
    expect(formatClock(25 * 60)).toBe("25:00");
    expect(formatClock(-5)).toBe("00:00");
  });
});

describe("queueFor", () => {
  it("chỉ lấy task chưa làm, lọc theo module", () => {
    expect(queueFor(tasks, null).map((x) => x.id)).toEqual([2, 3, 4, 5]);
    expect(queueFor(tasks, 2).map((x) => x.id)).toEqual([4, 5]);
    expect(queueFor(tasks, 9)).toEqual([]);
  });
});

describe("pickSelected, stepTask, upcomingOf", () => {
  const q = queueFor(tasks, null);

  it("không chọn gì thì lấy task đầu, chọn id lạ thì quay về task đầu", () => {
    expect(pickSelected(q, null)?.id).toBe(2);
    expect(pickSelected(q, 99)?.id).toBe(2);
    expect(pickSelected(q, 4)?.id).toBe(4);
  });

  it("bước tới lui không vượt biên", () => {
    expect(stepTask(q, q[0], -1)).toBeUndefined();
    expect(stepTask(q, q[0], 1)?.id).toBe(3);
    expect(stepTask(q, q[3], 1)).toBeUndefined();
    expect(stepTask(q, undefined, 1)).toBeUndefined();
  });

  it("các task kế tiếp sau task hiện tại", () => {
    expect(upcomingOf(q, q[0], 2).map((x) => x.id)).toEqual([3, 4]);
    expect(upcomingOf(q, q[3], 6)).toEqual([]);
    expect(upcomingOf(q, undefined, 6)).toEqual([]);
  });
});