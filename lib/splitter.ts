// Luna: engine chia việc bằng NLP cổ điển (TF-IDF, cosine, TextRank, heuristic).
// Không dùng LLM, không gọi mạng. Chạy hoàn toàn trong trình duyệt.

export interface SplitOptions {
  wordsPerMinute?: number; // tốc độ đọc khi học (từ/phút)
  minChunkWords?: number;
  maxChunkWords?: number;
  minChunksPerModule?: number;
  maxChunksPerModule?: number;
}

export type DraftTaskType = "read" | "flashcard" | "recall";

export interface DraftTask {
  type: DraftTaskType;
  title: string;
  estMinutes: number;
  isMilestone: boolean;
  body: string; // read: đoạn văn; flashcard/recall: câu hỏi
  answer?: string; // flashcard/recall: câu chính (TextRank)
  keywords: string[];
  difficulty: number; // 0..1
  reason: string;
  teaser?: string;
  chunkIndex: number;
}

export interface DraftModule {
  title: string;
  reason: string;
  tasks: DraftTask[];
}

export interface SplitResult {
  modules: DraftModule[];
  stats: { words: number; chunks: number; modules: number; tasks: number; totalMinutes: number; ms: number };
}

const DEFAULTS: Required<SplitOptions> = {
  wordsPerMinute: 100,
  minChunkWords: 150,
  maxChunkWords: 300,
  minChunksPerModule: 2,
  maxChunksPerModule: 8,
};

// ---------- tiện ích ----------
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a: number[]) => {
  const m = avg(a);
  return Math.sqrt(avg(a.map((x) => (x - m) * (x - m))));
};

const STOP = new Set<string>([
  // tiếng Việt (theo âm tiết)
  "là", "và", "của", "các", "một", "có", "được", "trong", "cho", "với", "khi", "để", "này", "những",
  "không", "từ", "như", "theo", "thì", "cũng", "đã", "sẽ", "ra", "nên", "hay", "hoặc", "nếu", "vì",
  "do", "bằng", "tại", "về", "mà", "cần", "rất", "phải", "còn", "đó", "nào", "sau", "trước", "mỗi",
  "tất", "cả", "đều", "cùng", "thể", "người", "việc", "nhiều", "ít", "lên", "xuống", "vào", "rồi",
  // tiếng Anh
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with", "is", "are", "was", "were",
  "be", "been", "it", "its", "this", "that", "these", "those", "as", "by", "from", "can", "will", "not",
  "you", "your", "we", "they", "he", "she", "which", "when", "than", "then", "so", "if", "but", "also",
  "into", "more", "most", "each", "such", "only", "have", "has", "had", "use", "uses", "used", "all",
]);

export function tokenize(text: string): string[] {
  return text.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function okToken(t: string): boolean {
  return t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t);
}

// unigram + bigram (bigram giúp bắt cụm từ tiếng Việt vì mỗi từ thường gồm nhiều âm tiết)
export function toTerms(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const a = okToken(t);
    if (a) out.push(t);
    if (a && i + 1 < tokens.length && okToken(tokens[i + 1])) out.push(t + " " + tokens[i + 1]);
  }
  return out;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .replace(/([.!?…]+["')\]]*)\s+/g, "$1\u0001")
    .split("\u0001")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------- 1. Segmenter ----------
interface Block {
  kind: "heading" | "para";
  text: string;
}

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "para", text: para.join(" ").replace(/\s+/g, " ").trim() });
      para = [];
    }
  };
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const m = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      flushPara();
      blocks.push({ kind: "heading", text: m[1].trim() });
    } else if (line.trim() === "") {
      flushPara();
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  return blocks.filter((b) => b.text.length > 0);
}

interface Chunk {
  text: string;
  heading?: string;
  headingStart: boolean;
  words: number;
}

function splitLong(text: string, max: number): string[] {
  if (countWords(text) <= max) return [text];
  const out: string[] = [];
  let cur: string[] = [];
  let w = 0;
  for (const s of splitSentences(text)) {
    const sw = countWords(s);
    if (w > 0 && w + sw > max) {
      out.push(cur.join(" "));
      cur = [];
      w = 0;
    }
    cur.push(s);
    w += sw;
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

// ---------- 2. TF-IDF + cosine ----------
interface Vec {
  w: Map<string, number>;
  norm: number;
}

function toVec(w: Map<string, number>): Vec {
  let s = 0;
  for (const v of w.values()) s += v * v;
  return { w, norm: Math.sqrt(s) };
}

function cosine(a: Vec, b: Vec): number {
  if (a.norm === 0 || b.norm === 0) return 0;
  const [small, big] = a.w.size <= b.w.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, v] of small.w) {
    const o = big.w.get(t);
    if (o !== undefined) dot += v * o;
  }
  return dot / (a.norm * b.norm);
}

