import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { buildChapters, stripFurniture, type Chapter, type OutlineEntry } from "./bookclean";
import { convertToMarkdown, type ConvertStats, type RawItem, type RawPage } from "./pdf2md";

// Chỉ chạy trong trình duyệt. File worker nằm ở public/pdf.worker.min.mjs (copy từ node_modules/pdfjs-dist/build).
// Khi nâng cấp pdfjs-dist, copy lại file worker cho khớp phiên bản.

interface OutlineNode {
  title: string;
  dest: unknown;
  items?: OutlineNode[];
}

export interface BookScan {
  pageCount: number;
  hasOutline: boolean;
  chapters: Chapter[];
  pages: string[]; // văn bản từng trang, đã lọc chân trang
}

export interface PdfConversion {
  markdown: string;
  stats: ConvertStats;
  pageCount: number;
  firstPage: number; // 1-based
  lastPage: number; // 1-based
  hasOutline: boolean;
}

interface Loaded {
  pageCount: number;
  texts: string[];
  raws: RawPage[];
  outline: OutlineEntry[];
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

async function readPage(page: PDFPageProxy): Promise<{ text: string; raw: RawPage }> {
  const content = await page.getTextContent();
  const [, y0, , y1] = page.view;
  let text = "";
  const items: RawItem[] = [];
  for (const it of content.items) {
    if (!("str" in it)) continue;
    text += it.str;
    if (it.hasEOL) text += "\n";
    items.push({
      str: it.str,
      family: content.styles[it.fontName]?.fontFamily ?? "serif",
      h: it.height,
      x: it.transform[4],
      y: it.transform[5] - y0,
      w: it.width,
    });
  }
  return { text, raw: { height: y1 - y0, items } };
}

async function pageIndexOf(doc: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    const d = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(d) || d.length === 0) return null;
    const ref = d[0];
    if (typeof ref === "number") return ref;
    return await doc.getPageIndex(ref);
  } catch {
    return null;
  }
}

async function readOutline(doc: PDFDocumentProxy): Promise<OutlineEntry[]> {
  const raw = (await doc.getOutline()) as unknown as OutlineNode[] | null;
  const out: OutlineEntry[] = [];
  async function walk(nodes: OutlineNode[], level: number) {
    for (const n of nodes) {
      const idx = await pageIndexOf(doc, n.dest);
      if (idx !== null) out.push({ title: (n.title ?? "").trim(), level, pageIndex: idx });
      if (n.items && n.items.length > 0) await walk(n.items, level + 1);
    }
  }
  if (raw) await walk(raw, 0);
  return out;
}

async function loadAll(blob: Blob, onProgress?: (done: number, total: number) => void): Promise<Loaded> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const texts: string[] = [];
    const raws: RawPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const { text, raw } = await readPage(page);
      texts.push(text);
      raws.push(raw);
      page.cleanup();
      onProgress?.(i, doc.numPages);
    }
    return { pageCount: doc.numPages, texts, raws, outline: await readOutline(doc) };
  } finally {
    await loadingTask.destroy();
  }
}

export async function scanPdf(blob: Blob, onProgress?: (done: number, total: number) => void): Promise<BookScan> {
  const l = await loadAll(blob, onProgress);
  const pages = l.texts.map(stripFurniture);
  return {
    pageCount: l.pageCount,
    hasOutline: l.outline.some((o) => o.level === 0 && o.title.trim() !== ""),
    chapters: buildChapters(l.outline, pages),
    pages,
  };
}

// PDF -> markdown. Bỏ đầu sách (Copyright, Mục lục, Lời tựa...) và cuối sách (Index...) nếu có mục lục.
export async function convertPdf(blob: Blob, onProgress?: (done: number, total: number) => void): Promise<PdfConversion> {
  const l = await loadAll(blob, onProgress);
  const chapters = buildChapters(l.outline, l.texts.map(stripFurniture));
  const body = chapters.filter((c) => c.kind === "chapter" || c.kind === "appendix");
  const start = body.length ? Math.min(...body.map((c) => c.startPage)) : 0;
  const end = body.length ? Math.max(...body.map((c) => c.endPage)) : l.pageCount - 1;
  const r = convertToMarkdown(l.raws.slice(start, end + 1));
  return {
    markdown: r.markdown,
    stats: r.stats,
    pageCount: l.pageCount,
    firstPage: start + 1,
    lastPage: end + 1,
    hasOutline: l.outline.some((o) => o.level === 0 && o.title.trim() !== ""),
  };
}