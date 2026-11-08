import { db } from "./db";
import { SETTINGS_KEY } from "./settings";

// Sao lưu/khôi phục toàn bộ dữ liệu Lumo bằng một file JSON. Dữ liệu chỉ đi qua máy người dùng, không gửi đi đâu.
export const BACKUP_KEY = "lumo.lastBackupAt.v1";
const SCHEMA = 1;
const NAMES = ["materials", "courses", "modules", "tasks", "sessions", "events", "reviews"] as const;

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export async function buildBackup(includePdf: boolean): Promise<{ json: string; bytes: number }> {
  const tables: Record<string, unknown[]> = {};
  for (const name of NAMES) {
    const rows = (await db.table(name).toArray()) as Record<string, unknown>[];
    if (name === "materials") {
      const out: unknown[] = [];
      for (const row of rows) {
        const { blob, ...rest } = row as { blob?: Blob } & Record<string, unknown>;
        if (blob && includePdf) out.push({ ...rest, __blob: { type: blob.type, b64: await blobToBase64(blob) } });
        else out.push(rest);
      }
      tables[name] = out;
    } else {
      tables[name] = rows;
    }
  }
  let settings: unknown = null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    settings = raw ? JSON.parse(raw) : null;
  } catch {
    settings = null;
  }
  const json = JSON.stringify({ app: "lumo", schemaVersion: SCHEMA, exportedAt: Date.now(), includesPdf: includePdf, settings, tables });
  return { json, bytes: new Blob([json]).size };
}

export function markBackupDone() {
  try {
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
  } catch {
    /* bỏ qua */
  }
}

export function lastBackupAt(): number | null {
  try {
    const v = Number(localStorage.getItem(BACKUP_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}

export interface ImportResult {
  counts: Record<string, number>;
  settings: Record<string, unknown> | null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Kiểm tra kỹ trước, chỉ ghi khi toàn bộ file hợp lệ. Chế độ duy nhất: thay thế toàn bộ dữ liệu hiện có.
export async function importBackup(text: string): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File không phải JSON hợp lệ.");
  }
  if (!isObj(data) || data.app !== "lumo") throw new Error("Đây không phải file sao lưu của Lumo.");
  if (data.schemaVersion !== SCHEMA) throw new Error("Phiên bản file sao lưu không được hỗ trợ.");
  if (!isObj(data.tables)) throw new Error("File thiếu dữ liệu các bảng.");
  const tables = data.tables;
  const prepared: Record<string, Record<string, unknown>[]> = {};
  for (const name of NAMES) {
    const rows = tables[name];
    if (!Array.isArray(rows)) throw new Error(`File thiếu bảng "${name}".`);
    const key = name === "reviews" ? "taskId" : "id";
    const out: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (!isObj(row) || typeof row[key] !== "number") throw new Error(`Bảng "${name}" có dòng không hợp lệ.`);
      if (name === "materials" && isObj(row.__blob)) {
        const { __blob, ...rest } = row as { __blob: { type?: unknown; b64?: unknown } } & Record<string, unknown>;
        const type = typeof __blob.type === "string" ? __blob.type : "application/pdf";
        const b64 = typeof __blob.b64 === "string" ? __blob.b64 : "";
        const blob = await (await fetch(`data:${type};base64,${b64}`)).blob();
        out.push({ ...rest, blob });
      } else {
        out.push(row);
      }
    }
    prepared[name] = out;
  }
  await db.transaction("rw", db.tables, async () => {
    for (const name of NAMES) {
      await db.table(name).clear();
      await db.table(name).bulkPut(prepared[name]);
    }
  });
  const counts: Record<string, number> = {};
  for (const name of NAMES) counts[name] = prepared[name].length;
  return { counts, settings: isObj(data.settings) ? data.settings : null };
}