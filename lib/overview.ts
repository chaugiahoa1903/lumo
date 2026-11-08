// Tính thống kê cho trang Tổng quan (hàm thuần, dễ kiểm thử). Chỉ dùng completedAt và actualSeconds của task đã xong.
const pad = (n: number) => String(n).padStart(2, "0");

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface DoneTask {
  status: string;
  completedAt?: number;
  actualSeconds?: number;
}

export interface DayStat {
  key: string;
  ts: number;
  count: number;
  seconds: number;
}

export function statsByDay(tasks: DoneTask[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const t of tasks) {
    if (t.status !== "done" || typeof t.completedAt !== "number") continue;
    const key = dayKey(t.completedAt);
    const cur = map.get(key) ?? { key, ts: startOfDay(t.completedAt), count: 0, seconds: 0 };
    cur.count += 1;
    cur.seconds += t.actualSeconds ?? 0;
    map.set(key, cur);
  }
  return map;
}

// n ngày gần nhất (cũ đến mới), tính cả hôm nay.
export function lastDays(map: Map<string, DayStat>, now: number, n = 7): DayStat[] {
  const out: DayStat[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ts = startOfDay(d.getTime());
    const key = dayKey(ts);
    out.push(map.get(key) ?? { key, ts, count: 0, seconds: 0 });
  }
  return out;
}

export interface WeekSummary {
  days: DayStat[];
  totalTasks: number;
  totalMinutes: number;
  activeDays: number;
}

export function weekSummary(map: Map<string, DayStat>, now: number, n = 7): WeekSummary {
  const days = lastDays(map, now, n);
  return {
    days,
    totalTasks: days.reduce((s, d) => s + d.count, 0),
    totalMinutes: Math.round(days.reduce((s, d) => s + d.seconds, 0) / 60),
    activeDays: days.filter((d) => d.count > 0).length,
  };
}

export interface GridCell {
  ts: number;
  key: string;
  inMonth: boolean;
}

// Lưới tháng, tuần bắt đầu từ thứ Hai. month tính từ 0.
export function monthGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const total = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  const cells: GridCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({ ts: d.getTime(), key: dayKey(d.getTime()), inMonth: d.getMonth() === month });
  }
  return cells;
}

// Lấy task từ đầu hàng đợi cho tới khi đủ số phút; luôn lấy ít nhất 1 nếu còn task, tối đa 12.
export function pickToday<T extends { estMinutes: number }>(todo: T[], budgetMin: number, cap = 12): T[] {
  const out: T[] = [];
  let sum = 0;
  for (const t of todo) {
    if (out.length >= cap) break;
    if (out.length > 0 && sum >= budgetMin) break;
    out.push(t);
    sum += t.estMinutes;
  }
  return out;
}