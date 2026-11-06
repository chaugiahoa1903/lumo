export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export type Grade = "again" | "good";

export const DAY_MS = 86_400_000;

export function initialSrs(): SrsState {
  return { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
}

// SM-2 rút gọn: "good" = chất lượng 4, "again" = chất lượng 2.
export function nextSrs(s: SrsState, grade: Grade, now: number): SrsState & { dueAt: number } {
  const q = grade === "good" ? 4 : 2;
  let { ease, reps, lapses, intervalDays } = s;
  if (q < 3) {
    reps = 0;
    lapses += 1;
    intervalDays = 1;
  } else {
    reps += 1;
    intervalDays = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(intervalDays * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  ease = Math.round(ease * 100) / 100;
  return { ease, intervalDays, reps, lapses, dueAt: now + intervalDays * DAY_MS };
}