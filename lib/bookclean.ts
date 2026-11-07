export const DEFAULT_WPM = 200;
export const GUESS_BLOCK_PAGES = 10;
export type ChapterKind = "front" | "chapter" | "appendix" | "back";
export interface OutlineEntry { title: string; level: number; pageIndex: number }
export interface Chapter {
  id: number; title: string; startPage: number; endPage: number; sections: number;
  words: number; minutes: number; kind: ChapterKind; defaultOn: boolean; guessed: boolean;
}
const FOOTER_RES = [/^\d{1,4}\s*[|·•]\s*.{3,80}$/, /^.{3,80}\s*[|·•]\s*\d{1,4}$/];
const EDGE_LINES = 4;
export function stripFurniture(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const idx = lines.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const drop = new Set<number>();
  for (const side of ["tail", "head"] as const) {
    const avail = idx.filter((i) => !drop.has(i));
    for (let k = 1; k <= Math.min(EDGE_LINES, avail.length); k++) {
      const part = side === "tail" ? avail.slice(-k) : avail.slice(0, k);
      const joined = part.map((i) => lines[i]).join(" ");
      if (FOOTER_RES.some((r) => r.test(joined))) {
        part.forEach((i) => drop.add(i));
        break;
      }
    }
  }
  return lines.filter((_, i) => !drop.has(i)).join("\n");
}
export function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length; }
export function readMinutes(words: number, wpm = DEFAULT_WPM): number { return words <= 0 ? 0 : Math.max(1, Math.ceil(words / wpm)); }
export function classifyTitle(title: string): ChapterKind {
  const t = title.trim();
  if (/^(copyright|table of contents|contents|foreword|preface|acknowledg|dedication)/i.test(t)) return "front";
  if (/^(index|about the author|colophon)/i.test(t)) return "back";
  if (/^appendix/i.test(t)) return "appendix";
  return "chapter";
}
export function buildChapters(outline: OutlineEntry[], pages: string[], wpm = DEFAULT_WPM): Chapter[] {
  const n = pages.length;
  const valid = outline.filter((o) => o.title.trim() && o.pageIndex >= 0 && o.pageIndex < n);
  const tops = valid.filter((o) => o.level === 0);
  const textOf = (a: number, b: number) => pages.slice(a, b + 1).join("\n");
  if (tops.length === 0) {
    const out: Chapter[] = [];
    for (let a = 0; a < n; a += GUESS_BLOCK_PAGES) {
      const b = Math.min(n - 1, a + GUESS_BLOCK_PAGES - 1);
      const words = wordCount(textOf(a, b));
      out.push({ id: out.length, title: `Trang ${a + 1}–${b + 1}`, startPage: a, endPage: b, sections: 0, words, minutes: readMinutes(words, wpm), kind: "chapter", defaultOn: true, guessed: true });
    }
    return out;
  }
  const chapters: Chapter[] = [];
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i];
    const next = tops[i + 1];
    const start = top.pageIndex;
    const end = next ? Math.max(start, next.pageIndex - 1) : n - 1;
    const from = valid.indexOf(top);
    const to = next ? valid.indexOf(next) : valid.length;
    const sections = valid.slice(from + 1, to).filter((o) => o.level > 0).length;
    const words = wordCount(textOf(start, end));
    const kind = classifyTitle(top.title);
    chapters.push({ id: chapters.length, title: top.title.trim(), startPage: start, endPage: end, sections, words, minutes: readMinutes(words, wpm), kind, defaultOn: kind === "chapter", guessed: false });
  }
  return chapters;
}
export function sumChapters(chapters: Chapter[], wpm = DEFAULT_WPM, onlyDefaultOn = false) {
  const picked = onlyDefaultOn ? chapters.filter((c) => c.defaultOn) : chapters;
  const words = picked.reduce((s, c) => s + c.words, 0);
  return { chapters: picked.length, words, minutes: readMinutes(words, wpm) };
}