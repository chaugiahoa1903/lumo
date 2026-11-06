"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task, type TaskType } from "@/lib/db";
import { deleteModule, deleteTask, mergeWithNext, renameModule, renameTask, splitModuleAt } from "@/lib/courses";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };
const btn = "rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700";

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
  const [open, setOpen] = useState<number | null>(null);

  if (!course || !modules || !tasks) return <p className="text-neutral-500">Đang tải...</p>;

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const remain = tasks.filter((t) => t.status !== "done" && t.status !== "skipped").reduce((s, t) => s + t.estMinutes, 0);

  const byModule = new Map<number, Task[]>();
  for (const t of tasks) {
    const arr = byModule.get(t.moduleId) ?? [];
    arr.push(t);
    byModule.set(t.moduleId, arr);
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
      <button onClick={onBack} className="mb-3 text-sm text-indigo-600">
        ← Danh sách khóa học
      </button>
      <h1 className="text-xl font-bold">{course.title}</h1>
      {notice && <p className="mt-1 text-sm text-neutral-600">{notice}</p>}
      <p className="mt-1 text-sm text-neutral-600">
        {done}/{tasks.length} task ({pct}%) · còn khoảng {remain} phút
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200">
        <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
      </div>

      {modules.length === 0 && <p className="mt-4 text-neutral-500">Khóa học trống.</p>}

      <div className="mt-4 space-y-4">
        {modules.map((md, mi) => {
          const list = byModule.get(md.id) ?? [];
          const mDone = list.filter((t) => t.status === "done").length;
          return (
            <section key={md.id} className="rounded border border-neutral-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{md.title}</h2>
                  <p className="text-xs text-neutral-500">
                    Module {mi + 1} · {mDone}/{list.length} task
                  </p>
                  {md.reason && <p className="mt-1 text-xs text-neutral-500">Vì sao tách: {md.reason}</p>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button className={btn} onClick={() => onRenameModule(md.id, md.title)}>
                  Đổi tên
                </button>
                {mi < modules.length - 1 && (
                  <button className={btn} onClick={() => mergeWithNext(md.id)}>
                    Gộp với module sau
                  </button>
                )}
                <button className={`${btn} text-red-600`} onClick={() => onDeleteModule(md.id, md.title)}>
                  Xóa module
                </button>
              </div>

              <ul className="mt-3 space-y-1">
                {list.map((t, ti) => {
                  const isOpen = open === t.id;
                  return (
                    <li key={t.id} className="rounded bg-neutral-50 px-2 py-1.5">
                      <button
                        onClick={() => setOpen(isOpen ? null : t.id)}
                        className="flex w-full items-center justify-between gap-2 text-left text-sm"
                      >
                        <span>
                          {t.status === "done" ? "✓" : "○"} {t.isMilestone && "◆ "}
                          {t.title}
                        </span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {TYPE_LABEL[t.type]} · {t.estMinutes}'
                        </span>
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-2 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
                          <p>
                            <span className="font-medium">Vì sao Luna chia như vậy?</span> {t.reason ?? "(không có)"}
                          </p>
                          {t.keywords && t.keywords.length > 0 && <p>Từ khóa: {t.keywords.join(", ")}</p>}
                          {t.teaser && <p>Gợi mở: {t.teaser}</p>}
                          <div className="flex flex-wrap gap-1">
                            <button className={btn} onClick={() => onRenameTask(t)}>
                              Sửa tên
                            </button>
                            {ti > 0 && (
                              <button className={btn} onClick={() => splitModuleAt(t.id)}>
                                Tách module từ đây
                              </button>
                            )}
                            <button className={`${btn} text-red-600`} onClick={() => onDeleteTask(t)}>
                              Xóa task
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}