// Hình học của bánh xe uốn theo vòng tròn đồng hồ (hàm thuần, dễ kiểm thử).

export const STEP_DEG = 13; // góc giữa hai mục liền nhau trên vòng

export type Side = "left" | "right";

// Vị trí (so với tâm đồng hồ) của mục cách mục được chọn `off` bước. Mọi mục nằm trên vòng bán kính `radius`.
export function arcPoint(off: number, side: Side, radius: number, stepDeg = STEP_DEG) {
  const th = (off * stepDeg * Math.PI) / 180;
  return { x: (side === "left" ? -1 : 1) * radius * Math.cos(th), y: radius * Math.sin(th) };
}

// Chữ nằm dọc theo đường bán kính nên nghiêng dần khi xa trục ngang.
export function arcRotation(off: number, side: Side, stepDeg = STEP_DEG) {
  return (side === "left" ? -1 : 1) * off * stepDeg;
}

export function wheelRadius(w: number, h: number) {
  return Math.round(Math.max(230, Math.min(h * 0.38, w * 0.28)));
}