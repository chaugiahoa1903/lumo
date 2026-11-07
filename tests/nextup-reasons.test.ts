// tests/nextup-reasons.test.ts
// Lý do hiển thị trong "Vì sao Luna chọn" phải đúng sự thật: điểm cao chưa đủ để nêu một câu lý do.
import { describe, it, expect } from "vitest";
import { rankTasks } from "../lib/nextup";
import type { Task, TaskType } from "../lib/db";

const mk = (o: Record<string, unknown>) =>
  ({ status: "todo", order: 0, moduleId: 1, type: "read", estMinutes: 3, isMilestone: false, ...o }) as unknown as Task;
const types = (...a: string[]) => a as TaskType[];

describe("lý do của Next Up phải đúng sự thật", () => {
  it("đầu phiên (chưa làm task nào) không được nói 'khác dạng với task vừa làm'", () => {
    const r = rankTasks([mk({})], { remainingMinutes: 20, recentTypes: [], dueByModule: {} });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect(x.reasons.join(" ")).not.toContain("Khác dạng");
  });

  it("có task vừa làm cùng loại khác thì được nêu 'khác dạng'", () => {
    const r = rankTasks([mk({ type: "read" })], {
      remainingMinutes: 20,
      recentTypes: types("flashcard", "flashcard"),
      dueByModule: {},
    });
    expect(r[0].reasons.join(" ")).toContain("Khác dạng");
  });

  it("task dài hơn thời gian còn lại không được nói 'vừa với' (hồi quy: 5 phút so với 4 phút còn lại)", () => {
    // 10 task cùng module để độ gần mốc nhỏ; vừa làm 2 task cùng loại để điểm đa dạng bằng 0;
    // khi đó chỉ còn thành phần fit (đúng 0.08) vượt ngưỡng nêu lý do.
    const tasks = Array.from({ length: 10 }, (_, i) => mk({ order: i, estMinutes: 5 }));
    const r = rankTasks(tasks, {
      remainingMinutes: 4,
      recentTypes: types("read", "read"),
      dueByModule: {},
    });
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect(x.reasons.join(" ")).not.toContain("Vừa với");
  });

  it("task vừa thời gian còn lại thì được nêu 'vừa với'", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => mk({ order: i, estMinutes: 4 }));
    const r = rankTasks(tasks, {
      remainingMinutes: 4,
      recentTypes: types("read", "read"),
      dueByModule: {},
    });
    expect(r[0].reasons.join(" ")).toContain("Vừa với");
  });
});
