// Luna: engine chia việc bằng NLP cổ điển (TF-IDF, cosine, TextRank, heuristic).
// Không dùng LLM, không gọi mạng. Chạy hoàn toàn trong trình duyệt.

export interface SplitOptions {
  wordsPerMinute?: number; // tốc độ đọc khi học (từ/phút)
  minChunkWords?: number;
  maxChunkWords?: number;
  minChunksPerModule?: number;
  maxChunksPerModule?: number;
  // Chế độ sách: module bám theo mục (heading) của tài liệu thay vì TextTiling,
  // làm tròn phút đọc, ôn bớt (mặc định cứ 2 đoạn đọc mới có 1 task ôn). Mặc định tắt.
  structured?: boolean;
  moduleBy?: "section" | "chapter"; // structured: mỗi mục (mặc định) hay mỗi chương một module
  choiceCards?: boolean; // thẻ ôn dạng trắc nghiệm (mặc định bật cùng structured)
  reviewEvery?: number; // cứ N đoạn đọc thì có 1 task ôn (cuối module luôn có)
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
  options?: string[]; // structured: các lựa chọn (đã xáo)
  correct?: number[]; // chỉ số đáp án đúng trong options (1 = chọn một, >1 = chọn nhiều)
}

export interface DraftModule {
  title: string;
  reason: string;
  chapter?: string; // chỉ có ở chế độ structured
  optional?: boolean; // phụ lục: nên tắt mặc định
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
  structured: false,
  moduleBy: "section",
  choiceCards: false,
  reviewEvery: 1,
};

const UNIT_MAX_CHUNKS = 6; // chế độ structured: mục dài hơn thì cắt thành (phần k/n)
const UNIT_TINY_WORDS = 120; // mục chỉ 1 đoạn và ít từ hơn mức này thì gộp vào mục kề

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

// Dấu câu được đổi thành BOUNDARY (độ dài 1 nên okToken loại ngay) để bigram không ghép xuyên dấu câu.
// Từ có gạch nối giữa các chữ cái ("nơ-ron") giữ thành một token.
export const BOUNDARY = "|";

// Từ chức năng tiếng Việt bổ sung: từ nghi vấn và số đếm không mang nội dung chủ đề.
for (const w of ["gì", "nào", "đâu", "hơn", "mươi", "mười", "chín", "tám", "bảy", "sáu", "bốn", "trăm", "nghìn", "ngàn"]) {
  STOP.add(w);
}

