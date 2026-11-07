import { describe, it, expect } from "vitest";
import { planStudy } from "../lib/studyPlan";

describe("planStudy", () => {
  it("dưới 25 phút: một hiệp đúng bằng tổng", () => {
    const p = planStudy(20);
    expect(p.blocks).toEqual([20]);
    expect(p.cfg.focusMin).toBe(20);
  });
  it("25 phút: một hiệp, không nghỉ", () => {
    const p = planStudy(25);
    expect(p.blocks).toEqual([25]);
    expect(p.breaks).toEqual([]);
  });
  it("60 phút: 2 hiệp 25, nghỉ 5, dư 5", () => {
    const p = planStudy(60);
    expect(p.blocks).toEqual([25, 25]);
    expect(p.breaks).toEqual([5]);
    expect(p.leftoverMin).toBe(5);
  });
  it("120 phút: 4 hiệp, nghỉ ngắn", () => {
    const p = planStudy(120);
    expect(p.blocks.length).toBe(4);
    expect(p.breaks).toEqual([5, 5, 5]);
  });
  it("nghỉ dài xuất hiện sau hiệp thứ 4", () => {
    expect(planStudy(240).breaks[3]).toBe(15);
  });
  it("mọi tổng từ 10 đến 240: không vượt tổng, dư dưới 40", () => {
    for (let m = 10; m <= 240; m += 5) {
      const p = planStudy(m);
      const used = p.blocks.reduce((a, b) => a + b, 0) + p.breaks.reduce((a, b) => a + b, 0);
      expect(used).toBeLessThanOrEqual(m);
      expect(p.leftoverMin).toBe(m - used);
      expect(p.leftoverMin).toBeLessThan(40);
    }
  });
});