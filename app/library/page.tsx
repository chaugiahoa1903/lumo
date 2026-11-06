"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Material, type MaterialType } from "@/lib/db";
import { deleteMaterial, loadDemos } from "@/lib/materials";
import AddMaterialForm from "@/components/AddMaterialForm";

const TYPE_LABEL: Record<MaterialType, string> = { note: "Ghi chú", link: "Link", pdf: "PDF" };
const TYPE_FILTERS: { key: "all" | MaterialType; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "note", label: "Ghi chú" },
  { key: "link", label: "Link" },
  { key: "pdf", label: "PDF" },
];

function openPdf(m: Material) {
  if (!m.blob) return;
  const objectUrl = URL.createObjectURL(m.blob);
  window.open(objectUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export default function LibraryPage() {
  const materials = useLiveQuery(() => db.materials.orderBy("createdAt").reverse().toArray(), []);
  const [typeFilter, setTypeFilter] = useState<"all" | MaterialType>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    materials?.forEach((m) => m.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [materials]);

  const visible = useMemo(
    () =>
      (materials ?? []).filter(
        (m) => (typeFilter === "all" || m.type === typeFilter) && (!tagFilter || m.tags.includes(tagFilter))
      ),
    [materials, typeFilter, tagFilter]
  );

  const hasDemo = (materials ?? []).some((m) => m.isDemo);

  async function onLoadDemos() {
    setDemoMsg("");
    try {
      const n = await loadDemos();
      setDemoMsg(n > 0 ? `Đã nạp ${n} tài liệu mẫu.` : "Tài liệu mẫu đã có sẵn.");
    } catch {
      setDemoMsg("Không nạp được tài liệu mẫu.");
    }
  }

  async function onDelete(m: Material) {
    if (confirm(`Xóa "${m.title}"?`)) await deleteMaterial(m.id);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Thư viện</h1>

      <AddMaterialForm />

      {!hasDemo && (
        <div className="mb-4">
          <button onClick={onLoadDemos} className="rounded border border-indigo-600 px-3 py-1.5 text-sm text-indigo-600">
            Nạp tài liệu mẫu
          </button>
        </div>
      )}
      {demoMsg && <p className="mb-4 text-sm text-neutral-600">{demoMsg}</p>}

      <div className="mb-2 flex flex-wrap gap-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              typeFilter === f.key ? "bg-indigo-600 text-white" : "bg-neutral-200 text-neutral-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                tagFilter === t ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-neutral-300 text-neutral-600"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {materials === undefined ? (
        <p className="text-neutral-500">Đang tải...</p>
      ) : visible.length === 0 ? (
        <p className="text-neutral-500">{materials.length === 0 ? "Chưa có tài liệu nào." : "Không có tài liệu khớp bộ lọc."}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => (
            <li key={m.id} className="rounded border border-neutral-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{m.title}</p>
                <button onClick={() => onDelete(m)} className="text-xs text-red-600">
                  Xóa
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                {TYPE_LABEL[m.type]}
                {m.isDemo && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Tài liệu mẫu</span>}
              </p>
              {m.type === "note" && m.content && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{m.content}</p>
              )}
              {m.type === "link" && m.url && (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate text-sm text-indigo-600 underline"
                >
                  {m.url}
                </a>
              )}
              {m.type === "pdf" && (
                <button onClick={() => openPdf(m)} className="mt-1 text-sm text-indigo-600 underline">
                  Mở PDF
                </button>
              )}
              {m.tags.length > 0 && (
                <p className="mt-1 text-xs text-neutral-500">{m.tags.map((t) => `#${t}`).join(" ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}