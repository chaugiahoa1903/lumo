import { db, type Review, type Task } from "./db";
import { DAY_MS, initialSrs, nextSrs, type Grade } from "./sm2";
import type { Card } from "./quiz";

export function isReviewable(t: Task): boolean {
  return t.status === "done" && (t.type === "flashcard" || t.type === "recall") && !!t.answer?.trim();
}

function seed(t: Task): Review {
  const ts = t.completedAt ?? Date.now();
  return {
    taskId: t.id,
    courseId: t.courseId,
    ...initialSrs(),
    dueAt: t.outcome === "good" ? ts + DAY_MS : ts,
  };
}

// Tạo thẻ cho task đã xong mà chưa có thẻ (dữ liệu làm trước M3b), dọn thẻ mồ côi.
export async function syncReviews(): Promise<void> {
  await db.transaction("rw", [db.tasks, db.reviews], async () => {
    const done = await db.tasks.where("status").equals("done").toArray();
    const have = new Set((await db.reviews.toCollection().primaryKeys()) as number[]);
    for (const t of done) {
      if (isReviewable(t) && !have.has(t.id)) await db.reviews.add(seed(t));
    }
    const all = await db.reviews.toArray();
    const tasks = await db.tasks.bulkGet(all.map((r) => r.taskId));
    const drop: number[] = [];
    all.forEach((r, i) => {
      const t = tasks[i];
      if (!t || !isReviewable(t)) drop.push(r.taskId);
    });
    if (drop.length) await db.reviews.bulkDelete(drop);
  });
}

export interface DeckItem {
  review: Review;
  task: Task;
  context: string; // đoạn tài liệu của thẻ (task đọc gần nhất phía trước)
}

function contextFor(t: Task, list: Task[]): string {
  let ctx = "";
  for (const x of list) {
    if (x.order >= t.order) break;
    if (x.type === "read" && x.body) ctx = x.body;
  }
  return ctx || t.answer || "";
}

export function toCard(item: DeckItem): Card {
  const t = item.task;
  return {
    taskId: t.id,
    title: t.title.replace(/^(Flashcard|Nhớ lại):\s*/, ""),
    keywords: t.keywords ?? [],
    answer: t.answer ?? "",
    context: item.context,
  };
}

export async function loadDeck(): Promise<DeckItem[]> {
  const reviews = await db.reviews.toArray();
  if (reviews.length === 0) return [];
  const tasks = await db.tasks.bulkGet(reviews.map((r) => r.taskId));
  const courseIds = [...new Set(reviews.map((r) => r.courseId))];
  const all = await db.tasks.where("courseId").anyOf(courseIds).toArray();
  const byCourse = new Map<number, Task[]>();
  for (const t of all) {
    const a = byCourse.get(t.courseId) ?? [];
    a.push(t);
    byCourse.set(t.courseId, a);
  }
  for (const a of byCourse.values()) a.sort((x, y) => x.order - y.order);

  const out: DeckItem[] = [];
  reviews.forEach((r, i) => {
    const t = tasks[i];
    if (t && isReviewable(t)) out.push({ review: r, task: t, context: contextFor(t, byCourse.get(t.courseId) ?? []) });
  });
  return out;
}

export async function recordCard(taskId: number, grade: Grade, practice: boolean): Promise<void> {
  await db.transaction("rw", [db.reviews, db.events], async () => {
    const ts = Date.now();
    const r = await db.reviews.get(taskId);
    if (!practice && r) {
      const n = nextSrs(r, grade, ts);
      await db.reviews.update(taskId, { ...n, lastReviewedAt: ts });
    }
    await db.events.add({ type: "review_card", ts, payload: { taskId, grade, practice } });
  });
}

export async function recordSessionDone(p: {
  xp: number;
  firstTry: number;
  total: number;
  practice: boolean;
}): Promise<void> {
  await db.events.add({ type: "review_done", ts: Date.now(), payload: { ...p } });
}

export async function activityTimestamps(): Promise<number[]> {
  const ev = await db.events.where("type").anyOf(["task_done", "review_done"]).toArray();
  return ev.map((e) => e.ts);
}

export async function totalXp(): Promise<number> {
  const ev = await db.events.where("type").equals("review_done").toArray();
  return ev.reduce((s, e) => s + (Number(e.payload?.xp) || 0), 0);
}