"use client";

import { useRef, useState } from "react";
import { addLink, addNote, addPdf, MAX_PDF_BYTES, normalizeUrl, parseTags } from "@/lib/materials";
import { useToast } from "@/components/Toast";
import { Button, inputCls } from "@/components/ui";

type Kind = "note" | "link" | "pdf";

const KINDS: { key: Kind; label: string }[] = [
  { key: "note", label: "Ghi chú" },
  { key: "link", label: "Link" },
  { key: "pdf", label: "PDF" },
];

export default function AddMaterialForm() {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setContent("");
    setUrl("");
    setFile(null);
    setTags("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickFile(f: File | null) {
    setError("");
    if (!f) {
      setFile(null);
      return;
    }
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Chỉ nhận file PDF.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError("File quá lớn (tối đa 20MB).");
      return;
    }
    setKind("pdf");
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const tagList = parseTags(tags);
    setBusy(true);
    try {
      let name = "";
      if (kind === "note") {
        if (!title.trim()) return setError("Nhập tiêu đề ghi chú.");
        name = title.trim();
        await addNote(name, content.trim(), tagList);
      } else if (kind === "link") {
        const clean = normalizeUrl(url);
        if (!clean) return setError("Link không hợp lệ (chỉ nhận http/https).");
        name = title.trim() || clean;
        await addLink(name, clean, tagList);
      } else {
        if (!file) return setError("Chọn một file PDF.");
        name = title.trim() || file.name.replace(/\.pdf$/i, "");
        await addPdf(name, file, tagList);
      }
      reset();
      toast(`Đã thêm "${name}".`);
    } catch {
      setError("Không lưu được. Thử lại hoặc kiểm tra dung lượng trình duyệt.");
    } finally {
      setBusy(false);
    }
  }

  const kindIndex = KINDS.findIndex((k) => k.key === kind);

  return (
    <form
      onSubmit={submit}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(false);
        pickFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={`space-y-3 rounded-lg transition-colors ${dragging ? "bg-sky/40" : ""}`}
    >
      <div className="relative grid grid-cols-3 rounded-full border-2 border-ink bg-white p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-cobalt transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${kindIndex * 100}%)` }}
        />
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => {
              setKind(k.key);
              setError("");
            }}
            className={`relative z-10 rounded-full py-1.5 text-sm font-semibold transition-colors ${
              kind === k.key ? "text-white" : "text-ink"
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
        aria-label="Tiêu đề"
        className={inputCls}
      />

      {kind === "note" && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung"
          aria-label="Nội dung"
          rows={6}
          className={inputCls}
        />
      )}
      {kind === "link" && (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          aria-label="Địa chỉ link"
          className={inputCls}
        />
      )}
      {kind === "pdf" && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-ink px-4 py-6 text-sm transition-colors ${
              dragging ? "bg-sky" : "bg-white hover:bg-sky/40"
            }`}
          >
            <span className="font-display text-lg uppercase">{file ? file.name : "Kéo thả PDF vào đây"}</span>
            <span className="text-neutral-600">
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · bấm để đổi file` : "hoặc bấm để chọn file (tối đa 20MB)"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </>
      )}

      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tag, cách nhau bằng dấu phẩy (vd: sql, data)"
        aria-label="Tag"
        className={inputCls}
      />

      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

      <Button type="submit" disabled={busy}>
        {busy ? "Đang lưu..." : "Thêm vào thư viện"}
      </Button>
      <p className="text-xs text-neutral-500">Mẹo: kéo thả file PDF vào khung này cũng được.</p>
    </form>
  );
}