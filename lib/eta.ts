import { db } from "./db";

export const MIN_TASKS_FOR_ETA = 3;

export interface Pace {
  tasks: number; // số task đã làm dùng để tính
  days: number; // số ngày có học
  ratio: number; // thời gian làm thật / thời gian ước lượng (giới hạn 0,3 đến 3)
  minutesPerDay: number; // số phút học thật trung bình mỗi ngày có học
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export async function loadPace(): Promise<{ pace: Pace | null; count: number }> {
  const events = await db.events.where("type").equals("task_done").toArray();
  let n = 0;
  let sec = 0;
  let est = 0;
  const days = new Set<string>();
  for (const e of events) {
    const p = e.payload ?? {};
    const s = Number(p.seconds);
    const m = Number(p.estMinutes);
    if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) continue;
    n++;
    sec += s;
    est += m * 60;
    days.add(dayKey(e.ts));
  }
  if (n < MIN_TASKS_FOR_ETA || est <= 0 || days.size === 0) return { pace: null, count: n };
  const ratio = Math.min(3, Math.max(0.3, sec / est));
  return { pace: { tasks: n, days: days.size, ratio, minutesPerDay: Math.max(1, sec / 60 / days.size) }, count: n };
}

// Số ngày học cần để xong phần còn lại (phút ước lượng).
export function etaDays(remainingEstMinutes: number, pace: Pace): number {
  if (remainingEstMinutes <= 0) return 0;
  return Math.max(1, Math.ceil((remainingEstMinutes * pace.ratio) / pace.minutesPerDay));
}

// Ngày dự kiến: ngày học đầu tiên là hôm nay.
export function etaDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, days - 1));
  return d;
}

export function formatEtaDate(d: Date): string {
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}