"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Material, type MaterialType } from "@/lib/db";
import { deleteMaterial, loadDemos } from "@/lib/materials";
import AddMaterialForm from "@/components/AddMaterialForm";
import { Button, PageHeader } from "@/components/ui";

const TYPE_LABEL: Record<MaterialType, string> = { note: "Ghi chú", link: "Link", pdf: "PDF" };
const BADGE: Record<MaterialType, string> = {
  note: "bg-sky text-ink",
  link: "bg-amber-retro text-ink",
  pdf: "bg-navy text-white",
};
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

const chip = (active: boolean) =>
  `rounded-full border-2 border-ink px-3 py-1 text-xs font-semibold transition-colors ${
    active ? "bg-ink text-white" : "bg-white text-ink hover:bg-sky/40"
  }`;

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
      <PageHeader
        title="Thư viện"
        subtitle="Lưu tài liệu của bạn, Luna sẽ chia chúng thành các bước nhỏ."
        action={
          !hasDemo ? (
            <Button variant="amber" onClick={onLoadDemos}>
              Nạp tài liệu mẫu
            </Button>
          ) : undefined
        }
      />
      {demoMsg && <p className="-mt-4 mb-6 text-sm text-neutral-600">{demoMsg}</p>}

      <div className="grid items-start gap-8 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-6">
          <AddMaterialForm />
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            {TYPE_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)} className={chip(typeFilter === f.key)}>
                {f.label}
              </button>
            ))}
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={`rounded-full border-2 px-2.5 py-1 text-xs transition-colors ${
                  tagFilter === t
                    ? "border-ink bg-amber-retro text-ink"
                    : "border-slate-blue bg-white text-neutral-600 hover:border-ink"
                }`}
              >
                #{t}
              </button>
            ))}
          </div>

          {materials === undefined ? (
            <p className="text-neutral-500">Đang tải...</p>
          ) : visible.length === 0 ? (
            <p className="text-neutral-500">
              {materials.length === 0 ? "Chưa có tài liệu nào. Thêm ở khung bên trái." : "Không có tài liệu khớp bộ lọc."}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {visible.map((m) => (
                <li key={m.id} className="flex flex-col rounded-lg border-2 border-ink bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-xs font-semibold ${BADGE[m.type]}`}>
                        {TYPE_LABEL[m.type]}
                      </span>
                      {m.isDemo && <span className="text-xs text-neutral-500">Tài liệu mẫu</span>}
                    </div>
                    <button onClick={() => onDelete(m)} className="text-xs font-semibold text-red-700 hover:underline">
                      Xóa
                    </button>
                  </div>
                  <p className="mt-3 font-display text-xl uppercase leading-tight">{m.title}</p>
                  {m.type === "note" && m.content && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-700">{m.content}</p>
                  )}
                  {m.type === "link" && m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block truncate text-sm font-semibold text-cobalt underline"
                    >
                      {m.url}
                    </a>
                  )}
                  {m.type === "pdf" && (
                    <button onClick={() => openPdf(m)} className="mt-2 self-start text-sm font-semibold text-cobalt underline">
                      Mở PDF
                    </button>
                  )}
                  {m.tags.length > 0 && (
                    <p className="mt-auto pt-3 text-xs text-neutral-500">{m.tags.map((t) => `#${t}`).join(" ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}