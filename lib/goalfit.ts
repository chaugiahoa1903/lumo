// Luna: chọn phần cần học theo mục tiêu (TF-IDF + cosine, không LLM, chạy trong trình duyệt).
import { toTerms, tokenize } from "./splitter";

export interface GoalModule {
  id: number;
  title: string;
  text: string; // nội dung các task đọc của module
  minutes: number;
  optional?: boolean; // phụ lục
}

export interface GoalRank {
  id: number;
  score: number; // cosine 0..1
  matched: string[]; // từ trong mục tiêu khớp nhất với module
}

export type GoalMode = "skim" | "core" | "full";

export const MODE_SHARE: Record<Exclude<GoalMode, "full">, number> = { skim: 0.35, core: 0.65 };
const MIN_REL = 0.45; // chỉ chọn module có điểm ≥ 45% điểm module cao nhất (không lấp cho đủ thời gian)
const TITLE_WEIGHT = 3; // tiêu đề module được tính như lặp 3 lần

function termCounts(terms: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function rankModulesByGoal(goal: string, mods: GoalModule[]): GoalRank[] {
  const q = termCounts(toTerms(tokenize(goal)));
  const docs = mods.map((m) => termCounts(toTerms(tokenize(`${(m.title + ". ").repeat(TITLE_WEIGHT)}${m.text}`))));
  const n = docs.length;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;

  const vec = (c: Map<string, number>) => {
    const w = new Map<string, number>();
    for (const [t, f] of c) w.set(t, (1 + Math.log(f)) * idf(t));
    return w;
  };
  const norm = (w: Map<string, number>) => Math.sqrt([...w.values()].reduce((s, x) => s + x * x, 0));
  const qv = vec(new Map([...q].filter(([t]) => df.has(t)))); // từ mục tiêu không có trong sách thì bỏ qua
  const qn = norm(qv);

  return docs.map((d, i) => {
    if (qn === 0) return { id: mods[i].id, score: 0, matched: [] };
    const dv = vec(d);
    let dot = 0;
    const contrib: [string, number][] = [];
    for (const [t, w] of qv) {
      const x = w * (dv.get(t) ?? 0);
      dot += x;
      if (x > 0) contrib.push([t, x]);
    }
    const dn = norm(dv);
    return {
      id: mods[i].id,
      score: dn === 0 ? 0 : dot / (qn * dn),
      matched: contrib.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
    };
  });
}

// Chọn module theo mức. Luôn giữ thứ tự gốc của sách khi hiển thị; ở đây chỉ trả tập id được chọn.
export function pickByMode(ranks: GoalRank[], mods: GoalModule[], mode: GoalMode): Set<number> {
  const byId = new Map(mods.map((m) => [m.id, m]));
  const main = mods.filter((m) => !m.optional);
  if (mode === "full") return new Set(main.map((m) => m.id));
  const total = main.reduce((s, m) => s + m.minutes, 0);
  const budget = total * MODE_SHARE[mode];
  const sorted = ranks
    .filter((r) => r.score > 0 && byId.has(r.id) && !byId.get(r.id)!.optional)
    .sort((a, b) => b.score - a.score);
  const chosen = new Set<number>();
  let used = 0;
  const top = sorted.length ? sorted[0].score : 0;
  for (const r of sorted) {
    if (r.score < top * MIN_REL) break;
    const m = byId.get(r.id)!;
    if (chosen.size > 0 && used + m.minutes > budget) continue; // chương đầu luôn được chọn; chương sau chỉ chọn nếu còn vừa ngân sách
    chosen.add(r.id);
    used += m.minutes;
  }
  return chosen;
}