function buildTfidf(docsTerms: string[][]): { vecs: Vec[]; idf: Map<string, number> } {
  const N = docsTerms.length;
  const df = new Map<string, number>();
  for (const terms of docsTerms) for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  const vecs = docsTerms.map((terms) => {
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    const w = new Map<string, number>();
    for (const [t, c] of tf) w.set(t, (1 + Math.log(c)) * (idf.get(t) ?? 1));
    return toVec(w);
  });
  return { vecs, idf };
}

function topKeywords(w: Map<string, number>, k: number): string[] {
  const sorted = [...w.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const chosen: string[] = [];
  for (const [t, wt] of sorted) {
    if (chosen.length >= k) break;
    const parts = t.split(" ");
    if (parts.length === 1) {
      let covered = false;
      for (const [u, uw] of w) {
        if (uw >= 0.8 * wt && u.includes(" ") && u.split(" ").includes(t)) {
          covered = true;
          break;
        }
      }
      if (covered) continue;
    }
    const redundant = chosen.some((c) => c.split(" ").some((x) => parts.includes(x)));
    if (!redundant) chosen.push(t);
  }
  return chosen;
}

// ---------- Chunker (theo số từ + heading + đổi chủ đề giữa chừng) ----------
const HEADING_FLUSH_MIN = 30; // heading ngắt chunk nếu chunk đã có ≥ chừng này từ
const TOPIC_MIN_WORDS = 40; // chỉ xét đổi chủ đề khi chunk đã có ≥ chừng này từ
const TOPIC_SIM = 0.05; // cosine(đoạn mới, chunk đang gom) thấp hơn thì ngắt chunk

function buildChunks(blocks: Block[], o: Required<SplitOptions>): Chunk[] {
  type Item = { kind: "heading"; text: string } | { kind: "para"; text: string; words: number };
  const items: Item[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") items.push({ kind: "heading", text: b.text });
    else for (const piece of splitLong(b.text, o.maxChunkWords)) items.push({ kind: "para", text: piece, words: countWords(piece) });
  }

  // vector TF-IDF của từng đoạn (idf tính trên các đoạn) để so với chunk đang gom
  const paraIdx: number[] = [];
  items.forEach((it, i) => {
    if (it.kind === "para") paraIdx.push(i);
  });
  const { vecs: pv } = buildTfidf(paraIdx.map((i) => toTerms(tokenize(items[i].text))));
  const vecOf = new Map<number, Vec>();
  paraIdx.forEach((i, k) => vecOf.set(i, pv[k]));

  const chunks: Chunk[] = [];
  let parts: string[] = [];
  let words = 0;
  let run = new Map<string, number>();
  let curHeading: string | undefined;
  let chunkHeading: string | undefined;
  let chunkHeadingStart = false;
  let pending = false;

  const flush = () => {
    if (!parts.length) return;
    chunks.push({ text: parts.join("\n\n"), heading: chunkHeading, headingStart: chunkHeadingStart, words });
    parts = [];
    words = 0;
    run = new Map();
  };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "heading") {
      if (words >= HEADING_FLUSH_MIN) flush();
      curHeading = it.text;
      pending = words === 0;
      continue;
    }
    const v = vecOf.get(i)!;
    if (words >= TOPIC_MIN_WORDS && cosine(toVec(run), v) < TOPIC_SIM) {
      flush();
      curHeading = undefined; // đổi chủ đề giữa chừng: tiêu đề cũ không còn đúng
      pending = false;
    }
    if (words > 0 && words + it.words > o.maxChunkWords) flush();
    if (parts.length === 0) {
      chunkHeading = curHeading;
      chunkHeadingStart = pending;
      pending = false;
    }
    parts.push(it.text);
    words += it.words;
    for (const [t, w] of v.w) run.set(t, (run.get(t) ?? 0) + w);
    if (words >= o.minChunkWords) flush();
  }
  flush();

  // gộp đoạn đuôi quá ngắn vào đoạn trước
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (last.words < o.minChunkWords * 0.4 && prev.words + last.words <= o.maxChunkWords * 1.3) {
      chunks.splice(chunks.length - 2, 2, {
        text: prev.text + "\n\n" + last.text,
        heading: prev.heading,
        headingStart: prev.headingStart,
        words: prev.words + last.words,
      });
    }
  }
  return chunks;
}

