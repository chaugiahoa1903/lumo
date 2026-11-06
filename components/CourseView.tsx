"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task, type TaskType } from "@/lib/db";
import { deleteModule, deleteTask, mergeWithNext, renameModule, renameTask, splitModuleAt } from "@/lib/courses";
import CountUp from "@/components/CountUp";
import { ProgressBar } from "@/components/ui";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };
const miniBtn = "rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-semibold hover:bg-sky/40";

export default function CourseView({
  courseId,
  notice,
  onBack,
}: {
  courseId: number;
  notice?: string;
  onBack: () => void;
}) {
  const course = useLiveQuery(() => db.courses.get(courseId), [courseId]);
  const modules = useLiveQuery(() => db.modules.where("courseId").equals(courseId).sortBy("order"), [courseId]);
  const tasks = useLiveQuery(() => db.tasks.where("courseId").equals(courseId).sortBy("order"), [courseId]);
  const [openMods, setOpenMods] = useState<number[] | null>(null);
  const [openTask, setOpenTask] = useState<number | null>(null);

  if (!course || !modules || !tasks) return <p className="text-neutral-500">Đang tải...</p>;

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? (done / tasks.length) * 100 : 0;
  const remain = tasks.filter((t) => t.status !== "done" && t.status !== "skipped").reduce((s, t) => s + t.estMinutes, 0);

  const byModule = new Map<number, Task[]>();
  for (const t of tasks) {
    const arr = byModule.get(t.moduleId) ?? [];
    arr.push(t);
    byModule.set(t.moduleId, arr);
  }

  const isOpen = (id: number, idx: number) => (openMods ? openMods.includes(id) : idx === 0);
  function toggle(id: number) {
    const base = openMods ?? (modules && modules[0] ? [modules[0].id] : []);
    setOpenMods(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  }

  async function onRenameModule(id: number, cur: string) {
    const v = window.prompt("Tên module mới", cur);
    if (v) await renameModule(id, v);
  }
  async function onRenameTask(t: Task) {
    const v = window.prompt("Tên task mới", t.title);
    if (v) await renameTask(t.id, v);
  }
  async function onDeleteModule(id: number, title: string) {
    if (confirm(`Xóa module "${title}" và toàn bộ task trong đó?`)) await deleteModule(id);
  }
  async function onDeleteTask(t: Task) {
    if (confirm(`Xóa task "${t.title}"?`)) await deleteTask(t.id);
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm font-semibold text-cobalt underline">
        ← Danh sách khóa học
      </button>

      <div className="mb-6 rounded-lg border-2 border-ink bg-amber-retro p-4">
        <h1 className="page-title">{course.title}</h1>
        {notice && <p className="mt-2 text-sm">{notice}</p>}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border-2 border-ink bg-white p-2">
            <p className="font-display text-3xl leading-none">
              <CountUp value={done} />
            </p>
            <p className="mt-1 text-xs text-neutral-600">Task đã xong</p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-white p-2">
            <p className="font-display text-3xl leading-none">
              <CountUp value={tasks.length} />
            </p>
            <p className="mt-1 text-xs text-neutral-600">Tổng số task</p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-white p-2">
            <p className="font-display text-3xl leading-none">
              <CountUp value={remain} suffix="'" />
            </p>
            <p className="mt-1 text-xs text-neutral-600">Phút còn lại</p>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={pct} label={`${Math.round(pct)}% khóa học`} />
        </div>
      </div>

      {modules.length === 0 && <p className="text-neutral-500">Khóa học trống.</p>}

      <div className="stagger space-y-3">
        {modules.map((md, mi) => {
          const list = byModule.get(md.id) ?? [];
          const mDone = list.filter((t) => t.status === "done").length;
          const mMin = list.reduce((s, t) => s + t.estMinutes, 0);
          const open = isOpen(md.id, mi);
          return (
            <section key={md.id} className="rounded-lg border-2 border-ink bg-white">
              <button
                type="button"
                onClick={() => toggle(md.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sky font-display text-lg">
                  {mi + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-xl uppercase">{md.title}</span>
                  <span className="block text-xs text-neutral-600">
                    {mDone}/{list.length} task · khoảng {mMin} phút
                  </span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden" inert={!open}>
                  <div className="border-t-2 border-ink p-4">
                    {md.reason && <p className="mb-3 text-xs text-neutral-600">Vì sao tách: {md.reason}</p>}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button className={miniBtn} onClick={() => onRenameModule(md.id, md.title)}>
                        Đổi tên
                      </button>
                      {mi < modules.length - 1 && (
                        <button className={miniBtn} onClick={() => mergeWithNext(md.id)}>
                          Gộp với module sau
                        </button>
                      )}
                      <button className={`${miniBtn} text-red-700`} onClick={() => onDeleteModule(md.id, md.title)}>
                        Xóa module
                      </button>
                    </div>

                    <ul className="space-y-2">
                      {list.map((t, ti) => {
                        const tOpen = openTask === t.id;
                        return (
                          <li key={t.id} className="rounded-lg border-2 border-ink bg-neutral-50 px-3 py-2">
                            <button
                              onClick={() => setOpenTask(tOpen ? null : t.id)}
                              aria-expanded={tOpen}
                              className="flex w-full items-center justify-between gap-2 text-left text-sm"
                            >
                              <span>
                                {t.status === "done" ? "✓" : "○"} {t.isMilestone && "◆ "}
                                {t.title}
                              </span>
                              <span className="shrink-0 text-xs text-neutral-600">
                                {TYPE_LABEL[t.type]} · {t.estMinutes}&apos;
                              </span>
                            </button>
                            {tOpen && (
                              <div className="fade-in mt-2 space-y-2 border-t-2 border-ink pt-2 text-xs text-neutral-700">
                                <p>
                                  <span className="font-semibold">Vì sao Luna chia như vậy?</span> {t.reason ?? "(không có)"}
                                </p>
                                {t.keywords && t.keywords.length > 0 && <p>Từ khóa: {t.keywords.join(", ")}</p>}
                                {t.teaser && <p>Gợi mở: {t.teaser}</p>}
                                <div className="flex flex-wrap gap-2">
                                  <button className={miniBtn} onClick={() => onRenameTask(t)}>
                                    Sửa tên
                                  </button>
                                  {ti > 0 && (
                                    <button className={miniBtn} onClick={() => splitModuleAt(t.id)}>
                                      Tách module từ đây
                                    </button>
                                  )}
                                  <button className={`${miniBtn} text-red-700`} onClick={() => onDeleteTask(t)}>
                                    Xóa task
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}