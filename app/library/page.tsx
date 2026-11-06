"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Material, type MaterialType } from "@/lib/db";
import { deleteMaterial, loadDemos, restoreMaterial } from "@/lib/materials";
import { createCourseFromMaterial } from "@/lib/courses";
import { fold } from "@/lib/text";
import AddMaterialForm from "@/components/AddMaterialForm";
import { useToast } from "@/components/Toast";
import { Button, PageHeader, Panel, inputCls } from "@/components/ui";

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
  const router = useRouter();
  const toast = useToast();
  const materials = useLiveQuery(() => db.materials.orderBy("createdAt").reverse().toArray(), []);
  const [typeFilter, setTypeFilter] = useState<"all" | MaterialType>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [splittingId, setSplittingId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    materials?.forEach((m) => m.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [materials]);

  const visible = useMemo(() => {
    const q = fold(search.trim());
    return (materials ?? []).filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (tagFilter && !m.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return fold(`${m.title} ${m.content ?? ""} ${m.url ?? ""} ${m.tags.join(" ")}`).includes(q);
    });
  }, [materials, typeFilter, tagFilter, search]);

  const hasDemo = (materials ?? []).some((m) => m.isDemo);

  async function onLoadDemos() {
    try {
      const n = await loadDemos();
      toast(n > 0 ? `Đã nạp ${n} tài liệu mẫu.` : "Tài liệu mẫu đã có sẵn.");
    } catch {
      toast("Không nạp được tài liệu mẫu.");
    }
  }

  async function onDelete(m: Material) {
    await deleteMaterial(m.id);
    toast(`Đã xóa "${m.title}".`, {
      actionLabel: "Hoàn tác",
      onAction: () => {
        void restoreMaterial(m);
      },
      ms: 7000,
    });
  }

  async function onSplit(m: Material) {
    setSplittingId(m.id);
    try {
      const { stats } = await createCourseFromMaterial(m.id, 100);
      toast(`Luna đã chia "${m.title}" thành ${stats.modules} module, ${stats.tasks} task.`, {
        actionLabel: "Xem lộ trình",
        onAction: () => router.push("/plan"),
        ms: 8000,
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không chia được tài liệu.");
    } finally {
      setSplittingId(null);
    }
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

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="Thêm tài liệu" hint="Ghi chú, link hoặc PDF" className="lg:sticky lg:top-[88px]">
          <AddMaterialForm />
        </Panel>

        <Panel
          title="Kho tài liệu"
          hint={materials ? `${visible.length}/${materials.length} tài liệu` : undefined}
          flush
        >
          <div className="space-y-3 border-b-2 border-neutral-200 p-4">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, nội dung, tag...  (nhấn / để nhảy vào đây)"
              aria-label="Tìm tài liệu"
              className={inputCls}
            />
            <div className="flex flex-wrap items-center gap-2">
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
          </div>

          {materials === undefined ? (
            <p className="p-6 text-neutral-500">Đang tải...</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-neutral-600">
              {materials.length === 0
                ? "Chưa có tài liệu nào. Thêm ở khung bên trái hoặc nạp tài liệu mẫu."
                : "Không có tài liệu khớp bộ lọc."}
            </p>
          ) : (
            <ul className="stagger divide-y-2 divide-neutral-200">
              {visible.map((m) => (
                <li key={m.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-xs font-semibold ${BADGE[m.type]}`}>
                        {TYPE_LABEL[m.type]}
                      </span>
                      {m.isDemo && <span className="text-xs text-neutral-500">Tài liệu mẫu</span>}
                    </div>
                    <p className="mt-2 font-display text-xl uppercase leading-tight">{m.title}</p>
                    {m.type === "note" && m.content && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{m.content}</p>
                    )}
                    {m.type === "link" && m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate text-sm font-semibold text-cobalt underline"
                      >
                        {m.url}
                      </a>
                    )}
                    {m.type === "pdf" && (
                      <button onClick={() => openPdf(m)} className="mt-1 text-sm font-semibold text-cobalt underline">
                        Mở PDF
                      </button>
                    )}
                    {m.tags.length > 0 && (
                      <p className="mt-1 text-xs text-neutral-500">{m.tags.map((t) => `#${t}`).join(" ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-stretch sm:gap-2">
                    {m.type === "note" && (
                      <Button
                        variant="ghost"
                        className="!px-4 !py-1.5"
                        disabled={splittingId === m.id}
                        onClick={() => onSplit(m)}
                      >
                        {splittingId === m.id ? "Đang chia..." : "Chia việc"}
                      </Button>
                    )}
                    <button
                      onClick={() => onDelete(m)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Xóa
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}