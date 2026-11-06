import type { AppEvent, Module, Review, Task } from "./db";
import { computeMastery } from "./mastery";
import { computeStreak } from "./streak";
import { levelInfo, sumXp } from "./xp";

export interface Stats {
  tasksDone: number;
  modulesExplored: number;
  modulesMastered: number;
  reviewSessions: number;
  firstTryCards: number;
  streak: number;
  level: number;
  earlyBird: boolean;
  comeback: boolean;
}

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  hidden?: boolean;
  test: (s: Stats) => boolean;
}

export const BADGES: BadgeDef[] = [
  { id: "first_step", name: "Bước đầu", desc: "Hoàn thành task đầu tiên", test: (s) => s.tasksDone >= 1 },
  { id: "ten_tasks", name: "Chăm chỉ", desc: "Hoàn thành 10 task", test: (s) => s.tasksDone >= 10 },
  { id: "explorer", name: "Nhà thám hiểm", desc: "Khám phá xong một module", test: (s) => s.modulesExplored >= 1 },
  { id: "cartographer", name: "Người dựng bản đồ", desc: "Khám phá xong 3 module", test: (s) => s.modulesExplored >= 3 },
  { id: "first_review", name: "Nhớ lại lần đầu", desc: "Hoàn thành một bài ôn", test: (s) => s.reviewSessions >= 1 },
  { id: "sharp", name: "Trí nhớ sắc", desc: "10 thẻ ôn đúng ngay lần đầu", test: (s) => s.firstTryCards >= 10 },
  { id: "streak3", name: "Ba ngày liền", desc: "Học 3 ngày liên tiếp", test: (s) => s.streak >= 3 },
  { id: "streak7", name: "Một tuần bền bỉ", desc: "Học 7 ngày liên tiếp", test: (s) => s.streak >= 7 },
  { id: "conqueror", name: "Chinh phục", desc: "Đạt ★★★ ở một module", test: (s) => s.modulesMastered >= 1 },
  { id: "level3", name: "Lên cấp 3", desc: "Đạt cấp 3", test: (s) => s.level >= 3 },
  {
    id: "early_bird",
    name: "Chim sớm",
    desc: "Học trước 8 giờ sáng",
    hidden: true,
    test: (s) => s.earlyBird,
  },
  {
    id: "comeback",
    name: "Vượt qua câu khó",
    desc: "Ôn đúng một thẻ từng làm sai",
    hidden: true,
    test: (s) => s.comeback,
  },
];

export function buildStats(tasks: Task[], modules: Module[], reviews: Review[], events: AppEvent[]): Stats {
  const mastery = computeMastery(modules, tasks, reviews);
  const reviewDone = events.filter((e) => e.type === "review_done");
  return {
    tasksDone: tasks.filter((t) => t.status === "done").length,
    modulesExplored: mastery.filter((m) => m.stars >= 1).length,
    modulesMastered: mastery.filter((m) => m.stars >= 3).length,
    reviewSessions: reviewDone.length,
    firstTryCards: reviewDone.reduce((s, e) => s + (Number(e.payload?.firstTry) || 0), 0),
    streak: computeStreak(events.map((e) => e.ts)).streak,
    level: levelInfo(sumXp(events).total).level,
    earlyBird: events.some((e) => new Date(e.ts).getHours() < 8),
    comeback: reviews.some((r) => r.lapses >= 1 && r.reps >= 1),
  };
}

// Kiểm tra và ghi các huy hiệu mới đạt được (mỗi huy hiệu chỉ ghi một lần). Trả về danh sách huy hiệu mới.
export async function checkBadges(): Promise<BadgeDef[]> {
  const { db } = await import("./db");
  return db.transaction("rw", [db.events, db.tasks, db.modules, db.reviews], async () => {
    const [tasks, modules, reviews, events] = await Promise.all([
      db.tasks.toArray(),
      db.modules.toArray(),
      db.reviews.toArray(),
      db.events.where("type").anyOf(["task_done", "review_done"]).toArray(),
    ]);
    const stats = buildStats(tasks, modules, reviews, events);
    const have = new Set((await db.events.where("type").equals("badge").toArray()).map((e) => String(e.payload?.id)));
    const fresh = BADGES.filter((b) => b.test(stats) && !have.has(b.id));
    const ts = Date.now();
    for (const b of fresh) await db.events.add({ type: "badge", ts, payload: { id: b.id } });
    return fresh;
  });
}