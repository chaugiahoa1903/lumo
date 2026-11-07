"use client";

import { useDialog } from "@/components/Dialog";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course } from "@/lib/db";
import { createCourseFromMaterial, deleteCourse } from "@/lib/courses";
import { formatStamp } from "@/lib/text";
import { useToast } from "@/components/Toast";
import CourseView from "@/components/CourseView";
import { Button, PageHeader, Panel, ProgressBar } from "@/components/ui";

function CourseRow({ c, onOpen, onDelete }: { c: Course; onOpen: () => void; onDelete: () => void }) {
  const tasks = useLiveQuery(() => db.tasks.where("courseId").equals(c.id).toArray(), [c.id]);
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const remain = (tasks ?? [])
    .filter((t) => t.status !== "done" && t.status !== "skipped")
    .reduce((s, t) => s + t.estMinutes, 0);
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl uppercase leading-tight">{c.title}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Tạo lúc {formatStamp(c.createdAt)} · {total} task
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button className="!px-4 !py-1.5" onClick={onOpen}>
            Mở
          </Button>
          <Button variant="ghost" className="!px-4 !py-1.5 text-red-700" onClick={onDelete}>
            Xóa
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar
          value={total ? (done / total) * 100 : 0}
          label={`${done}/${total} task · còn khoảng ${remain} phút`}
        />
      </div>
    </li>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="mb-2 flex items-center gap-2 font-display text-base uppercase">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-sky text-sm">{n}</span>
      {title}
    </p>
  );
}

export default function PlanPage() {
  const toast = useToast();
  const courses = useLiveQuery(() => db.courses.orderBy("createdAt").reverse().toArray(), []);
  const materials = useLiveQuery(() => db.materials.orderBy("createdAt").reverse().toArray(), []);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [wpm, setWpm] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const existing =
    selectedId !== null ? (courses ?? []).filter((c) => c.materialIds.includes(selectedId)).length : 0;

  const dialog = useDialog();

  async function onCreate() {
    if (selectedId === null) return;
    setError("");
    setBusy(true);
    try {
      const { courseId, stats } = await createCourseFromMaterial(selectedId, wpm);
      setNotice(`Luna đã chia tài liệu thành ${stats.modules} module, ${stats.tasks} task (khoảng ${stats.totalMinutes} phút).`);
      setSelectedId(null);
      setOpenId(courseId);
      toast("Đã tạo khóa học.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được khóa học.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteCourse(c: Course) {
    if (
      await dialog.confirm({
        title: "Xóa khóa học?",
        message: `"${c.title}" sẽ bị xóa cùng module và task. Tài liệu gốc trong Thư viện vẫn còn.`,
        confirmLabel: "Xóa khóa học",
        danger: true,
      })
    ) {
      await deleteCourse(c.id);
      toast(`Đã xóa khóa học "${c.title}".`);
    }
  }

  if (openId !== null) {
    return <CourseView courseId={openId} notice={notice} onBack={() => setOpenId(null)} />;
  }

  return (
    <div>
      <PageHeader title="Lộ trình" subtitle="Luna chia tài liệu thành module và task nhỏ. Bạn có thể sửa lại mọi thứ." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Panel
          title="Khóa học của bạn"
          hint={courses ? `${courses.length} khóa học` : undefined}
          flush
        >
          {courses === undefined ? (
            <p className="p-6 text-neutral-500">Đang tải...</p>
          ) : courses.length === 0 ? (
            <p className="p-6 text-center text-neutral-600">
              Chưa có khóa học. Chọn một ghi chú ở khung bên phải để Luna chia việc.
            </p>
          ) : (
            <ul className="stagger divide-y-2 divide-neutral-200">
              {courses.map((c) => (
                <CourseRow
                  key={c.id}
                  c={c}
                  onOpen={() => {
                    setNotice("");
                    setOpenId(c.id);
                  }}
                  onDelete={() => onDeleteCourse(c)}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Tạo khóa học mới" hint="3 bước, mất vài giây" flush className="lg:sticky lg:top-[88px]">
          <div className="divide-y-2 divide-neutral-200">
            <div className="p-4">
              <Step n={1} title="Chọn tài liệu" />
              {materials === undefined ? (
                <p className="text-sm text-neutral-500">Đang tải...</p>
              ) : materials.length === 0 ? (
                <p className="text-sm text-neutral-600">
                  Thư viện đang trống. Sang tab Thư viện thêm ghi chú hoặc nạp tài liệu mẫu.
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-auto pr-1">
                  {materials.map((m) => {
                    const ok = m.type === "note";
                    const sel = selectedId === m.id;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          disabled={!ok}
                          aria-pressed={sel}
                          onClick={() => setSelectedId(sel ? null : m.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 border-ink px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            sel ? "bg-cobalt text-white" : "bg-white hover:bg-sky/40"
                          }`}
                        >
                          <span className="truncate font-semibold">{m.title}</span>
                          <span className={`shrink-0 text-xs ${sel ? "text-white/80" : "text-neutral-500"}`}>
                            {m.type === "note"
                              ? m.isDemo
                                ? "Tài liệu mẫu"
                                : "Ghi chú"
                              : m.type === "link"
                                ? "Link · chưa chia được"
                                : "PDF · chưa chia được"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-4">
              <Step n={2} title="Tốc độ đọc" />
              <input
                type="range"
                min={60}
                max={300}
                step={10}
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                aria-label="Tốc độ đọc (từ/phút)"
                className="w-full accent-cobalt"
              />
              <p className="text-sm text-neutral-600">{wpm} từ/phút. Dùng để ước lượng thời gian mỗi task.</p>
            </div>

            <div className="p-4">
              <Step n={3} title="Để Luna chia việc" />
              {existing > 0 && (
                <p className="mb-2 rounded-lg border-2 border-ink bg-amber-retro px-3 py-2 text-xs">
                  Tài liệu này đã có {existing} khóa học. Bạn vẫn tạo thêm được.
                </p>
              )}
              {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
              <Button disabled={selectedId === null || busy} onClick={onCreate}>
                {busy ? "Đang chia..." : "Tạo khóa học"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
