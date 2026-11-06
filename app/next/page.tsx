"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Module, type Task, type TaskType } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import CountUp from "@/components/CountUp";
import { btnCls, Button, PageHeader, Panel, ProgressBar } from "@/components/ui";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };

type View = { course?: Course; tasks: Task[]; modules: Module[] };

export default function NextPage() {
  const [settings] = useSettings();
  const view = useLiveQuery<View>(async () => {
    const course = await db.courses.orderBy("createdAt").last();
    if (!course) return { tasks: [], modules: [] };
    const [tasks, modules] = await Promise.all([
      db.tasks.where("courseId").equals(course.id).sortBy("order"),
      db.modules.where("courseId").equals(course.id).sortBy("order"),
    ]);
    return { course, tasks, modules };
  }, []);

  if (view === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const { course, tasks, modules } = view;

  if (!course) {
    return (
      <div>
        <PageHeader title="Next Up" subtitle="Task kế tiếp dành cho bạn sẽ xuất hiện ở đây." />
        <Panel title="Chưa có khóa học" className="max-w-xl">
          <p className="mb-4">Chọn một ghi chú trong Thư viện để Luna chia việc.</p>
          <Link href="/plan" className={btnCls("primary")}>
            Tạo khóa học
          </Link>
        </Panel>
      </div>
    );
  }

  const next = tasks.find((t) => t.status === "todo");
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total ? (done / total) * 100 : 0;

  const side = (
    <div className="stagger space-y-6">
      <Panel title="Tiến độ" hint={course.title} flush>
        <div className="p-4">
          <ProgressBar value={pct} label={`${done}/${total} task đã xong`} />
        </div>
        <ul className="divide-y-2 divide-neutral-200 border-t-2 border-neutral-200">
          {modules.map((m) => {
            const ts = tasks.filter((t) => t.moduleId === m.id);
            const d = ts.filter((t) => t.status === "done").length;
            return (
              <li key={m.id} className="p-4">
                <p className="truncate text-sm font-semibold">{m.title}</p>
                <ProgressBar value={ts.length ? (d / ts.length) * 100 : 0} label={`${d}/${ts.length} task`} />
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Phiên hôm nay" tone="navy">
        <p className="text-sm">
          Giới hạn mềm: {settings.sessionMinutes} phút hoặc {settings.sessionTasks} task. Dừng đúng lúc cũng là một
          chiến thắng.
        </p>
        <p className="mt-3 font-display text-sm uppercase tracking-wide">Ngày hoàn thành dự kiến</p>
        <p className="mt-1 text-sm">Chưa đủ dữ liệu. Lumo sẽ tính từ tốc độ học thật của bạn, không ước chừng.</p>
      </Panel>
    </div>
  );

  if (!next) {
    return (
      <div>
        <PageHeader title="Next Up" subtitle={course.title} />
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <Panel title="Task kế tiếp" tone="amber">
            <p className="font-display text-3xl uppercase">Khóa học này đã xong task</p>
            <p className="mt-2 text-sm">Bạn có thể tạo khóa học mới từ tab Lộ trình.</p>
          </Panel>
          {side}
        </div>
      </div>
    );
  }

  const mod = modules.find((m) => m.id === next.moduleId);
  const left = tasks.filter((t) => t.moduleId === next.moduleId && t.status === "todo").length;

  return (
    <div>
      <PageHeader title="Next Up" subtitle={course.title} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="stagger space-y-6">
          <Panel
            title="Task kế tiếp"
            hint={`Còn ${left} task nữa là xong ${mod ? `"${mod.title}"` : "module này"}`}
            tone="amber"
          >
            <p className="font-display text-sm uppercase tracking-wide">
              {TYPE_LABEL[next.type]} · khoảng {next.estMinutes} phút
              {next.isMilestone ? " · mốc" : ""}
            </p>
            <p className="mt-2 font-display text-4xl uppercase leading-tight">{next.title}</p>
            {next.teaser && <p className="mt-4 max-w-xl text-sm">{next.teaser}</p>}
            <p className="mt-4 font-display text-lg uppercase">
              Còn <CountUp value={left} /> task nữa
            </p>
            <div className="mt-4">
              <Button variant="primary" disabled title="Làm task sẽ có ở bước M3">
                Bắt đầu (sắp có)
              </Button>
            </div>
          </Panel>

          <details className="overflow-hidden rounded-xl border-2 border-ink bg-white">
            <summary className="cursor-pointer bg-sky/30 px-4 py-3 font-display text-base uppercase">
              Vì sao Luna chọn task này?
            </summary>
            <div className="border-t-2 border-ink p-4 text-sm text-neutral-700">
              <p>
                Hiện Luna chọn task đầu tiên chưa làm theo thứ tự khóa học. Công thức chấm điểm (độ gần mốc, đa dạng
                loại task, độ quên, thời lượng còn lại) sẽ có ở bước sau.
              </p>
              {next.reason && <p className="mt-2">Cách chia task này: {next.reason}</p>}
            </div>
          </details>
        </div>

        {side}
      </div>
    </div>
  );
}