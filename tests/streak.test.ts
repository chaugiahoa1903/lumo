import { describe, expect, it } from "vitest";
import { computeStreak } from "../lib/streak";

const now = new Date(2026, 10, 15, 10, 0); // 15/11/2026
const at = (d: number) => new Date(2026, 10, d, 12, 0).getTime();
const days = (...ds: number[]) => ds.map(at);

describe("computeStreak", () => {
  it("chưa có hoạt động", () => {
    expect(computeStreak([], now)).toEqual({ streak: 0, freezes: 0, todayDone: false });
  });

  it("hôm nay chưa học thì chưa bị tính đứt", () => {
    const r = computeStreak(days(12, 13, 14), now);
    expect(r.streak).toBe(3);
    expect(r.todayDone).toBe(false);
  });

  it("hôm nay đã học thì cộng thêm", () => {
    const r = computeStreak(days(12, 13, 14, 15), now);
    expect(r.streak).toBe(4);
    expect(r.todayDone).toBe(true);
  });

  it("bỏ lỡ một ngày khi chưa có ngày nghỉ dự trữ thì về 0 rồi đếm lại", () => {
    expect(computeStreak(days(10, 11, 13, 14), now).streak).toBe(2);
  });

  it("học đủ 7 ngày được 1 ngày nghỉ dự trữ, bỏ lỡ một ngày thì chuỗi giữ nguyên", () => {
    const r = computeStreak(days(1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14), now);
    expect(r.streak).toBe(13);
    expect(r.freezes).toBe(0);
  });

  it("bỏ lỡ hai ngày liền thì dự trữ 1 ngày không đủ", () => {
    expect(computeStreak(days(1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14), now).streak).toBe(5);
  });
});