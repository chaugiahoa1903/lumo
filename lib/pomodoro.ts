export interface PomoConfig {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  rounds: number; // số hiệp mỗi vòng, sau hiệp cuối là nghỉ dài
}

export const PRESETS: { label: string; cfg: PomoConfig }[] = [
  { label: "Cổ điển 25/5", cfg: { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, rounds: 4 } },
  { label: "Sâu 50/10", cfg: { focusMin: 50, shortBreakMin: 10, longBreakMin: 30, rounds: 3 } },
  { label: "Nhẹ nhàng 15/3", cfg: { focusMin: 15, shortBreakMin: 3, longBreakMin: 10, rounds: 4 } },
];

// roundsDone: số hiệp đã hoàn thành, tính cả hiệp vừa kết thúc.
export function isLongBreak(roundsDone: number, rounds: number): boolean {
  return roundsDone > 0 && rounds > 0 && roundsDone % rounds === 0;
}

export function breakMinutes(cfg: PomoConfig, roundsDone: number): number {
  return isLongBreak(roundsDone, cfg.rounds) ? cfg.longBreakMin : cfg.shortBreakMin;
}

// Hiệp hiện tại (tính từ 1) trong vòng.
export function roundNumber(roundsDone: number, rounds: number): number {
  return (roundsDone % Math.max(1, rounds)) + 1;
}

export function cycleMinutes(cfg: PomoConfig): number {
  return cfg.focusMin * cfg.rounds;
}

export function describeConfig(cfg: PomoConfig): string {
  return `${cfg.focusMin}/${cfg.shortBreakMin} phút · ${cfg.rounds} hiệp`;
}