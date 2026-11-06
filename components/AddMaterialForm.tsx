"use client";

import { useState } from "react";
import { addLink, addNote, addPdf, MAX_PDF_BYTES, normalizeUrl, parseTags } from "@/lib/materials";

type Kind = "note" | "link" | "pdf";

const KINDS: { key: Kind; label: string }[] = [
  { key: "note", label: "Ghi chú" },
  { key: "link", label: "Link" },
  { key: "pdf", label: "PDF" },
];

const inputCls = "w-full rounded border border-neutral-300 px-3 py-2";

export default function AddMaterialForm() {
  const [kind, setKind] = useState<Kind>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  function reset() {
    setTitle("");
    setContent("");
    setUrl("");
    setFile(null);
    setTags("");
    setFileKey((k) => k + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const tagList = parseTags(tags);
    setBusy(true);
    try {
      if (kind === "note") {
        if (!title.trim()) return setError("Nhập tiêu đề ghi chú.");
        await addNote(title.trim(), content.trim(), tagList);
      } else if (kind === "link") {
        const clean = normalizeUrl(url);
        if (!clean) return setError("Link không hợp lệ (chỉ nhận http/https).");
        await addLink(title.trim() || clean, clean, tagList);
      } else {
        if (!file) return setError("Chọn một file PDF.");
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) return setError("Chỉ nhận file PDF.");
        if (file.size > MAX_PDF_BYTES) return setError("File quá lớn (tối đa 20MB).");
        await addPdf(title.trim() || file.name.replace(/\.pdf$/i, ""), file, tagList);
      }
      reset();
    } catch {
      setError("Không lưu được. Thử lại hoặc kiểm tra dung lượng trình duyệt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-2 rounded border border-neutral-200 bg-white p-3">
      <div className="flex gap-1">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => {
              setKind(k.key);
              setError("");
            }}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              kind === k.key ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === "note" ? "Tiêu đề" : "Tiêu đề (không bắt buộc)"}
        className={inputCls}
      />

      {kind === "note" && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung"
          rows={5}
          className={inputCls}
        />
      )}
      {kind === "link" && (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputCls} />
      )}
      {kind === "pdf" && (
        <input
          key={fileKey}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      )}

      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tag, cách nhau bằng dấu phẩy (vd: sql, data)"
        className={inputCls}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Đang lưu..." : "Thêm"}
      </button>
    </form>
  );
}