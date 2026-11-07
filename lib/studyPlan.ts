import type { PomoConfig } from "./pomodoro";

// Đề xuất chia hiệp từ tổng thời gian học. Quy ước Pomodoro (25/5/15), không phải số đo từ dữ liệu người dùng.
export interface StudyPlan {
  totalMin: number;
  cfg: PomoConfig;
  blocks: number[]; // độ dài từng hiệp (phút)
  breaks: number[]; // độ dài từng lần nghỉ giữa các hiệp (phút)
  leftoverMin: number; // phút không xếp vừa một hiệp nữa
}

const FOCUS = 25;
const SHORT = 5;
const LONG = 15;
const PER_CYCLE = 4;
export const MIN_TOTAL = 10;
export const MAX_TOTAL = 535;

export function clampTotal(m: number): number {
  const r = Number.isFinite(m) ? Math.round(m / 5) * 5 : 60;
  return Math.min(MAX_TOTAL, Math.max(MIN_TOTAL, r));
}

export function planStudy(totalMin: number): StudyPlan {
  const total = clampTotal(totalMin);
  if (total < FOCUS) {
    return {
      totalMin: total,
      cfg: { focusMin: total, shortBreakMin: SHORT, longBreakMin: LONG, rounds: PER_CYCLE },
      blocks: [total],
      breaks: [],
      leftoverMin: 0,
    };
  }
  const blocks: number[] = [];
  const breaks: number[] = [];
  let used = 0;
  for (;;) {
    blocks.push(FOCUS);
    used += FOCUS;
    const brk = blocks.length % PER_CYCLE === 0 ? LONG : SHORT;
    if (used + brk + FOCUS > total) break;
    breaks.push(brk);
    used += brk;
  }
  return {
    totalMin: total,
    cfg: { focusMin: FOCUS, shortBreakMin: SHORT, longBreakMin: LONG, rounds: PER_CYCLE },
    blocks,
    breaks,
    leftoverMin: total - used,
  };
}

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm} phút`;
  return mm === 0 ? `${h} giờ` : `${h} giờ ${mm} phút`;
}

export function sameConfig(a: PomoConfig, b: PomoConfig): boolean {
  return (
    a.focusMin === b.focusMin &&
    a.shortBreakMin === b.shortBreakMin &&
    a.longBreakMin === b.longBreakMin &&
    a.rounds === b.rounds
  );
}

export function describePlan(p: StudyPlan): string {
  const n = p.blocks.length;
  let s = `${formatMinutes(p.totalMin)}: ${n} hiệp × ${p.cfg.focusMin} phút`;
  if (n > 1) s += ` · nghỉ ${p.cfg.shortBreakMin} phút`;
  if (n > p.cfg.rounds) s += ` · nghỉ dài ${p.cfg.longBreakMin} phút sau hiệp ${p.cfg.rounds}`;
  if (p.leftoverMin > 0) s += ` · dư ${p.leftoverMin} phút`;
  return s;
}