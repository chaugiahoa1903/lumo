export function dayKey(ts: number | Date): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface StreakInfo {
  streak: number; // số ngày có học liên tiếp
  freezes: number; // số ngày nghỉ dự trữ đang có (tối đa 2)
  todayDone: boolean;
}

export const MAX_FREEZES = 2;
export const DAYS_PER_FREEZE = 7;

// Duyệt từ ngày học đầu tiên đến hôm qua: học đủ 7 ngày được thêm 1 ngày nghỉ dự trữ;
// bỏ lỡ một ngày thì tự dùng một ngày nghỉ, hết dự trữ mới về 0. Hôm nay chưa học thì chưa bị tính.
export function computeStreak(timestamps: number[], now: Date = new Date()): StreakInfo {
  if (timestamps.length === 0) return { streak: 0, freezes: 0, todayDone: false };
  const keys = new Set(timestamps.map((t) => dayKey(t)));
  const today = startOfDay(now);
  const first = startOfDay(new Date(timestamps.reduce((a, b) => Math.min(a, b))));

  let streak = 0;
  let freezes = 0;
  const earn = () => {
    if (streak > 0 && streak % DAYS_PER_FREEZE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  };

  for (const d = new Date(first); d < today; d.setDate(d.getDate() + 1)) {
    if (keys.has(dayKey(d))) {
      streak += 1;
      earn();
    } else if (freezes > 0) {
      freezes -= 1;
    } else {
      streak = 0;
    }
  }

  const todayDone = keys.has(dayKey(today));
  if (todayDone) {
    streak += 1;
    earn();
  }
  return { streak, freezes, todayDone };
}