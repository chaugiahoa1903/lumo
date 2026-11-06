import type { Module, Review, Task } from "./db";

export const MASTERY_RATIO = 0.8;

export interface ModuleMastery {
  moduleId: number;
  courseId: number;
  title: string;
  order: number;
  total: number;
  done: number;
  todo: number;
  explored: boolean;
  cards: number;
  stars: 0 | 1 | 2 | 3;
  hint: string;
}

// ★ khám phá: xong mọi task. ★★ nắm chắc: ≥80% thẻ ôn đúng ≥1 lần theo lịch.
// ★★★ thành thạo: ≥80% thẻ ôn đúng liên tiếp ≥2 lần.
export function computeMastery(modules: Module[], tasks: Task[], reviews: Review[]): ModuleMastery[] {
  const rev = new Map<number, Review>();
  for (const r of reviews) rev.set(r.taskId, r);
  const sorted = [...modules].sort((a, b) => a.courseId - b.courseId || a.order - b.order);

  return sorted.map((m) => {
    const ts = tasks.filter((t) => t.moduleId === m.id);
    const total = ts.length;
    const done = ts.filter((t) => t.status === "done").length;
    const todo = ts.filter((t) => t.status === "todo").length;
    const explored = total > 0 && todo === 0 && done > 0;

    const cardTasks = ts.filter((t) => rev.has(t.id));
    const cards = cardTasks.length;
    const need = Math.ceil(cards * MASTERY_RATIO);
    const k1 = cardTasks.filter((t) => (rev.get(t.id)?.reps ?? 0) >= 1).length;
    const k2 = cardTasks.filter((t) => (rev.get(t.id)?.reps ?? 0) >= 2).length;

    let stars: 0 | 1 | 2 | 3 = 0;
    if (explored) {
      stars = 1;
      if (cards > 0 && k1 >= need) {
        stars = 2;
        if (k2 >= need) stars = 3;
      }
    }

    let hint: string;
    if (!explored) hint = todo > 0 ? `Còn ${todo} task để khám phá module này` : "Chưa có task nào xong";
    else if (cards === 0) hint = "Chưa có thẻ ôn nào trong module này";
    else if (stars === 1) hint = `Ôn đúng thêm ${need - k1} thẻ để lên ★★`;
    else if (stars === 2) hint = `Ôn đúng liên tiếp 2 lần thêm ${need - k2} thẻ để lên ★★★`;
    else hint = "Đã thành thạo module này";

    return { moduleId: m.id, courseId: m.courseId, title: m.title, order: m.order, total, done, todo, explored, cards, stars, hint };
  });
}

export async function loadMastery(courseId?: number): Promise<ModuleMastery[]> {
  const { db } = await import("./db");
  const modules =
    courseId === undefined ? await db.modules.toArray() : await db.modules.where("courseId").equals(courseId).toArray();
  const [tasks, reviews] = await Promise.all([db.tasks.toArray(), db.reviews.toArray()]);
  return computeMastery(modules, tasks, reviews);
}