// ---------- 3. Ranh giới chủ đề (kiểu TextTiling) ----------
function planModules(
  chunks: Chunk[],
  vecs: Vec[],
  o: Required<SplitOptions>
): { starts: number[]; reasons: string[] } {
  const n = chunks.length;
  const minC = o.minChunksPerModule;
  const maxC = o.maxChunksPerModule;
  const reasonAt = new Map<number, string>();
  let cuts: number[] = [];

  if (n >= 2 * minC) {
    const s: number[] = [];
    for (let i = 0; i < n - 1; i++) s.push(cosine(vecs[i], vecs[i + 1]));
    const score = s.map((si, i) => {
      let l = i;
      while (l > 0 && s[l - 1] >= s[l]) l--;
      let r = i;
      while (r < s.length - 1 && s[r + 1] >= s[r]) r++;
      const depth = s[l] - si + (s[r] - si);
      return depth + (chunks[i + 1].headingStart ? 0.1 : 0);
    });
    const cutoff = Math.max(0.1, avg(score) + 0.5 * std(score));
    const cand = score
      .map((d, i) => ({ gap: i + 1, d }))
      .filter((x) => x.d > cutoff)
      .sort((a, b) => b.d - a.d || a.gap - b.gap);
    for (const c of cand) {
      const trial = [...cuts, c.gap].sort((a, b) => a - b);
      const edges = [0, ...trial, n];
      let ok = true;
      for (let k = 1; k < edges.length; k++) {
        if (edges[k] - edges[k - 1] < minC) {
          ok = false;
          break;
        }
      }
      if (ok) {
        cuts = trial;
        reasonAt.set(
          c.gap,
          `Đổi chủ đề: điểm ranh giới ${c.d.toFixed(2)} > ngưỡng ${cutoff.toFixed(2)}` +
            (chunks[c.gap].headingStart ? " (có tiêu đề mới)" : "")
        );
      }
    }
  }

  const edges = [0, ...cuts, n];
  const starts: number[] = [];
  const reasons: string[] = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const a = edges[k];
    const len = edges[k + 1] - a;
    const parts = Math.ceil(len / maxC);
    const base =
      reasonAt.get(a) ??
      (a === 0 ? (n < 2 * minC ? `Tài liệu ngắn (${n} đoạn): giữ một module` : "Module đầu tiên") : "");
    for (let p = 0; p < parts; p++) {
      starts.push(a + Math.round((p * len) / parts));
      reasons.push(p === 0 ? base : `Tách vì module dài hơn ${maxC} đoạn`);
    }
  }
  return { starts, reasons };
}

// ---------- 4. TextRank ----------
function rankSentences(sents: string[], idf: Map<string, number>): number[] {
  const n = sents.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const vs = sents.map((s) => {
    const tf = new Map<string, number>();
    for (const t of toTerms(tokenize(s))) tf.set(t, (tf.get(t) ?? 0) + 1);
    const w = new Map<string, number>();
    for (const [t, c] of tf) w.set(t, (1 + Math.log(c)) * (idf.get(t) ?? 1));
    return toVec(w);
  });
  const sim: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = cosine(vs[i], vs[j]);
      sim[i][j] = c;
      sim[j][i] = c;
    }
  }
  const out = sim.map((r) => r.reduce((a, b) => a + b, 0));
  const D = 0.85;
  let score = new Array<number>(n).fill(1 / n);
  for (let it = 0; it < 30; it++) {
    const next = new Array<number>(n).fill((1 - D) / n);
    for (let j = 0; j < n; j++) {
      if (out[j] === 0) {
        for (let i = 0; i < n; i++) next[i] += (D * score[j]) / n;
      } else {
        for (let i = 0; i < n; i++) if (i !== j) next[i] += (D * score[j] * sim[j][i]) / out[j];
      }
    }
    score = next;
  }
  const total = score.reduce((a, b) => a + b, 0) || 1;
  return score.map((x) => x / total);
}

function pickKeySentence(sents: string[], scores: number[]): { text: string; score: number } {
  if (sents.length === 0) return { text: "", score: 0 };
  let best = -1;
  for (let i = 0; i < sents.length; i++) {
    if (countWords(sents[i]) < 4) continue;
    if (best === -1 || scores[i] > scores[best]) best = i;
  }
  if (best === -1) best = 0;
  let text = sents[best];
  if (text.length > 240) text = text.slice(0, 237).trimEnd() + "…";
  return { text, score: scores[best] ?? 0 };
}

