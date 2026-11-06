"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatStamp } from "@/lib/text";
import CountUp from "@/components/CountUp";
import { Card, PageHeader, Panel, ProgressBar } from "@/components/ui";

function Stat({
  value,
  suffix,
  label,
  tone = "white",
}: {
  value: number;
  suffix?: string;
  label: string;
  tone?: "white" | "amber" | "navy";
}) {
  return (
    <Card tone={tone}>
      <p className="font-display text-5xl leading-none">
        <CountUp value={value} suffix={suffix} />
      </p>
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
        createdAt: c.createdAt,
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

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={done} label="Task đã xong" tone="amber" />
        <Stat value={total} label="Tổng số task" />
        <Stat value={remain} suffix="'" label="Phút còn lại" />
        <Stat value={rows.length} label="Khóa học" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="Theo khóa học" hint={`${rows.length} khóa học`} flush>
          {rows.length === 0 ? (
            <p className="p-6 text-center text-neutral-600">Chưa có khóa học nào.</p>
          ) : (
            <ul className="stagger divide-y-2 divide-neutral-200">
              {rows.map((r) => (
                <li key={r.id} className="p-4">
                  <p className="font-display text-xl uppercase leading-tight">{r.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Tạo lúc {formatStamp(r.createdAt)}</p>
                  <div className="mt-3">
                    <ProgressBar
                      value={r.total ? (r.done / r.total) * 100 : 0}
                      label={`${r.done}/${r.total} task · còn khoảng ${r.remainMin} phút`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Tổng quan">
            <ProgressBar value={pct} label={`${Math.round(pct)}% tổng số task`} />
          </Panel>
          <Panel title="Ngày hoàn thành dự kiến" tone="navy">
            <p className="text-sm">
              Chưa đủ dữ liệu. Lumo sẽ tính từ tốc độ học thật của bạn sau khi bạn hoàn thành một số task.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}