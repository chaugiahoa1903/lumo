"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, PageHeader, ProgressBar } from "@/components/ui";

function Stat({ value, label, tone = "white" }: { value: string; label: string; tone?: "white" | "amber" | "navy" }) {
  return (
    <Card tone={tone}>
      <p className="font-display text-5xl leading-none">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-wide opacity-80">{label}</p>
    </Card>
  );
}

export default function ProgressPage() {
  const rows = useLiveQuery(async () => {
    const [courses, tasks] = await Promise.all([
      db.courses.orderBy("createdAt").reverse().toArray(),
      db.tasks.toArray(),
    ]);
    return courses.map((c) => {
      const ts = tasks.filter((t) => t.courseId === c.id);
      return {
        id: c.id,
        title: c.title,
        total: ts.length,
        done: ts.filter((t) => t.status === "done").length,
        remainMin: ts.filter((t) => t.status !== "done" && t.status !== "skipped").reduce((s, t) => s + t.estMinutes, 0),
      };
    });
  }, []);

  if (rows === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const total = rows.reduce((s, r) => s + r.total, 0);
  const done = rows.reduce((s, r) => s + r.done, 0);
  const remain = rows.reduce((s, r) => s + r.remainMin, 0);
  const pct = total ? (done / total) * 100 : 0;

  return (
    <div>
      <PageHeader title="Tiến độ" subtitle="Số liệu thật từ dữ liệu trên máy bạn, không có số ước chừng." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={String(done)} label="Task đã xong" tone="amber" />
        <Stat value={String(total)} label="Tổng số task" />
        <Stat value={`${remain}'`} label="Phút còn lại" />
        <Stat value={String(rows.length)} label="Khóa học" />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-3">Theo khóa học</h2>
          {rows.length === 0 ? (
            <p className="text-neutral-500">Chưa có khóa học nào.</p>
          ) : (
            <ul className="space-y-4">
              {rows.map((r) => (
                <li key={r.id}>
                  <Card>
                    <p className="font-display text-xl uppercase">{r.title}</p>
                    <div className="mt-3">
                      <ProgressBar
                        value={r.total ? (r.done / r.total) * 100 : 0}
                        label={`${r.done}/${r.total} task · còn khoảng ${r.remainMin} phút`}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <Card>
            <p className="mb-3 font-display text-sm uppercase tracking-wide">Tổng quan</p>
            <ProgressBar value={pct} label={`${Math.round(pct)}% tổng số task`} />
          </Card>
          <Card tone="navy">
            <p className="font-display text-sm uppercase tracking-wide">Ngày hoàn thành dự kiến</p>
            <p className="mt-2 text-sm">
              Chưa đủ dữ liệu. Lumo sẽ tính từ tốc độ học thật của bạn sau khi bạn hoàn thành một số task.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}