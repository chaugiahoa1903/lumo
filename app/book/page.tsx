"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { addNote } from "@/lib/materials";
import { DEFAULT_WPM, sumChapters, type ChapterKind } from "@/lib/bookclean";
import { convertPdf, scanPdf, type BookScan } from "@/lib/pdfbook";
import { btnCls, PageHeader, Panel } from "@/components/ui";

const KIND_LABEL: Record<ChapterKind, string> = {
  front: "Đầu sách",
  chapter: "Chương",
  appendix: "Phụ lục",
  back: "Cuối sách",
};

export default function BookPage() {
  const pdfs = useLiveQuery(
    async () =>
      (await db.materials.where("type").equals("pdf").toArray()).map((m) => ({ id: m.id, title: m.title, tags: m.tags })),
    [],
  );
  const [pdfId, setPdfId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [scan, setScan] = useState<BookScan | null>(null);
  const [preview, setPreview] = useState(1);
  const [made, setMade] = useState<string>("");

  const selected = pdfId ?? pdfs?.[0]?.id ?? null;

  async function run(id: number) {
    setBusy(true);
    setError("");
    setScan(null);
    setMade("");
    setProgress("Đang đọc...");
    try {
      const m = await db.materials.get(id);
      if (!m?.blob) throw new Error("Không tìm thấy file PDF trong Thư viện.");
      const t0 = performance.now();
      const result = await scanPdf(m.blob, (d, t) => setProgress(`Đang đọc trang ${d}/${t}`));
      setScan(result);
      setProgress(`Xong trong ${Math.round(performance.now() - t0)} ms`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function toNote(id: number) {
    setBusy(true);
    setError("");
    setMade("");
    setProgress("Đang đọc...");
    try {
      const m = await db.materials.get(id);
      if (!m?.blob) throw new Error("Không tìm thấy file PDF trong Thư viện.");
      const r = await convertPdf(m.blob, (d, t) => setProgress(`Đang đọc trang ${d}/${t}`));
      if (r.stats.words < 50) throw new Error("PDF gần như không có chữ (có thể là bản scan), không chuyển được.");
      const tags = Array.from(new Set([...m.tags, "từ-pdf"]));
      await db.materials.update(id, { content: r.markdown });
      setMade(
        `Đã chuyển "${m.title}" sang văn bản, từ trang ${r.firstPage}–${r.lastPage}: ${r.stats.headings} tiêu đề, ${r.stats.codeBlocks} khối code, ${r.stats.words.toLocaleString("vi-VN")} từ.`,
      );
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  const all = scan ? sumChapters(scan.chapters) : null;
  const core = scan ? sumChapters(scan.chapters, DEFAULT_WPM, true) : null;

  return (
    <div>
      <PageHeader title="Sách → Lộ trình" subtitle="Chuyển PDF thành ghi chú markdown để Luna chia việc." />

      <Panel title="Chọn sách">
        {pdfs === undefined ? (
          <p>Đang tải...</p>
        ) : pdfs.length === 0 ? (
          <p>Chưa có PDF nào. Thêm PDF trong Thư viện trước.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm"
              value={selected ?? ""}
              onChange={(e) => setPdfId(Number(e.target.value))}
            >
              {pdfs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button className={btnCls("primary")} disabled={busy || selected === null} onClick={() => selected !== null && toNote(selected)}>
              {busy ? "Đang xử lý..." : "Chuyển thành ghi chú"}
            </button>
            <button className={btnCls("ghost")} disabled={busy || selected === null} onClick={() => selected !== null && run(selected)}>
              Xem mục lục
            </button>
            <span className="text-sm text-neutral-600">{progress}</span>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-700">Lỗi: {error}</p>}
        {made && (
          <div className="mt-4">
            <p className="mb-3 text-sm">{made}</p>
            <Link href="/library" className={btnCls("primary")}>
              Về Thư viện để bấm Chia việc
            </Link>
          </div>
        )}
      </Panel>

      {scan && all && core && (
        <div className="mt-6 space-y-6">
          <Panel title="Mục lục" hint={`${scan.pageCount} trang`}>
            <p className="mb-2 text-sm">
              {scan.hasOutline
                ? "Có mục lục (bookmark) trong PDF."
                : "PDF không có mục lục: Luna chia tạm theo khối 10 trang (đoán, không phải chương thật)."}
            </p>
            <p className="mb-4 text-sm text-neutral-700">
              Toàn bộ: {all.words.toLocaleString("vi-VN")} từ, khoảng {all.minutes} phút đọc. Chỉ các mục loại "Chương":{" "}
              {core.chapters} mục, {core.words.toLocaleString("vi-VN")} từ, khoảng {core.minutes} phút. Tốc độ giả định{" "}
              {DEFAULT_WPM} từ/phút.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="py-2 pr-3">Mục</th>
                    <th className="py-2 pr-3">Loại</th>
                    <th className="py-2 pr-3">Trang PDF</th>
                    <th className="py-2 pr-3">Mục con</th>
                    <th className="py-2 pr-3 text-right">Từ</th>
                    <th className="py-2 text-right">Phút</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.chapters.map((c) => (
                    <tr key={c.id} className={`border-b border-neutral-300 ${c.defaultOn ? "" : "text-neutral-500"}`}>
                      <td className="py-2 pr-3 font-semibold">{c.title}</td>
                      <td className="py-2 pr-3">{c.guessed ? "Đoán" : KIND_LABEL[c.kind]}</td>
                      <td className="py-2 pr-3">
                        {c.startPage + 1}–{c.endPage + 1}
                      </td>
                      <td className="py-2 pr-3">{c.sections}</td>
                      <td className="py-2 pr-3 text-right">{c.words.toLocaleString("vi-VN")}</td>
                      <td className="py-2 text-right">{c.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Xem thử văn bản thô đã lọc" hint="Kiểm tra chân trang đã bị bỏ chưa">
            <label className="mb-3 flex items-center gap-2 text-sm">
              Trang PDF
              <input
                type="number"
                min={1}
                max={scan.pageCount}
                value={preview}
                onChange={(e) => setPreview(Math.min(scan.pageCount, Math.max(1, Number(e.target.value) || 1)))}
                className="w-24 rounded-lg border-2 border-ink px-2 py-1"
              />
            </label>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-xs">
              {scan.pages[preview - 1] ?? ""}
            </pre>
          </Panel>
        </div>
      )}
    </div>
  );
}