// ---------- 5. Estimator ----------
function difficultyOf(text: string, sentCount: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const avgLen = words.length / Math.max(1, sentCount);
  const lenScore = clamp((avgLen - 8) / 22, 0, 1);
  const acronyms = words.filter((w) => /^[A-Z][A-Z0-9_]+$/.test(w.replace(/[^\p{L}\p{N}_]/gu, ""))).length;
  const techScore = clamp((acronyms / words.length) * 10, 0, 1);
  return round2(0.6 * lenScore + 0.4 * techScore);
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

interface ChunkInfo {
  keywords: string[];
  label: string;
  keySentence: string;
  keyScore: number;
  difficulty: number;
  readMinutes: number;
}

// ---------- Hàm chính ----------
export function splitText(text: string, options: SplitOptions = {}): SplitResult {
  const t0 = now();
  const o: Required<SplitOptions> = { ...DEFAULTS, ...options };
  const chunks = buildChunks(parseBlocks(text), o);
  const empty = { words: 0, chunks: 0, modules: 0, tasks: 0, totalMinutes: 0, ms: 0 };
  if (chunks.length === 0) return { modules: [], stats: { ...empty, ms: now() - t0 } };

  const chunkTerms = chunks.map((c) => {
    const h = c.heading ? `${c.heading}. ${c.heading}. ` : "";
    return toTerms(tokenize(h + c.text));
  });
  const { vecs, idf } = buildTfidf(chunkTerms);

  const infos: ChunkInfo[] = chunks.map((c, i) => {
    const keywords = topKeywords(vecs[i].w, 3);
    const label = c.heading ?? (keywords.slice(0, 2).join(", ") || `đoạn ${i + 1}`);
    const sents = splitSentences(c.text);
    const key = pickKeySentence(sents, rankSentences(sents, idf));
    return {
      keywords,
      label,
      keySentence: key.text,
      keyScore: key.score,
      difficulty: difficultyOf(c.text, sents.length),
      readMinutes: clamp(Math.ceil(c.words / o.wordsPerMinute), 1, 5),
    };
  });

  const { starts, reasons } = planModules(chunks, vecs, o);
  const bounds = [...starts, chunks.length];
  const modules: DraftModule[] = [];
  let totalTasks = 0;
  let totalMinutes = 0;

  for (let m = 0; m < starts.length; m++) {
    const from = bounds[m];
    const to = bounds[m + 1];

    const sum = new Map<string, number>();
    for (let i = from; i < to; i++) for (const [t, v] of vecs[i].w) sum.set(t, (sum.get(t) ?? 0) + v);
    const title = cap(chunks[from].heading ?? (topKeywords(sum, 3).join(", ") || `Module ${m + 1}`));

    const tasks: DraftTask[] = [];
    for (let i = from; i < to; i++) {
      const c = chunks[i];
      const info = infos[i];
      const j = i - from;
      const kw = info.keywords.length ? info.keywords.join(", ") : "(không có)";
      const next = i + 1 < chunks.length ? infos[i + 1] : undefined;

      tasks.push({
        type: "read",
        title: `Đọc: ${info.label}`,
        estMinutes: info.readMinutes,
        isMilestone: false,
        body: c.text,
        keywords: info.keywords,
        difficulty: info.difficulty,
        reason:
          `Từ khóa: ${kw} · ${c.words} từ ÷ ${o.wordsPerMinute} từ/phút = ${info.readMinutes} phút · ` +
          `độ khó ${info.difficulty.toFixed(2)}`,
        teaser: next ? `Tiếp theo: "${next.label}". Đoán thử xem nó liên quan gì đến "${info.label}"?` : undefined,
        chunkIndex: i,
      });

      const isFlash = j % 2 === 0;
      tasks.push({
        type: isFlash ? "flashcard" : "recall",
        title: isFlash ? `Flashcard: ${info.keywords[0] ?? info.label}` : `Nhớ lại: ${info.label}`,
        estMinutes: 2,
        isMilestone: false,
        body: isFlash
          ? `Giải thích ngắn gọn: "${info.keywords[0] ?? info.label}"`
          : `Không nhìn lại: ý chính của phần "${info.label}" là gì? Viết 1 câu.`,
        answer: info.keySentence,
        keywords: info.keywords,
        difficulty: info.difficulty,
        reason:
          `Ôn ngay sau khi đọc "${info.label}" · câu chính chọn bằng TextRank (điểm ${info.keyScore.toFixed(2)}) · ` +
          `từ khóa: ${kw}`,
        chunkIndex: i,
      });
    }
    tasks[tasks.length - 1].isMilestone = true;

    totalTasks += tasks.length;
    totalMinutes += tasks.reduce((s, t) => s + t.estMinutes, 0);
    modules.push({ title, reason: reasons[m], tasks });
  }

  return {
    modules,
    stats: {
      words: chunks.reduce((s, c) => s + c.words, 0),
      chunks: chunks.length,
      modules: modules.length,
      tasks: totalTasks,
      totalMinutes,
      ms: now() - t0,
    },
  };
}