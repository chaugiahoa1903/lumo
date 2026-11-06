"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Module, type Task, type TaskType } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { btnCls, Button, Card, PageHeader, ProgressBar } from "@/components/ui";

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
        <Card className="max-w-xl">
          <p className="mb-4">Chưa có khóa học nào. Chọn một ghi chú trong Thư viện để Luna chia việc.</p>
          <Link href="/plan" className={btnCls("primary")}>
            Tạo khóa học
          </Link>
        </Card>
      </div>
    );
  }

  const next = tasks.find((t) => t.status === "todo");
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total ? (done / total) * 100 : 0;

  const side = (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 font-display text-sm uppercase tracking-wide">Tiến độ khóa học</p>
        <ProgressBar value={pct} label={`${done}/${total} task đã xong`} />
      </Card>

      <Card>
        <p className="mb-3 font-display text-sm uppercase tracking-wide">Các module</p>
        <ul className="space-y-3">
          {modules.map((m) => {
            const ts = tasks.filter((t) => t.moduleId === m.id);
            const d = ts.filter((t) => t.status === "done").length;
            return (
              <li key={m.id}>
                <p className="truncate text-sm font-semibold">{m.title}</p>
                <ProgressBar value={ts.length ? (d / ts.length) * 100 : 0} label={`${d}/${ts.length} task`} />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card tone="navy">
        <p className="font-display text-sm uppercase tracking-wide">Phiên hôm nay</p>
        <p className="mt-2 text-sm">
          Giới hạn mềm: {settings.sessionMinutes} phút hoặc {settings.sessionTasks} task. Dừng đúng lúc cũng là một chiến
          thắng.
        </p>
        <p className="mt-3 font-display text-sm uppercase tracking-wide">Ngày hoàn thành dự kiến</p>
        <p className="mt-1 text-sm">Chưa đủ dữ liệu. Lumo sẽ tính từ tốc độ học thật của bạn, không ước chừng.</p>
      </Card>
    </div>
  );

  if (!next) {
    return (
      <div>
        <PageHeader title="Next Up" subtitle={course.title} />
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
          <Card tone="amber">
            <p className="font-display text-3xl uppercase">Khóa học này đã xong task</p>
            <p className="mt-2 text-sm">Bạn có thể tạo khóa học mới từ tab Lộ trình.</p>
          </Card>
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

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="mb-4 font-display text-xl uppercase">
            Còn {left} task nữa là xong {mod ? `"${mod.title}"` : "module này"}
          </p>

          <Card tone="amber" className="overflow-hidden">
            <p className="font-display text-sm uppercase tracking-wide">
              {TYPE_LABEL[next.type]} · khoảng {next.estMinutes} phút
              {next.isMilestone ? " · mốc" : ""}
            </p>
            <p className="mt-3 font-display text-4xl uppercase leading-tight">{next.title}</p>
            {next.teaser && <p className="mt-4 max-w-xl text-sm">{next.teaser}</p>}
            <div className="mt-6">
              <Button variant="primary" disabled title="Làm task sẽ có ở bước M3">
                Bắt đầu (sắp có)
              </Button>
            </div>
          </Card>

          <details className="mt-4 rounded-lg border-2 border-ink bg-white p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Vì sao Luna chọn task này?</summary>
            <p className="mt-2 text-neutral-600">
              Hiện Luna chọn task đầu tiên chưa làm theo thứ tự khóa học. Công thức chấm điểm (độ gần mốc, đa dạng loại
              task, độ quên, thời lượng còn lại) sẽ có ở bước sau.
            </p>
            {next.reason && <p className="mt-2 text-neutral-600">Cách chia task này: {next.reason}</p>}
          </details>
        </div>

        {side}
      </div>
    </div>
  );
}