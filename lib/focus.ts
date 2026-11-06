import type { Task } from "./db";

export const BLOCK_OPTIONS = [10, 15, 20, 25, 30, 45];

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Hàng đợi: các task chưa làm, lọc theo module (null = tất cả).
export function queueFor(tasks: Task[], moduleId: number | null): Task[] {
  return tasks.filter((t) => t.status === "todo" && (moduleId === null || t.moduleId === moduleId));
}

export function pickSelected(queue: Task[], selectedId: number | null): Task | undefined {
  return queue.find((t) => t.id === selectedId) ?? queue[0];
}

export function stepTask(queue: Task[], current: Task | undefined, dir: 1 | -1): Task | undefined {
  if (!current) return undefined;
  const i = queue.findIndex((t) => t.id === current.id);
  return queue[i + dir];
}

export function upcomingOf(queue: Task[], current: Task | undefined, n: number): Task[] {
  if (!current) return [];
  const i = queue.findIndex((t) => t.id === current.id);
  return queue.slice(i + 1, i + 1 + n);
}