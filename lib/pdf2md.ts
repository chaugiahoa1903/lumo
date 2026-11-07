// Chuyển văn bản PDF (lấy từ pdf.js) sang markdown. Phần thuần: không import pdf.js.
// Dựa vào loại font (serif / sans-serif / monospace), cỡ chữ và tọa độ; không đọc tên font thật.
// Quy tắc: tiêu đề = chữ lớn hơn thân bài rõ rệt; code = dòng toàn monospace và nhỏ hơn thân bài;
// ghi chú = chữ hơi nhỏ hơn thân bài; chân/đầu trang = dòng ngắn ở mép trang, không lớn hơn thân bài.

export interface RawItem {
  str: string;
  family: string; // "serif" | "sans-serif" | "monospace" (styles[fontName].fontFamily của pdf.js)
  h: number; // cỡ chữ
  x: number;
  y: number;
  w: number; // độ rộng của đoạn chữ
}

export interface RawPage {
  height: number;
  items: RawItem[];
}

export interface ConvertStats {
  pages: number;
  headings: number;
  codeBlocks: number;
  words: number;
  bodySize: number;
}

export interface ConvertResult {
  markdown: string;
  stats: ConvertStats;
}

interface Line {
  page: number;
  height: number; // chiều cao trang
  plain: string; // không có backtick
  rich: string; // code trong câu được bọc backtick
  h: number;
  x: number;
  y: number;
  mono: boolean; // cả dòng là monospace
  charW: number; // độ rộng một ký tự (dùng tính thụt lề code)
}

type Kind = "foot" | "label" | "head" | "code" | "note" | "li" | "prose";

interface Block {
  kind: "h" | "code" | "note" | "li" | "p";
  rank?: number; // cấp tiêu đề 1..3
  text: string;
  codeLines?: { text: string; x: number; charW: number; gap: boolean }[];
  x: number; // x của dòng đầu (dùng nhận ra dòng tiếp theo của mục danh sách)
}

const LABEL_RE = /^(chapter|part|appendix|section)\s+[0-9a-z]{1,4}$/i;
const BULLET_RE = /^[•▪●◦‣]\s*/;
const SENTENCE_END_RE = /[.!?:;)\]”"'’]$/;
const SOFT_HYPHEN_RE = /[-\u2010\u00ad]$/;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function renderInline(items: RawItem[], wrap: boolean): string {
  const toks = items
    .filter((i) => i.str !== "")
    .map((i) => ({ t: i.str, m: (i.str.trim() === "" ? null : i.family === "monospace") as boolean | null }));
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].m !== null) continue;
    let p = i - 1;
    while (p >= 0 && toks[p].m === null) p--;
    let n = i + 1;
    while (n < toks.length && toks[n].m === null) n++;
    toks[i].m = p >= 0 && n < toks.length && toks[p].m === true && toks[n].m === true;
  }
  let out = "";
  let run = "";
  let runMono = false;
  const flush = () => {
    if (!run) return;
    if (runMono && wrap) {
      const core = run.trim();
      const lead = run.slice(0, run.length - run.trimStart().length);
      const trail = run.slice(run.trimEnd().length);
      out += core ? `${lead}\`${core}\`${trail}` : run;
    } else out += run;
    run = "";
  };
  for (const tk of toks) {
    const m = tk.m === true;
    if (run && m !== runMono) flush();
    runMono = m;
    run += tk.t;
  }
  flush();
  return out;
}

function bodySizeOf(pages: RawPage[]): number {
  const w = new Map<number, number>();
  for (const p of pages) {
    for (const i of p.items) {
      if (i.family === "monospace" || i.h <= 0 || !i.str.trim()) continue;
      const k = round1(i.h);
      w.set(k, (w.get(k) ?? 0) + i.str.length);
    }
  }
  let best = 10;
  let bestW = -1;
  for (const [k, v] of w) {
    if (v > bestW) {
      best = k;
      bestW = v;
    }
  }
  return best;
}

function buildLines(page: RawPage, pageIndex: number): Line[] {
  const groups: RawItem[][] = [];
  for (const it of page.items) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= 1.5) last.push(it);
    else groups.push([it]);
  }
  const lines: Line[] = [];
  for (const g of groups) {
    const real = g.filter((i) => i.str.trim() !== "");
    if (real.length === 0) continue;
    const longest = real.reduce((a, b) => (b.str.length > a.str.length ? b : a));
    const mono = real.every((i) => i.family === "monospace");
    const ratios = real.filter((i) => i.str.length >= 3 && i.w > 0).map((i) => i.w / i.str.length);
    const charW = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : longest.h * 0.5;
    lines.push({
      page: pageIndex,
      height: page.height,
      plain: renderInline(g, false).trim(),
      rich: renderInline(g, true).trim(),
      h: longest.h,
      x: Math.min(...real.map((i) => i.x)),
      y: longest.y,
      mono,
      charW,
    });
  }
  return lines;
}

