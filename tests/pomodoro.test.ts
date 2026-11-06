import { describe, expect, it } from "vitest";
import { PRESETS, breakMinutes, cycleMinutes, describeConfig, isLongBreak, roundNumber } from "../lib/pomodoro";

const cfg = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, rounds: 4 };

describe("pomodoro", () => {
  it("nghỉ dài sau hiệp cuối của mỗi vòng", () => {
    expect(isLongBreak(0, 4)).toBe(false);
    expect(isLongBreak(1, 4)).toBe(false);
    expect(isLongBreak(3, 4)).toBe(false);
    expect(isLongBreak(4, 4)).toBe(true);
    expect(isLongBreak(8, 4)).toBe(true);
  });

  it("số phút nghỉ theo hiệp", () => {
    expect(breakMinutes(cfg, 1)).toBe(5);
    expect(breakMinutes(cfg, 4)).toBe(15);
  });

  it("đánh số hiệp trong vòng", () => {
    expect(roundNumber(0, 4)).toBe(1);
    expect(roundNumber(3, 4)).toBe(4);
    expect(roundNumber(4, 4)).toBe(1);
  });

  it("tổng thời gian tập trung của một vòng và mô tả", () => {
    expect(cycleMinutes(cfg)).toBe(100);
    expect(describeConfig(cfg)).toBe("25/5 phút · 4 hiệp");
  });

  it("các mẫu có giá trị hợp lý", () => {
    for (const p of PRESETS) {
      expect(p.cfg.focusMin).toBeGreaterThan(p.cfg.shortBreakMin);
      expect(p.cfg.longBreakMin).toBeGreaterThanOrEqual(p.cfg.shortBreakMin);
      expect(p.cfg.rounds).toBeGreaterThanOrEqual(2);
    }
  });
});