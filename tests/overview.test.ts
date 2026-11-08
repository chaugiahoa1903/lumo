import { describe, it, expect } from "vitest";
import { statsByDay, lastDays, weekSummary, monthGrid, pickToday, dayKey } from "../lib/overview";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

describe("overview", () => {
  it("gom task xong theo ngày, bỏ qua task chưa xong", () => {
    const map = statsByDay([
      { status: "done", completedAt: at(2026, 10, 8), actualSeconds: 120 },
      { status: "done", completedAt: at(2026, 10, 8, 20), actualSeconds: 60 },
      { status: "todo" },
      { status: "skipped", completedAt: at(2026, 10, 8) },
    ]);
    expect(map.size).toBe(1);
    expect(map.get(dayKey(at(2026, 10, 8)))).toMatchObject({ count: 2, seconds: 180 });
  });
  it("lastDays trả đủ 7 ngày, cũ đến mới, ngày trống bằng 0", () => {
    const now = at(2026, 10, 8);
    const days = lastDays(statsByDay([{ status: "done", completedAt: at(2026, 10, 6), actualSeconds: 60 }]), now, 7);
    expect(days).toHaveLength(7);
    expect(days[6].key).toBe(dayKey(now));
    expect(days[4].count).toBe(1);
    expect(days[0].count).toBe(0);
  });
  it("weekSummary: tổng task, phút, ngày có học", () => {
    const now = at(2026, 10, 8);
    const w = weekSummary(
      statsByDay([
        { status: "done", completedAt: at(2026, 10, 8), actualSeconds: 90 },
        { status: "done", completedAt: at(2026, 10, 7), actualSeconds: 90 },
        { status: "done", completedAt: at(2026, 9, 1), actualSeconds: 600 },
      ]),
      now
    );
    expect(w.totalTasks).toBe(2);
    expect(w.totalMinutes).toBe(3);
    expect(w.activeDays).toBe(2);
  });
  it("monthGrid: bội số của 7, bắt đầu từ thứ Hai", () => {
    const g = monthGrid(2026, 10);
    expect(g.length % 7).toBe(0);
    expect(new Date(g[0].ts).getDay()).toBe(1);
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it("pickToday: đủ phút thì dừng, luôn lấy ít nhất 1", () => {
    const todo = [{ estMinutes: 20 }, { estMinutes: 20 }, { estMinutes: 20 }, { estMinutes: 20 }];
    expect(pickToday(todo, 40)).toHaveLength(2);
    expect(pickToday(todo, 1)).toHaveLength(1);
    expect(pickToday([], 60)).toHaveLength(0);
  });
});