import type { AppEvent } from "./db";
import { dayKey } from "./streak";

export const TASK_XP: Record<string, number> = { read: 8, flashcard: 10, recall: 10 };
export const GOAL_CHOICES = [20, 30, 50, 80];
export const TITLES = ["Người mới", "Lữ khách", "Thợ săn chữ", "Người dựng bản đồ", "Kiện tướng caro", "Bậc thầy Lumo"];

// XP của một sự kiện: task xong theo loại task, bài ôn theo XP đã ghi lúc hoàn thành bài.
export function eventXp(e: AppEvent): number {
  const p = e.payload ?? {};
  if (e.type === "task_done") return TASK_XP[String(p.taskType)] ?? 8;
  if (e.type === "review_done") return Number(p.xp) || 0;
  return 0;
}

export function sumXp(events: AppEvent[], now: number = Date.now()): { total: number; today: number } {
  const today = dayKey(now);
  let total = 0;
  let todayXp = 0;
  for (const e of events) {
    const v = eventXp(e);
    total += v;
    if (v > 0 && dayKey(e.ts) === today) todayXp += v;
  }
  return { total, today: todayXp };
}

export interface LevelInfo {
  level: number;
  title: string;
  into: number; // XP đã có trong cấp hiện tại
  span: number; // XP cần cho cả cấp hiện tại
  toNext: number; // XP còn thiếu để lên cấp
}

// Cấp L bắt đầu ở 50·L·(L-1) XP: cấp 2 ở 100, cấp 3 ở 300, cấp 4 ở 600...
export function levelInfo(xp: number): LevelInfo {
  const x = Math.max(0, xp);
  let level = 1;
  while (50 * (level + 1) * level <= x) level++;
  const floor = 50 * level * (level - 1);
  const ceil = 50 * (level + 1) * level;
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    into: x - floor,
    span: ceil - floor,
    toNext: ceil - x,
  };
}

export async function loadXp(): Promise<{ total: number; today: number }> {
  const { db } = await import("./db");
  const ev = await db.events.where("type").anyOf(["task_done", "review_done"]).toArray();
  return sumXp(ev);
}

export async function totalXp(): Promise<number> {
  return (await loadXp()).total;
}