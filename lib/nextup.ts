import type { Task, TaskType } from "./db";

// Trọng số khởi đầu: heuristic do người làm chọn, CHƯA tối ưu từ dữ liệu.
export const WEIGHTS = { proximity: 0.35, forgetting: 0.3, fit: 0.2, variety: 0.15 } as const;
export type PartKey = keyof typeof WEIGHTS;

export const PER_MODULE = 2; // số task todo đầu mỗi module được đưa vào xét
export const DUE_SATURATION = 4; // từ ngần này thẻ đến hạn trở lên, độ quên = 1
const REASON_MIN = 0.08; // đóng góp tối thiểu để được nêu trong lý do

export interface NextUpContext {
  remainingMinutes: number; // phút còn lại trong phiên (cap mềm trừ phút đã học)
  recentTypes: TaskType[]; // loại task vừa hoàn thành, mới nhất trước
  dueByModule: Record<number, number>; // số thẻ SM-2 đến hạn theo module
}

export interface Ranked {
  task: Task;
  score: number;
  parts: Record<PartKey, number>; // mỗi thành phần 0..1
  reasons: string[]; // tiếng Việt, tối đa 2 dòng
}

// Độ gần mốc tính ở mức MODULE (cùng giá trị cho mọi ứng viên của module),
// để không phá thứ tự "dễ trước" của Luna trong module.
function moduleProximity(list: Task[]): { value: number; milestoneIdx: number | null } {
  const idx = list.findIndex((t) => t.isMilestone);
  if (idx >= 0) return { value: 1 / (idx + 1), milestoneIdx: idx };
  return { value: 0.5 / Math.max(1, list.length), milestoneIdx: null };
}

function fitScore(est: number, rem: number): number {
  if (rem <= 0) return 0;
  if (est <= rem) return 0.5 + 0.5 * (est / rem);
  return 0.5 * (1 - (est - rem) / est);
}

function varietyScore(type: TaskType, recent: TaskType[]): number {
  const last = recent.slice(0, 2);
  if (last.length === 0) return 1;
  return 1 - last.filter((t) => t === type).length / 2;
}

export function rankTasks(tasks: Task[], ctx: NextUpContext): Ranked[] {
  const todo = tasks.filter((t) => t.status === "todo").sort((a, b) => a.order - b.order);
  const byModule = new Map<number, Task[]>();
  for (const t of todo) {
    const list = byModule.get(t.moduleId) ?? [];
    list.push(t);
    byModule.set(t.moduleId, list);
  }

  const out: Ranked[] = [];
  for (const [moduleId, list] of byModule) {
    const prox = moduleProximity(list);
    const due = ctx.dueByModule[moduleId] ?? 0;
    list.slice(0, PER_MODULE).forEach((task, i) => {
      const parts: Record<PartKey, number> = {
        proximity: prox.value,
        forgetting: Math.min(1, due / DUE_SATURATION),
        fit: fitScore(task.estMinutes, ctx.remainingMinutes),
        variety: varietyScore(task.type, ctx.recentTypes),
      };
      const score =
        WEIGHTS.proximity * parts.proximity +
        WEIGHTS.forgetting * parts.forgetting +
        WEIGHTS.fit * parts.fit +
        WEIGHTS.variety * parts.variety;

      const dTask = prox.milestoneIdx === null ? null : prox.milestoneIdx - i + 1;
      const proximityText =
        dTask === 1
          ? "Task này là mốc: làm xong là chạm mốc."
          : dTask !== null && dTask > 1
            ? `Còn ${dTask} task nữa là tới mốc của module.`
            : "Module này đang ở sát mốc.";

      const text: Record<PartKey, string> = {
        proximity: proximityText,
        forgetting: `Module này có ${due} thẻ ôn đến hạn; làm tiếp giúp nhớ lại ngữ cảnh.`,
        fit: `Vừa với ${Math.round(ctx.remainingMinutes)} phút còn lại của phiên (task ${task.estMinutes} phút).`,
        variety: "Khác dạng với task bạn vừa làm.",
      };
      const reasons = (Object.keys(WEIGHTS) as PartKey[])
        .map((k) => ({ k, c: WEIGHTS[k] * parts[k] }))
        .filter((x) => x.c >= REASON_MIN)
        .sort((a, b) => b.c - a.c)
        .slice(0, 2)
        .map((x) => text[x.k]);

      out.push({ task, score, parts, reasons });
    });
  }
  return out.sort((a, b) => b.score - a.score || a.task.order - b.task.order);
}