const PUNCT_RE = /[,;:.!?…()"“”]/;

export function tokenize(text: string): string[] {
  const m =
    text
      .normalize("NFC")
      .toLowerCase()
      .match(/\p{L}+(?:-\p{L}+)+|[\p{L}\p{N}]+|[,;:.!?…()"“”]/gu) ?? [];
  return m.map((t) => (t.length === 1 && PUNCT_RE.test(t) ? BOUNDARY : t));
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

// ---------- Cụm từ theo thống kê (thay cho bộ tách từ tiếng Việt) ----------
// Tiếng Việt viết cách nhau theo âm tiết, nên cặp âm tiết liền kề có thể là một từ ("dữ liệu") hoặc ghép sai ranh giới ("bị dữ").
// Heuristic: chỉ coi là cụm khi cặp xuất hiện >= COLLOC_MIN_COUNT lần và độ gắn kết Dice >= COLLOC_MIN_DICE trong CHÍNH tài liệu.
// Ngưỡng là heuristic, chưa hiệu chỉnh trên nhiều tài liệu. Tài liệu quá ngắn không đủ thống kê: dùng cách cũ (toTerms).
const COLLOC_MIN_COUNT = 2;
const COLLOC_MIN_DICE = 0.25;
const COLLOC_MIN_TERMS = 600;

// Từ chức năng tiếng Việt bổ sung (giới từ, liên từ, phó từ).
// Chỉ dùng cho chia cụm và chọn từ khóa (không đổi STOP toàn cục để không ảnh hưởng ranh giới module, goalfit, quiz).
const EXTRA_STOP = new Set(["bị", "dù", "chứ", "nhưng", "đến", "trên", "dưới", "giữa", "bởi", "qua", "tuy", "vẫn", "đang", "thường", "tôi", "bạn", "chúng", "họ", "mình", "ta"]);
const okSeg = (t: string) => okToken(t) && !EXTRA_STOP.has(t);

export interface Colloc {
  c1: Map<string, number>;
  c2: Map<string, number>;
  c3: Map<string, number>;
}

export function buildColloc(docs: string[][]): Colloc | null {
  const c1 = new Map<string, number>();
  const c2 = new Map<string, number>();
  const c3 = new Map<string, number>();
  const inc = (m: Map<string, number>, k: string) => {
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  let total = 0;
  for (const toks of docs) {
    for (let i = 0; i < toks.length; i++) {
      const a = toks[i];
      if (!okSeg(a)) continue;
      total++;
      inc(c1, a);
      const b = toks[i + 1];
      if (b === undefined || !okSeg(b)) continue;
      inc(c2, a + " " + b);
      const c = toks[i + 2];
      if (c !== undefined && okSeg(c)) inc(c3, a + " " + b + " " + c);
    }
  }
  return total < COLLOC_MIN_TERMS ? null : { c1, c2, c3 };
}

function validPair(col: Colloc, a: string, b: string): boolean {
  const n = col.c2.get(a + " " + b) ?? 0;
  if (n < COLLOC_MIN_COUNT) return false;
  return (2 * n) / ((col.c1.get(a) ?? 0) + (col.c1.get(b) ?? 0)) >= COLLOC_MIN_DICE;
}

// Chia chuỗi token thành các đơn vị KHÔNG chồng nhau: ưu tiên bộ ba, rồi cặp hợp lệ, còn lại là âm tiết đơn.
export function segmentTerms(tokens: string[], col: Colloc | null): string[] {
  if (!col) return toTerms(tokens);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const a = tokens[i];
    if (!okSeg(a)) {
      i++;
      continue;
    }
    const b = tokens[i + 1];
    const c = tokens[i + 2];
    if (b !== undefined && okSeg(b) && validPair(col, a, b)) {
      if (c !== undefined && okSeg(c) && validPair(col, b, c)) {
        const n3 = col.c3.get(a + " " + b + " " + c) ?? 0;
        const m = Math.min(col.c2.get(a + " " + b) ?? 0, col.c2.get(b + " " + c) ?? 0);
        if (n3 >= COLLOC_MIN_COUNT && n3 >= 0.6 * m) {
          out.push(a + " " + b + " " + c);
          i += 3;
          continue;
        }
      }
      out.push(a + " " + b);
      i += 2;
      continue;
    }
    out.push(a);
    i++;
  }
  return out;
}

// Ưu tiên cụm nhiều âm tiết khi chọn từ khóa: âm tiết đơn có dấu tiếng Việt thường chỉ là mảnh của một từ ghép.
// Hệ số 0.5 là heuristic, chưa hiệu chỉnh trên nhiều tài liệu.
const UNIGRAM_PENALTY = 0.5;
export function preferCompounds<T extends { w: Map<string, number> }>(v: T): T {
  const w = new Map<string, number>();
  for (const [t, x] of v.w) {
    w.set(t, !t.includes(" ") && !t.includes("-") && /[^\u0000-\u007f]/.test(t) ? x * UNIGRAM_PENALTY : x);
  }
  return { ...v, w };
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
  level?: number; // chỉ heading: 1..6
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
      blocks.push({ kind: "heading", text: m[1].trim(), level: /^\s*(#+)/.exec(line)![1].length });
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
  chapter?: string; // structured: heading cấp 1 gần nhất
  section?: string; // structured: heading cấp 2 gần nhất (hoặc chương nếu chưa có)
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
  type Item = { kind: "heading"; text: string; level: number } | { kind: "para"; text: string; words: number };
  const items: Item[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") items.push({ kind: "heading", text: b.text, level: b.level ?? 1 });
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
  let curChapter: string | undefined;
  let curSection: string | undefined;
  let chunkChapter: string | undefined;
  let chunkSection: string | undefined;

  const flush = () => {
    if (!parts.length) return;
    chunks.push({
      text: parts.join("\n\n"),
      heading: chunkHeading,
      headingStart: chunkHeadingStart,
      words,
      chapter: chunkChapter,
      section: chunkSection,
    });
    parts = [];
    words = 0;
    run = new Map();
  };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "heading") {
      if (o.structured && it.level <= 2) {
        flush(); // mục mới (chương/mục) luôn mở chunk mới, không gộp qua ranh giới
        if (it.level === 1) {
          curChapter = it.text;
          curSection = undefined;
        } else curSection = it.text;
      } else if (words >= HEADING_FLUSH_MIN) flush();
      curHeading = it.text;
      pending = words === 0;
      continue;
    }
    const v = vecOf.get(i)!;
    if (words >= TOPIC_MIN_WORDS && cosine(toVec(run), v) < TOPIC_SIM) {
      flush();
      if (!o.structured) curHeading = undefined; // đổi chủ đề giữa chừng: tiêu đề cũ không còn đúng
      pending = false;
    }
    if (words > 0 && words + it.words > o.maxChunkWords) flush();
    if (parts.length === 0) {
      chunkHeading = curHeading;
      chunkChapter = curChapter;
      chunkSection = curSection ?? curChapter;
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
    const sameUnit = !o.structured || (prev.chapter === last.chapter && prev.section === last.section);
    if (sameUnit && last.words < o.minChunkWords * 0.4 && prev.words + last.words <= o.maxChunkWords * 1.3) {
      chunks.splice(chunks.length - 2, 2, {
        text: prev.text + "\n\n" + last.text,
        heading: prev.heading,
        headingStart: prev.headingStart,
        words: prev.words + last.words,
        chapter: prev.chapter,
        section: prev.section,
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

// ---------- Chế độ sách: module theo mục ----------
interface Unit {
  chapter?: string;
  title: string;
  from: number;
  to: number; // không gồm
}

function planUnits(chunks: Chunk[], moduleBy: "section" | "chapter"): { units: Unit[]; reasons: string[] } {
  // 1) nhóm các chunk liền nhau có cùng (chương, mục)
  let units: Unit[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const last = units[units.length - 1];
    if (last && last.chapter === c.chapter && last.title === (c.section ?? c.heading ?? "")) last.to = i + 1;
    else units.push({ chapter: c.chapter, title: c.section ?? c.heading ?? "", from: i, to: i + 1 });
  }
  if (moduleBy === "chapter") {
    // mỗi chương một module (không gộp, không cắt); mục con vẫn hiện trong tên task
    const byChapter: Unit[] = [];
    for (const u of units) {
      const last = byChapter[byChapter.length - 1];
      if (last && last.chapter === u.chapter) last.to = u.to;
      else byChapter.push({ ...u, title: u.chapter ?? u.title });
    }
    return {
      units: byChapter,
      reasons: byChapter.map((u) => `Một chương của tài liệu (${u.to - u.from} đoạn đọc)`),
    };
  }
  const words = (u: Unit) => chunks.slice(u.from, u.to).reduce((s, c) => s + c.words, 0);
  const tiny = (u: Unit) => u.to - u.from === 1 && words(u) < UNIT_TINY_WORDS;

  // 2) mục quá nhỏ: gộp tiến vào mục kế tiếp cùng chương (lấy tên mục kế)
  const fwd: Unit[] = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const nx = units[i + 1];
    if (tiny(u) && nx && nx.chapter === u.chapter) {
      units[i + 1] = { ...nx, from: u.from };
      continue;
    }
    fwd.push(u);
  }
  // 3) còn nhỏ mà không có mục sau cùng chương: gộp lùi vào mục trước (giữ tên mục trước)
  units = [];
  for (const u of fwd) {
    const pv = units[units.length - 1];
    if (tiny(u) && pv && pv.chapter === u.chapter) pv.to = u.to;
    else units.push({ ...u });
  }

  // 4) mục dài: cắt đều thành (phần k/n)
  const out: Unit[] = [];
  const reasons: string[] = [];
  for (const u of units) {
    const n = u.to - u.from;
    const parts = Math.max(1, Math.ceil(n / UNIT_MAX_CHUNKS));
    for (let k = 0; k < parts; k++) {
      const a = u.from + Math.round((k * n) / parts);
      const b = u.from + Math.round(((k + 1) * n) / parts);
      const title = parts > 1 ? `${u.title} (phần ${k + 1}/${parts})` : u.title;
      out.push({ chapter: u.chapter, title, from: a, to: b });
      reasons.push(
        (u.chapter && u.chapter !== u.title ? `Mục của "${u.chapter}"` : "Chương/mục theo tiêu đề tài liệu") +
          (parts > 1 ? ` · mục dài ${n} đoạn nên cắt thành ${parts} phần` : ""),
      );
    }
  }
  return { units: out, reasons };
}

// Bộ sinh số giả ngẫu nhiên có hạt giống: cùng văn bản thì ra cùng thứ tự lựa chọn (dễ kiểm thử).
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cắt câu còn ~13 từ quanh chỗ trống để người học không phải đọc/nhớ cả câu dài.
function windowAround(blanked: string, before = 7, after = 5): string {
  const toks = blanked.split(/\s+/).filter(Boolean);
  const at = toks.findIndex((t) => t.includes("_____"));
  if (at < 0 || toks.length <= before + after + 1) return blanked;
  const a = Math.max(0, at - before);
  const b = Math.min(toks.length, at + after + 1);
  return (a > 0 ? "… " : "") + toks.slice(a, b).join(" ") + (b < toks.length ? " …" : "");
}

// Rút gọn câu chính: cắt ở dấu phẩy/chấm phẩy/gạch ngang gần mốc maxWords nhất, không thì cắt cứng.
function shorten(sentence: string, maxWords = 20): string {
  const toks = sentence.trim().split(/\s+/);
  if (toks.length <= maxWords) return sentence.trim();
  let cut = -1;
  for (let i = Math.min(maxWords, toks.length) - 1; i >= Math.floor(maxWords / 2); i--) {
    if (/[,;:—–-]$/.test(toks[i])) {
      cut = i;
      break;
    }
  }
  const end = cut >= 0 ? cut : maxWords - 1;
  return toks.slice(0, end + 1).join(" ").replace(/[,;:—–-]+$/, "") + " …";
}

// Flashcard điền chỗ trống: che 1 từ khóa có trong câu chính.
function makeCloze(sentence: string, keywords: string[]): { body: string; answer: string; word: string } | undefined {
  const sent = sentence.trim();
  if (sent.length < 25) return undefined;
  for (const k of keywords) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc})(?![\\p{L}\\p{N}])`, "iu");
    const m = re.exec(sent);
    if (!m) continue;
    const word = m[2];
    const blanked = sent.replace(new RegExp(re.source, "giu"), (_all, pre: string) => `${pre}_____`); // che mọi lần xuất hiện
    return {
      body: `Điền từ còn thiếu: "${windowAround(blanked)}"`,
      answer: `${word}\n\nCâu gốc: ${sent}`,
      word,
    };
  }
  return undefined;
}

// ---------- Hàm chính ----------
export function splitText(text: string, options: SplitOptions = {}): SplitResult {
  const t0 = now();
  const o: Required<SplitOptions> = { ...DEFAULTS, ...options };
  const chunks = buildChunks(parseBlocks(text), o);
  const empty = { words: 0, chunks: 0, modules: 0, tasks: 0, totalMinutes: 0, ms: 0 };
  if (chunks.length === 0) return { modules: [], stats: { ...empty, ms: now() - t0 } };

  // Cụm từ theo thống kê của chính tài liệu (xem buildColloc). Tiêu đề chỉ đếm một lần dù được lặp khi tính TF-IDF.
  const colloc = buildColloc([
    ...chunks.map((c) => tokenize(c.text)),
    ...[...new Set(chunks.map((c) => c.heading).filter((h): h is string => !!h))].map((h) => tokenize(h)),
  ]);
  const chunkTerms = chunks.map((c) => {
    const h = c.heading ? `${c.heading}. ${c.heading}. ` : "";
    return toTerms(tokenize(h + c.text));
  });
  const { vecs, idf } = buildTfidf(chunkTerms);
  // Từ khóa chọn trên term đã chia theo cụm thống kê (buildColloc); ranh giới module và xếp hạng câu vẫn dùng term cũ để không đổi hành vi.
  const kwVecs = colloc
    ? buildTfidf(
        chunks.map((c) =>
          segmentTerms(tokenize((c.heading ? c.heading + ". " + c.heading + ". " : "") + c.text), colloc),
        ),
      ).vecs.map(preferCompounds)
    : vecs;

  // structured: nhiều đoạn cùng một tiêu đề thì đánh số (k/n) để tên task không trùng
  const keyOf = (c: Chunk) => `${c.chapter ?? ""}|${c.heading ?? ""}`;
  const sameCount = new Map<string, number>();
  if (o.structured) for (const c of chunks) sameCount.set(keyOf(c), (sameCount.get(keyOf(c)) ?? 0) + 1);
  const seen = new Map<string, number>();

  const infos: ChunkInfo[] = chunks.map((c, i) => {
    const keywords = topKeywords(kwVecs[i].w, 3);
    let label = c.heading ?? (keywords.slice(0, 2).join(", ") || `đoạn ${i + 1}`);
    if (o.structured && c.heading) {
      const n = sameCount.get(keyOf(c)) ?? 1;
      const k = (seen.get(keyOf(c)) ?? 0) + 1;
      seen.set(keyOf(c), k);
      if (n > 1) label = `${c.heading} (${k}/${n})`;
    }
    const sents = splitSentences(c.text);
    const key = pickKeySentence(sents, rankSentences(sents, idf));
    return {
      keywords,
      label,
      keySentence: key.text,
      keyScore: key.score,
      difficulty: difficultyOf(c.text, sents.length),
      readMinutes: clamp(o.structured ? Math.round(c.words / o.wordsPerMinute) : Math.ceil(c.words / o.wordsPerMinute), 1, 5),
    };
  });

  // kho từ khóa của cả tài liệu, dùng làm đáp án gây nhiễu (chỉ chế độ structured)
  const pool = infos.flatMap((inf, ci) => inf.keywords.map((k) => ({ k, ci })));
  const wc = (x: string) => x.split(/\s+/).length;
  const mkChoices = (
    i: number,
    correct: string[],
    nDistract: number,
    src: { k: string; ci: number }[] = pool,
  ): { options: string[]; correct: number[] } | undefined => {
    if (correct.length === 0) return undefined;
    const own = new Set(correct.map((x) => x.toLowerCase()));
    const text = chunks[i].text.toLowerCase();
    const seenK = new Set<string>();
    const cands: string[] = [];
    for (const { k, ci } of src) {
      const lk = k.toLowerCase();
      if (ci === i || own.has(lk) || seenK.has(lk) || text.includes(lk)) continue; // loại từ có trong đoạn đang học
      seenK.add(lk);
      cands.push(k);
    }
    if (cands.length < nDistract) return undefined;
    const rnd = rng(i * 7919 + 13);
    shuffleInPlace(cands, rnd);
    const target = wc(correct[0]);
    cands.sort((a, b) => Number(wc(a) !== target) - Number(wc(b) !== target)); // ưu tiên cùng số từ
    const opts = shuffleInPlace([...correct, ...cands.slice(0, nDistract)], rnd);
    return { options: opts, correct: correct.map((c) => opts.indexOf(c)).sort((x, y) => x - y) };
  };

  // Từ nội dung của một câu (giữ chữ gốc), xếp theo idf giảm dần: từ hiếm/đặc trưng đứng trước.
  const contentWords = (sentence: string, skip: Set<string>, anchor?: string): string[] => {
    const toks = tokenize(sentence);
    const at = anchor ? toks.indexOf(tokenize(anchor)[0] ?? "") : -1;
    const seenW = new Set<string>();
    const scored: { w: string; s: number }[] = [];
    toks.forEach((w, idx) => {
      if (seenW.has(w) || skip.has(w) || !okToken(w) || w.length < 3) return;
      seenW.add(w);
      const near = at >= 0 ? 1 + 1.5 / (1 + Math.abs(idx - at)) : 1; // từ gần từ khóa diễn giải nó tốt hơn
      scored.push({ w, s: (idf.get(w) ?? 1) * near });
    });
    scored.sort((a, b) => b.s - a.s);
    const out: string[] = [];
    for (const { w } of scored) {
      const stem = w.slice(0, 5);
      if (w.length >= 6 && out.some((x) => x.length >= 6 && x.slice(0, 5) === stem)) continue; // refers/referring: giữ một từ
      out.push(w);
    }
    return out;
  };
  const wordPool = infos.flatMap((inf, ci) => contentWords(inf.keySentence, new Set()).slice(0, 6).map((k) => ({ k, ci })));

  // Thẻ từ khóa: hiện một từ khóa, người học chọn 1–3 từ diễn giải ý chính của nó (số từ theo độ dài câu chính).
  const explainCard = (i: number, info: ChunkInfo) => {
    const sent = info.keySentence.replace(/^>\s*/, "");
    const low = sent.toLowerCase();
    const term = info.keywords.find((k) => low.includes(k.toLowerCase()));
    if (!term) return undefined;
    const words = contentWords(sent, new Set(tokenize(term)), term);
    const n = sent.split(/\s+/).length;
    let k = Math.min(words.length, n <= 12 ? 1 : n <= 28 ? 2 : 3); // câu càng phức tạp, càng nhiều từ cần chọn (tối đa 3)
    if (k < 1) return undefined;
    // Gộp âm tiết được chọn mà đứng liền nhau trong câu ("láng" + "giềng" -> "láng giềng"): không có bộ tách từ nên đáp án dễ bị cắt vụn.
    const sentToks = tokenize(sent);
    const picked = words
      .slice(0, k)
      .map((w) => ({ w, at: sentToks.indexOf(w) }))
      .sort((a, b) => a.at - b.at);
    const correct: string[] = [];
    let prevAt = -2;
    for (const p of picked) {
      if (correct.length > 0 && p.at >= 0 && p.at === prevAt + 1) correct[correct.length - 1] += " " + p.w;
      else correct.push(p.w);
      prevAt = p.at;
    }
    k = correct.length;
    const choices = mkChoices(i, correct, 3, wordPool);
    if (!choices) return undefined;
    return {
      term,
      choices,
      body: `Chọn ${k} từ diễn giải ý chính của "${term}".`,
      answer: `${correct.join(", ")}\n\nCâu gốc: ${shorten(sent, 26)}`,
    };
  };

  let starts: number[];
  let reasons: string[];
  let unitMeta: Unit[] | undefined;
  if (o.structured) {
    const pu = planUnits(chunks, o.moduleBy);
    unitMeta = pu.units;
    starts = pu.units.map((u) => u.from);
    reasons = pu.reasons;
  } else {
    ({ starts, reasons } = planModules(chunks, vecs, o));
  }
  const bounds = [...starts, chunks.length];
  const reviewEvery = options.reviewEvery ?? (o.structured ? 2 : 1);
  const cc = options.choiceCards ?? o.structured;
  const modules: DraftModule[] = [];
  let totalTasks = 0;
  let totalMinutes = 0;

  for (let m = 0; m < starts.length; m++) {
    const from = bounds[m];
    const to = bounds[m + 1];

    const sum = new Map<string, number>();
    // Tên dự phòng lấy từ vector từ khóa theo cụm (kwVecs), cùng cách chọn với từ khóa của task.
    for (let i = from; i < to; i++) for (const [t, v] of kwVecs[i].w) sum.set(t, (sum.get(t) ?? 0) + v);
    const kwTitle = cap(topKeywords(sum, 3).join(", ") || `Module ${m + 1}`);
    // Mục không có tiêu đề bị cắt thành " (phần k/n)": phần tên trống thay bằng từ khóa thay vì để module không tên.
    const rawTitle = unitMeta ? unitMeta[m].title : "";
    const partSuffix = /\s*\(phần \d+\/\d+\)\s*$/.exec(rawTitle)?.[0] ?? "";
    const baseTitle = rawTitle.slice(0, rawTitle.length - partSuffix.length).trim();
    const title = unitMeta
      ? baseTitle
        ? rawTitle
        : kwTitle + (partSuffix ? " " + partSuffix.trim() : "")
      : cap(chunks[from].heading ?? kwTitle);
    const chapter = unitMeta ? unitMeta[m].chapter : undefined;

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

      if ((j + 1) % reviewEvery !== 0 && i !== to - 1) continue; // ôn bớt: không phải mọi đoạn đều có task ôn
      let isFlash = Math.floor(j / reviewEvery) % 2 === 0;
      // Flashcard: ưu tiên thẻ từ khóa (chọn từ diễn giải), không được thì điền chỗ trống, không được nữa thì chuyển sang "nhớ lại"
      let explain: ReturnType<typeof explainCard>;
      let cloze: { body: string; answer: string; word: string } | undefined;
      if (cc && isFlash) {
        explain = explainCard(i, info);
        if (!explain) cloze = makeCloze(info.keySentence.replace(/^>\s*/, ""), info.keywords);
        if (!explain && !cloze) isFlash = false;
      }
      const choices = !cc
        ? undefined
        : explain
          ? explain.choices
          : cloze
            ? mkChoices(i, [cloze.word], 3)
            : !isFlash && info.keywords.length >= 2
              ? mkChoices(i, info.keywords, 3)
              : undefined;
      tasks.push({
        type: isFlash ? "flashcard" : "recall",
        title: explain
          ? `Flashcard: ${explain.term}`
          : cloze
            ? `Flashcard: ${info.label}`
            : isFlash
            ? `Flashcard: ${info.keywords[0] ?? info.label}`
            : `Nhớ lại: ${info.label}`,
        estMinutes: 2,
        isMilestone: false,
        body: explain
          ? explain.body
          : cloze
            ? cloze.body
            : isFlash
              ? `Giải thích ngắn gọn: "${info.keywords[0] ?? info.label}"`
              : cc
                ? choices
                  ? `Không nhìn lại: chọn ${info.keywords.length} từ khóa thuộc phần "${info.label}".`
                  : `Không nhìn lại: nhớ 2–3 từ khóa chính của phần "${info.label}". Không cần viết cả câu.`
                : `Không nhìn lại: ý chính của phần "${info.label}" là gì? Viết 1 câu.`,
        answer: explain
          ? explain.answer
          : cloze
            ? cloze.answer
            : cc && !isFlash
            ? `Từ khóa: ${info.keywords.length ? info.keywords.join(", ") : info.label}\n\nÝ chính: ${shorten(info.keySentence)}`
            : info.keySentence,
        keywords: info.keywords,
        difficulty: info.difficulty,
        reason:
          `Ôn ngay sau khi đọc "${info.label}" · câu chính chọn bằng TextRank (điểm ${info.keyScore.toFixed(2)}) · ` +
          `từ khóa: ${kw}`,
        chunkIndex: i,
        ...(choices ? { options: choices.options, correct: choices.correct } : {}),
      });
    }
    tasks[tasks.length - 1].isMilestone = true;

    totalTasks += tasks.length;
    totalMinutes += tasks.reduce((s, t) => s + t.estMinutes, 0);
    modules.push({
      title,
      reason: reasons[m],
      ...(chapter !== undefined ? { chapter, optional: /^appendix\b/i.test(chapter) } : {}),
      tasks,
    });
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