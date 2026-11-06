import { describe, expect, it } from "vitest";
import { STEP_DEG, arcPoint, arcRotation, wheelRadius } from "../lib/wheelGeometry";

describe("wheelGeometry", () => {
  it("mọi mục nằm trên cùng một vòng tròn", () => {
    for (const side of ["left", "right"] as const) {
      for (let off = -3; off <= 3; off++) {
        const p = arcPoint(off, side, 300);
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(300, 5);
      }
    }
  });

  it("mục được chọn nằm trên trục ngang và hai bên đối xứng", () => {
    expect(arcPoint(0, "left", 300)).toEqual({ x: -300, y: 0 });
    expect(arcPoint(0, "right", 300)).toEqual({ x: 300, y: 0 });
    const a = arcPoint(2, "left", 300);
    const b = arcPoint(2, "right", 300);
    expect(a.x).toBeCloseTo(-b.x);
    expect(a.y).toBeCloseTo(b.y);
  });

  it("mục phía trước nằm cao hơn trục, mục phía sau nằm thấp hơn", () => {
    expect(arcPoint(-1, "left", 300).y).toBeLessThan(0);
    expect(arcPoint(1, "right", 300).y).toBeGreaterThan(0);
  });

  it("chữ nghiêng đối xứng giữa hai bên", () => {
    expect(arcRotation(-1, "left")).toBe(STEP_DEG);
    expect(arcRotation(-1, "right")).toBe(-STEP_DEG);
    expect(arcRotation(0, "left")).toBeCloseTo(0);
  });

  it("bán kính theo kích thước cửa sổ, có chặn dưới", () => {
    expect(wheelRadius(1920, 1080)).toBe(410);
    expect(wheelRadius(800, 500)).toBe(230);
  });
});