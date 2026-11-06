import { fold } from "./text";
import { tokenize, toTerms } from "./splitter";

// Bộ sinh câu hỏi ôn tập bằng quy tắc (không dùng LLM): trắc nghiệm, xếp từ, gõ thuật ngữ, tự đánh giá.

export interface Card {
  taskId: number;
  title: string;
  keywords: string[];
  answer: string; // câu chính (TextRank)
  context: string; // đoạn tài liệu chứa câu chính (nội dung task đọc gần nhất phía trước)
}

interface Base {
  taskId: number;
  title: string;
  full: string;
}

export type Question =
  | (Base & {
      kind: "choice";
      family: "upper" | "topic";
      prompt: string;
      options: string[];
      correct: number;
      answerText: string;
    })
  | (Base & { kind: "reorder"; before: string; after: string; words: string[]; target: string[] })
  | (Base & { kind: "type"; prompt: string; answerText: string })
  | (Base & { kind: "recall"; prompt: string });

export const BLANK = "_____";
export const REORDER_MAX_WHOLE = 7; // câu từ chừng này từ trở xuống thì xếp cả câu
export const REORDER_WINDOW = 6; // câu dài hơn thì chỉ xếp đoạn chừng này từ

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function kwRegex(kw: string, flags: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc(kw)}(?![\\p{L}\\p{N}])`, flags);
}

// Từ khóa viết hoa (SQL: SELECT, COUNT, GROUP BY...). Cụm nhiều từ chỉ nối bằng dấu cách trong cùng một dòng.
const UPPER_RE = /(?<![\p{L}\p{N}_])\p{Lu}[\p{Lu}\p{N}_]+(?:[ \t]+\p{Lu}[\p{Lu}\p{N}_]+)*(?![\p{L}\p{N}_])/gu;

function upperList(text: string): string[] {
  return (text.normalize("NFC").match(UPPER_RE) ?? []).map((m) => m.replace(/[ \t]+/g, " "));
}

function countMap(list: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function termCounts(text: string): Map<string, number> {
  return countMap(toTerms(tokenize(text)));
}

function rankMap(m: Map<string, number>, rnd: () => number): string[] {
  return [...m.entries()]
    .map(([t, c]) => ({ t, c, r: rnd() }))
    .sort((a, b) => b.c - a.c || a.r - b.r)
    .map((x) => x.t);
}

interface Blank {
  text: string;
  prompt: string;
  kind: "upper" | "topic";
}

function topicBlank(card: Card, s: string): Blank | null {
  const tryKw = (kw: string): Blank | null => {
    const k = kw.trim();
    if (k.length < 3 || k.length > 30) return null;
    const m = kwRegex(k, "iu").exec(s);
    if (!m) return null;
    return { text: m[0], prompt: s.replace(kwRegex(k, "giu"), BLANK), kind: "topic" };
  };
  for (const kw of card.keywords) {
    const b = tryKw(kw);
    if (b) return b;
  }
  const longest = (s.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => w.length >= 5)
    .sort((a, b) => b.length - a.length)[0];
  return longest ? tryKw(longest) : null;
}

// Ứng viên chỗ khuyết: ưu tiên từ khóa viết hoa trong câu, sau đó từ khóa thường.
function blankCandidates(card: Card): Blank[] {
  const s = card.answer.normalize("NFC");
  const out: Blank[] = [];
  const seen = new Set<string>();
  for (const u of upperList(s)) {
    const f = fold(u);
    if (seen.has(f) || u.length < 3 || u.length > 24) continue;
    seen.add(f);
    out.push({ text: u, prompt: s.replace(kwRegex(u, "giu"), BLANK), kind: "upper" });
    if (out.length >= 3) break;
  }
  const t = topicBlank(card, s);
  if (t && !seen.has(fold(t.text))) out.push(t);
  return out;
}

// Chỗ khuyết bị lộ nếu đáp án vẫn nằm trong câu hỏi (ví dụ dạng số nhiều).
const leaks = (b: Blank) => fold(b.prompt).includes(fold(b.text));

export function corpusOf(cards: Card[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cards) {
    for (const t of [c.context, c.answer]) {
      const k = t.trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
  }
  return out;
}

function upperDistractors(blank: Blank, card: Card, corpus: string[], rnd: () => number): string[] {
  const tf = fold(blank.text);
  const want = blank.text.split(" ").length;
  const ok = (c: string) => {
    const cf = fold(c);
    return (
      c.length >= 2 &&
      c.length <= 24 &&
      cf !== tf &&
      !tf.includes(cf) &&
      !cf.includes(tf) &&
      !kwRegex(c, "iu").test(card.answer)
    );
  };
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (list: string[], sameLen: boolean) => {
    for (const c of list) {
      if (out.length >= 3) return;
      const cf = fold(c);
      if (seen.has(cf) || !ok(c)) continue;
      if (sameLen && c.split(" ").length !== want) continue;
      seen.add(cf);
      out.push(c);
    }
  };
  const local = rankMap(countMap(upperList(card.context)), rnd);
  const global = rankMap(countMap(upperList(corpus.join("\n"))), rnd);
  add(local, true);
  add(global, true);
  add(local, false);
  add(global, false);
  return out;
}

function topicDistractors(blank: Blank, card: Card, corpus: string[], rnd: () => number): string[] {
  const tf = fold(blank.text);
  const want = tokenize(blank.text).length;
  const ok = (c: string) => {
    const cf = fold(c);
    return (
      c.length >= 3 &&
      c.length <= 24 &&
      cf !== tf &&
      !tf.includes(cf) &&
      !cf.includes(tf) &&
      c.split(" ").length === want &&
      !kwRegex(c, "iu").test(card.answer)
    );
  };
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (list: string[]) => {
    for (const c of list) {
      if (out.length >= 3) return;
      const cf = fold(c);
      if (seen.has(cf) || !ok(c)) continue;
      seen.add(cf);
      out.push(c);
    }
  };
  add(rankMap(termCounts(card.context), rnd));
  add(rankMap(termCounts(corpus.join("\n")), rnd));
  return out;
}

function makeChoice(card: Card, blank: Blank, corpus: string[], rnd: () => number, base: Base): Question | null {
  if (leaks(blank)) return null;
  const ds =
    blank.kind === "upper"
      ? upperDistractors(blank, card, corpus, rnd)
      : topicDistractors(blank, card, corpus, rnd);
  if (ds.length < 3) return null; // không đủ đáp án nhiễu hợp lý thì không ghép bừa
  const answerText = blank.kind === "upper" ? blank.text : blank.text.toLowerCase();
  const options = shuffle([answerText, ...ds.slice(0, 3)], rnd);
  if (new Set(options.map(fold)).size !== options.length) return null;
  return {
    ...base,
    kind: "choice",
    family: blank.kind,
    prompt: blank.prompt,
    options,
    correct: options.indexOf(answerText),
    answerText,
  };
}

// Xếp lại: câu ngắn thì xếp cả câu; câu dài thì chỉ xếp một đoạn quanh từ khóa, phần còn lại làm ngữ cảnh.
function makeReorder(card: Card, rnd: () => number, base: Base): Question | null {
  const s = card.answer.trim();
  if (!s || s.endsWith("…")) return null;
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return null;

  let start = 0;
  let len = tokens.length;
  if (tokens.length > REORDER_MAX_WHOLE) {
    len = REORDER_WINDOW;
    let at = -1;
    for (const kw of card.keywords) {
      const first = fold(kw.split(" ")[0]);
      if (first.length < 3) continue;
      at = tokens.findIndex((t) => fold(t).includes(first));
      if (at >= 0) break;
    }
    if (at < 0) at = Math.floor(tokens.length / 2);
    start = Math.min(Math.max(0, at - 2), tokens.length - len);
  }

  const target = tokens.slice(start, start + len);
  if (new Set(target).size < 3) return null;
  let words = target;
  for (let i = 0; i < 10; i++) {
    words = shuffle(target, rnd);
    if (words.some((w, k) => w !== target[k])) break;
  }
  if (words.every((w, k) => w === target[k])) return null;
  return {
    ...base,
    kind: "reorder",
    before: tokens.slice(0, start).join(" "),
    after: tokens.slice(start + len).join(" "),
    words,
    target,
  };
}

function makeType(blanks: Blank[], base: Base): Question | null {
  const b = blanks.find((x) => !leaks(x) && x.text.length <= 24);
  if (!b) return null;
  return { ...base, kind: "type", prompt: b.prompt, answerText: b.text };
}

export function checkTyped(input: string, answer: string): boolean {
  const a = fold(input.trim());
  return a.length > 0 && a === fold(answer.trim());
}

const ORDER = ["choice", "reorder", "type"] as const;

export function generateQuestions(cards: Card[], corpus: string[], seed = 1): Question[] {
  const rnd = mulberry32(seed);
  return cards.map((card, i) => {
    const base: Base = { taskId: card.taskId, title: card.title, full: card.answer };
    const recall: Question = {
      ...base,
      kind: "recall",
      prompt: `Không nhìn lại: ý chính của phần "${card.title}" là gì?`,
    };
    if (!card.answer.trim()) return recall;
    const blanks = blankCandidates(card);
    for (let k = 0; k < ORDER.length; k++) {
      const kind = ORDER[(i + k) % ORDER.length];
      let q: Question | null = null;
      if (kind === "choice") {
        for (const b of blanks) {
          q = makeChoice(card, b, corpus, rnd, base);
          if (q) break;
        }
      } else if (kind === "reorder") {
        q = makeReorder(card, rnd, base);
      } else {
        q = makeType(blanks, base);
      }
      if (q) return q;
    }
    return recall;
  });
}