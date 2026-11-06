"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Material } from "@/lib/db";
import { createCourseFromMaterial, deleteCourse } from "@/lib/courses";
import CourseView from "@/components/CourseView";

function CourseRow({ c, onOpen, onDelete }: { c: Course; onOpen: () => void; onDelete: () => void }) {
  const tasks = useLiveQuery(() => db.tasks.where("courseId").equals(c.id).toArray(), [c.id]);
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-3">
      <button onClick={onOpen} className="text-left">
        <p className="font-medium">{c.title}</p>
        <p className="text-xs text-neutral-500">
          {done}/{total} task
        </p>
      </button>
      <button onClick={onDelete} className="text-xs text-red-600">
        Xóa
      </button>
    </li>
  );
}

export default function PlanPage() {
  const courses = useLiveQuery(() => db.courses.orderBy("createdAt").reverse().toArray(), []);
  const materials = useLiveQuery(() => db.materials.orderBy("createdAt").reverse().toArray(), []);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [wpm, setWpm] = useState("100");

  async function onCreate(m: Material) {
    setError("");
    setBusyId(m.id);
    try {
      const { courseId, stats } = await createCourseFromMaterial(m.id, Number(wpm));
      setNotice(`Luna đã chia tài liệu thành ${stats.modules} module, ${stats.tasks} task (khoảng ${stats.totalMinutes} phút).`);
      setOpenId(courseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được khóa học.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteCourse(c: Course) {
    if (confirm(`Xóa khóa học "${c.title}"? Tài liệu gốc trong Thư viện vẫn còn.`)) await deleteCourse(c.id);
  }

  if (openId !== null) {
    return <CourseView courseId={openId} notice={notice} onBack={() => setOpenId(null)} />;
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Lộ trình</h1>

      <h2 className="mb-2 text-sm font-semibold text-neutral-700">Khóa học của bạn</h2>
      {courses === undefined ? (
        <p className="text-neutral-500">Đang tải...</p>
      ) : courses.length === 0 ? (
        <p className="mb-4 text-neutral-500">Chưa có khóa học. Chọn một ghi chú bên dưới để Luna chia việc.</p>
      ) : (
        <ul className="mb-6 space-y-2">
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

      <h2 className="mb-2 text-sm font-semibold text-neutral-700">Tạo khóa học từ tài liệu</h2>
      <label className="mb-3 flex items-center gap-2 text-sm text-neutral-600">
        Tốc độ đọc (từ/phút)
        <input
          type="number"
          min={60}
          max={300}
          value={wpm}
          onChange={(e) => setWpm(e.target.value)}
          className="w-20 rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {materials === undefined ? null : materials.length === 0 ? (
        <p className="text-neutral-500">Thư viện đang trống. Sang tab Thư viện thêm ghi chú hoặc nạp tài liệu mẫu.</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-3">
              <div>
                <p className="text-sm font-medium">{m.title}</p>
                <p className="text-xs text-neutral-500">
                  {m.type === "note" ? "Ghi chú" : m.type === "link" ? "Link" : "PDF"}
                  {m.isDemo ? " · Tài liệu mẫu" : ""}
                  {m.type !== "note" ? " · chưa chia được" : ""}
                </p>
              </div>
              <button
                disabled={m.type !== "note" || busyId === m.id}
                onClick={() => onCreate(m)}
                className="shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {busyId === m.id ? "Đang chia..." : "Tạo khóa học"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}