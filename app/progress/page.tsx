"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { etaDate, etaDays, formatEtaDate, loadPace, MIN_TASKS_FOR_ETA } from "@/lib/eta";
import { formatStamp } from "@/lib/text";
import CountUp from "@/components/CountUp";
import ConquestMap from "@/components/ConquestMap";
import BadgeGrid from "@/components/BadgeGrid";
import ScrollArea from "@/components/ScrollArea";
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
  const data = useLiveQuery(async () => {
    const [courses, tasks, paceInfo] = await Promise.all([
      db.courses.orderBy("createdAt").reverse().toArray(),
      db.tasks.toArray(),
      loadPace(),
    ]);
    const rows = courses.map((c) => {
      const ts = tasks.filter((t) => t.courseId === c.id);
      return {
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        total: ts.length,
        done: ts.filter((t) => t.status === "done").length,
        remainMin: ts.filter((t) => t.status === "todo").reduce((s, t) => s + t.estMinutes, 0),
      };
    });
    const studiedSec = tasks.reduce((s, t) => s + (t.actualSeconds ?? 0), 0);
    return { rows, pace: paceInfo.pace, count: paceInfo.count, studiedSec };
  }, []);

  if (data === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const { rows, pace, count, studiedSec } = data;
  const total = rows.reduce((s, r) => s + r.total, 0);
  const done = rows.reduce((s, r) => s + r.done, 0);
  const remain = rows.reduce((s, r) => s + r.remainMin, 0);
  const pct = total ? (done / total) * 100 : 0;

  let paceText = `Cần hoàn thành ít nhất ${MIN_TASKS_FOR_ETA} task để tính nhịp học (mới có ${count}).`;
  if (pace) {
    const diff = Math.round((pace.ratio - 1) * 100);
    const cmp =
      diff > 5
        ? `Bạn làm chậm hơn ước lượng khoảng ${diff}%.`
        : diff < -5
          ? `Bạn làm nhanh hơn ước lượng khoảng ${-diff}%.`
          : "Bạn làm sát với ước lượng.";
    paceText = `${pace.tasks} task trong ${pace.days} ngày học, trung bình ${Math.round(pace.minutesPerDay)} phút mỗi ngày học. ${cmp}`;
  }

  return (
    <div>
      <PageHeader title="Tiến độ" subtitle="Số liệu thật từ dữ liệu trên máy bạn, không có số ước chừng." />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={done} label="Task đã xong" tone="amber" />
        <Stat value={total} label="Tổng số task" />
        <Stat value={remain} suffix="'" label="Phút còn lại (ước lượng)" />
        <Stat value={Math.round(studiedSec / 60)} suffix="'" label="Phút đã học (đo thật)" />
      </div>

      <div className="mt-6 space-y-6">
        <ConquestMap />
        <BadgeGrid recent={3} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="Theo khóa học" hint={`${rows.length} khóa học`} flush>
          {rows.length === 0 ? (
            <p className="p-6 text-center text-neutral-600">Chưa có khóa học nào.</p>
          ) : (
            <ScrollArea label="Danh sách khóa học" maxHeight={420}>
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
                  {pace && r.remainMin > 0 && (
                    <p className="mt-1 text-xs font-semibold">
                      Dự kiến xong: {formatEtaDate(etaDate(etaDays(r.remainMin, pace)))}
                    </p>
                  )}
                  {r.total > 0 && r.remainMin === 0 && <p className="mt-1 text-xs font-semibold">Đã xong mọi task.</p>}
                </li>
              ))}
            </ul>
            </ScrollArea>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Tổng quan">
            <ProgressBar value={pct} label={`${Math.round(pct)}% tổng số task`} />
          </Panel>
          <Panel title="Nhịp học của bạn">
            <p className="text-sm">{paceText}</p>
          </Panel>
          <Panel title="Ngày hoàn thành dự kiến" tone="navy">
            <p className="text-sm">
              {remain <= 0
                ? "Không còn task nào chờ làm."
                : pace
                  ? `${formatEtaDate(etaDate(etaDays(remain, pace)))} nếu bạn học hết mọi khóa và học đều mỗi ngày như đã học.`
                  : `Chưa đủ dữ liệu. Lumo cần ít nhất ${MIN_TASKS_FOR_ETA} task bạn đã làm để ước tính, không dùng con số đoán.`}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