function classify(l: Line, body: number): Kind {
  const edge = l.y < l.height * 0.09 || l.y > l.height * 0.95;
  if (edge && l.h <= body * 1.05 && l.plain.length <= 90) return "foot";
  if (!l.mono && l.h >= body * 1.25) return LABEL_RE.test(l.plain) ? "label" : "head";
  if (l.mono && l.h <= body * 0.9) return "code";
  if (!l.mono && l.h < body * 0.95 && l.h >= body * 0.8) return "note";
  if (BULLET_RE.test(l.plain)) return "li";
  return "prose";
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function headingRanker(sizes: number[]): (h: number) => number {
  const sorted = [...new Set(sizes.map((s) => Math.round(s * 2) / 2))].sort((a, b) => b - a);
  const cluster: number[] = [];
  let c = 0;
  sorted.forEach((s, i) => {
    if (i > 0 && sorted[i - 1] - s > 1.0) c++;
    cluster.push(c);
  });
  return (h) => {
    const key = Math.round(h * 2) / 2;
    const i = sorted.indexOf(key);
    return Math.min(3, (i >= 0 ? cluster[i] : sorted.length) + 1);
  };
}

function appendText(prev: string, next: string): string {
  if (SOFT_HYPHEN_RE.test(prev) && /^[a-z]/.test(next)) return prev.slice(0, -1) + next;
  return prev + " " + next;
}

export function convertToMarkdown(pages: RawPage[]): ConvertResult {
  const body = bodySizeOf(pages);
  const all: { line: Line; kind: Kind }[] = [];
  pages.forEach((p, pi) => {
    for (const line of buildLines(p, pi)) {
      const kind = classify(line, body);
      if (kind !== "foot") all.push({ line, kind });
    }
  });

  const rank = headingRanker(all.filter((a) => a.kind === "head").map((a) => a.line.h));
  const blocks: Block[] = [];
  let pendingLabel: string | null = null;
  let prev: { line: Line; kind: Kind } | null = null;

  for (const cur of all) {
    const { line: l, kind } = cur;
    const samePage = prev !== null && prev.line.page === l.page;
    const dy = prev && samePage ? prev.line.y - l.y : Infinity;
    const last = blocks[blocks.length - 1];

    if (kind === "label") {
      pendingLabel = titleCase(l.plain);
      prev = cur;
      continue;
    }

    if (kind === "head") {
      const r = rank(l.h);
      if (last && last.kind === "h" && last.rank === r && prev?.kind === "head" && samePage && dy <= 1.7 * l.h) {
        last.text += " " + l.plain;
      } else {
        const text = pendingLabel ? `${pendingLabel}. ${l.plain}` : l.plain;
        pendingLabel = null;
        blocks.push({ kind: "h", rank: r, text, x: l.x });
      }
    } else if (kind === "code") {
      const cont = last && last.kind === "code" && prev?.kind === "code" && (!samePage || dy <= 4 * l.h);
      const entry = { text: l.plain, x: l.x, charW: l.charW, gap: samePage && dy > 1.8 * l.h };
      if (cont && last.codeLines) last.codeLines.push(entry);
      else blocks.push({ kind: "code", text: "", codeLines: [{ ...entry, gap: false }], x: l.x });
    } else if (kind === "note") {
      const cont = last && last.kind === "note" && prev?.kind === "note" && samePage && dy <= 1.5 * l.h;
      if (cont) last.text = appendText(last.text, l.rich);
      else blocks.push({ kind: "note", text: l.rich, x: l.x });
    } else if (kind === "li") {
      blocks.push({ kind: "li", text: l.rich.replace(BULLET_RE, ""), x: l.x });
    } else {
      // prose
      let cont = false;
      if (last && prev && (prev.kind === "prose" || prev.kind === "li")) {
        if (last.kind === "p") {
          cont = samePage ? dy <= 1.5 * l.h : !SENTENCE_END_RE.test(last.text) && /^[a-z(`]/.test(l.rich);
        } else if (last.kind === "li") {
          cont = samePage && dy <= 1.5 * l.h && l.x >= last.x + 3;
        }
      }
      if (cont && last) last.text = appendText(last.text, l.rich);
      else blocks.push({ kind: "p", text: l.rich, x: l.x });
    }
    prev = cur;
  }

  const parts: string[] = [];
  let codeBlocks = 0;
  let headings = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let s = "";
    if (b.kind === "h") {
      headings++;
      s = "#".repeat(b.rank ?? 1) + " " + b.text.replace(/\s+/g, " ").trim();
    } else if (b.kind === "code" && b.codeLines) {
      codeBlocks++;
      const baseX = Math.min(...b.codeLines.map((c) => c.x));
      const rows: string[] = [];
      for (const c of b.codeLines) {
        if (c.gap) rows.push("");
        const indent = Math.max(0, Math.round((c.x - baseX) / (c.charW || 4)));
        rows.push(" ".repeat(indent) + c.text.trimEnd());
      }
      s = "```\n" + rows.join("\n") + "\n```";
    } else if (b.kind === "note") {
      s = "> " + b.text.replace(/\s+/g, " ").trim();
    } else if (b.kind === "li") {
      s = "- " + b.text.replace(/\s+/g, " ").trim();
    } else {
      s = b.text.replace(/\s+/g, " ").trim();
    }
    if (!s) continue;
    const joinList = b.kind === "li" && i > 0 && blocks[i - 1].kind === "li" && parts.length > 0;
    if (joinList) parts[parts.length - 1] += "\n" + s;
    else parts.push(s);
  }

  const markdown = parts.join("\n\n") + "\n";
  return {
    markdown,
    stats: {
      pages: pages.length,
      headings,
      codeBlocks,
      words: markdown.split(/\s+/).filter(Boolean).length,
      bodySize: body,
    },
  };
}