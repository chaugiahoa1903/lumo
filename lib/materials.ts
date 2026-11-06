import { db } from "./db";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const t = part.trim().replace(/^#/, "").toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen].slice(0, 10);
}

export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function addNote(title: string, content: string, tags: string[]) {
  return db.materials.add({
    type: "note",
    title,
    content,
    tags,
    isDemo: false,
    createdAt: Date.now(),
  });
}

export async function addLink(title: string, url: string, tags: string[]) {
  return db.materials.add({
    type: "link",
    title,
    url,
    tags,
    isDemo: false,
    createdAt: Date.now(),
  });
}

export async function addPdf(title: string, file: File, tags: string[]) {
  return db.materials.add({
    type: "pdf",
    title,
    blob: new Blob([file], { type: "application/pdf" }),
    tags,
    isDemo: false,
    createdAt: Date.now(),
  });
}

export async function deleteMaterial(id: number) {
  await db.materials.delete(id);
}

const DEMOS = [
  { file: "/demo/sql-co-ban-vi.md", title: "SQL cơ bản (tiếng Việt)", tags: ["sql", "data", "tiếng việt"] },
  { file: "/demo/sql-basics-en.md", title: "SQL basics (English)", tags: ["sql", "data", "english"] },
];

export async function loadDemos(): Promise<number> {
  let added = 0;
  for (const d of DEMOS) {
    const existing = await db.materials.filter((m) => m.isDemo && m.title === d.title).first();
    if (existing) continue;
    const res = await fetch(d.file);
    if (!res.ok) throw new Error(`Không tải được ${d.file}`);
    const content = await res.text();
    await db.materials.add({
      type: "note",
      title: d.title,
      content,
      tags: d.tags,
      isDemo: true,
      createdAt: Date.now(),
    });
    added++;
  }
  return added;
}