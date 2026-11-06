import { db, type Session } from "./db";

export const IDLE_MS = 30 * 60 * 1000; // quá 30 phút không làm gì thì phiên coi như đã kết thúc
export const MIN_TASK_SECONDS = 10;
export const MAX_TASK_SECONDS = 15 * 60;

export type Outcome = "again" | "good";

export function isSessionActive(s: Session | undefined, now: number): s is Session {
  if (!s || s.endedAt !== undefined) return false;
  return now - (s.lastActiveAt ?? s.startedAt) < IDLE_MS;
}

export interface CompleteResult {
  sessionId: number;
  sessionTasks: number;
  sessionSeconds: number;
}

export async function logStart(taskId: number) {
  const t = await db.tasks.get(taskId);
  if (!t) return;
  await db.events.add({ type: "task_start", ts: Date.now(), payload: { taskId, courseId: t.courseId } });
}

export async function completeTask(
  taskId: number,
  rawSeconds: number,
  outcome?: Outcome
): Promise<CompleteResult | null> {
  const seconds = Math.min(MAX_TASK_SECONDS, Math.max(MIN_TASK_SECONDS, Math.round(rawSeconds)));
  return db.transaction("rw", [db.tasks, db.sessions, db.events], async () => {
    const task = await db.tasks.get(taskId);
    if (!task || task.status === "done") return null;
    const ts = Date.now();

    const last = await db.sessions.orderBy("startedAt").last();
    let session: Session;
    if (isSessionActive(last, ts)) {
      session = last;
    } else {
      const id = await db.sessions.add({ startedAt: ts, lastActiveAt: ts, taskCount: 0, activeSeconds: 0 });
      session = (await db.sessions.get(id)) as Session;
    }

    const taskCount = (session.taskCount ?? 0) + 1;
    const activeSeconds = (session.activeSeconds ?? 0) + seconds;
    await db.sessions.update(session.id, { lastActiveAt: ts, taskCount, activeSeconds });
    await db.tasks.update(taskId, { status: "done", completedAt: ts, actualSeconds: seconds, outcome });
    await db.events.add({
      type: "task_done",
      ts,
      payload: {
        taskId,
        courseId: task.courseId,
        moduleId: task.moduleId,
        taskType: task.type,
        seconds,
        estMinutes: task.estMinutes,
        outcome: outcome ?? null,
        sessionId: session.id,
      },
    });
    return { sessionId: session.id, sessionTasks: taskCount, sessionSeconds: activeSeconds };
  });
}

export async function skipTask(taskId: number) {
  await db.transaction("rw", [db.tasks, db.events], async () => {
    const t = await db.tasks.get(taskId);
    if (!t || t.status !== "todo") return;
    await db.tasks.update(taskId, { status: "skipped" });
    await db.events.add({ type: "task_skipped", ts: Date.now(), payload: { taskId, courseId: t.courseId } });
  });
}

export async function endSession(sessionId: number) {
  await db.transaction("rw", [db.sessions, db.events], async () => {
    const s = await db.sessions.get(sessionId);
    if (!s || s.endedAt !== undefined) return;
    const ts = Date.now();
    await db.sessions.update(sessionId, { endedAt: ts });
    await db.events.add({
      type: "session_end",
      ts,
      payload: { sessionId, taskCount: s.taskCount ?? 0, activeSeconds: s.activeSeconds ?? 0 },
    });
  });
}

// Đặt lại tiến độ học: giữ tài liệu, khóa học, module, task; xóa kết quả làm, phiên và sự kiện.
export async function resetProgress() {
  await db.transaction("rw", [db.tasks, db.sessions, db.events], async () => {
    await db.tasks.toCollection().modify((t) => {
      t.status = "todo";
      delete t.completedAt;
      delete t.actualSeconds;
      delete t.outcome;
    });
    await db.sessions.clear();
    await db.events.clear();
  });
}