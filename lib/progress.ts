import type { Task } from "./db";

// Tiến độ tính theo MODULE (không phải cả khóa học) và nhịp chúc mừng thưa hơn.
export const CHECKPOINT_MIN = 6;
export const CHECKPOINT_MAX = 8;
export const CHECKPOINT_DEFAULT = 7;

export interface ModuleProgress {
  moduleId: number;
  done: number;
  total: number; // done + todo; task đã bỏ qua không tính
  pct: number; // 0..100, làm tròn
  left: number; // số task còn lại trong module
  toMilestone: number | null; // số task (gồm cả chính mốc) tới mốc kế tiếp của module; null nếu không còn mốc
}

export function moduleProgress(tasks: Task[], moduleId: number): ModuleProgress {
  const mine = tasks.filter((t) => t.moduleId === moduleId).sort((a, b) => a.order - b.order);
  const done = mine.filter((t) => t.status === "done").length;
  const todo = mine.filter((t) => t.status === "todo");
  const total = done + todo.length;
  const idx = todo.findIndex((t) => t.isMilestone);
  return {
    moduleId,
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    left: todo.length,
    toMilestone: idx >= 0 ? idx + 1 : null,
  };
}

export function clampEvery(n: number): number {
  const v = Math.round(n);
  if (!Number.isFinite(v)) return CHECKPOINT_DEFAULT;
  return Math.min(CHECKPOINT_MAX, Math.max(CHECKPOINT_MIN, v));
}

export interface CheckpointInput {
  sessionTasks: number; // số task đã xong trong phiên, tính cả task vừa xong
  every: number; // cứ N task thì có một checkpoint
  moduleCompleted: boolean; // task vừa xong là task cuối của module
  milestoneHit: boolean; // task vừa xong là mốc của module
}

// Chỉ chúc mừng và hiện bảng "Xong!" ở checkpoint, để không ngắt nhịp học.
export function isCheckpoint(i: CheckpointInput): boolean {
  if (i.moduleCompleted || i.milestoneHit) return true;
  return i.sessionTasks > 0 && i.sessionTasks % clampEvery(i.every) === 0;
}