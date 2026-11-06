"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Module, type Session, type Task, type TaskType } from "@/lib/db";
import { isSessionActive, skipTask } from "@/lib/learning";
import { etaDate, etaDays, formatEtaDate, loadPace, MIN_TASKS_FOR_ETA, type Pace } from "@/lib/eta";
import { pickSelected, queueFor, upcomingOf } from "@/lib/focus";
import type { PomoConfig } from "@/lib/pomodoro";
import { STUDY_KEYS, ssSet } from "@/lib/studyflow";
import { useSettings } from "@/lib/settings";
import { ambient } from "@/lib/ambient";
import { useToast } from "@/components/Toast";
import PomoSetup from "@/components/PomoSetup";
import QuestStrip from "@/components/QuestStrip";
import { btnCls, Button, PageHeader, Panel, ProgressBar } from "@/components/ui";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };
const TYPE_BADGE: Record<TaskType, string> = { read: "bg-sky", flashcard: "bg-amber-retro", recall: "bg-white" };

type View = {
  course?: Course;
  tasks: Task[];
  modules: Module[];
  session?: Session;
  pace: Pace | null;
  paceCount: number;
  due: number;
};

function etaText(rem: number, pace: Pace | null, count: number): string {
  if (rem <= 0) return "Đã xong mọi task của khóa học này.";
  if (!pace) return `Cần hoàn thành ít nhất ${MIN_TASKS_FOR_ETA} task để Luna ước tính (mới có ${count}).`;
  const d = etaDate(etaDays(rem, pace));
  return `${formatEtaDate(d)} · tính từ ${pace.tasks} task trong ${pace.days} ngày học, nếu bạn học đều mỗi ngày như vậy.`;
}

export default function NextPage() {
  const router = useRouter();
  const toast = useToast();
  const [settings, updateSettings] = useSettings();
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const view = useLiveQuery<View>(async () => {
    const [course, lastSession, paceInfo, due] = await Promise.all([
      db.courses.orderBy("createdAt").last(),
      db.sessions.orderBy("startedAt").last(),
      loadPace(),
      db.reviews.where("dueAt").belowOrEqual(Date.now()).count(),
    ]);
    const session = isSessionActive(lastSession, Date.now()) ? lastSession : undefined;
    if (!course) return { tasks: [], modules: [], session, pace: paceInfo.pace, paceCount: paceInfo.count, due };
    const [tasks, modules] = await Promise.all([
      db.tasks.where("courseId").equals(course.id).sortBy("order"),
      db.modules.where("courseId").equals(course.id).sortBy("order"),
    ]);
    return { course, tasks, modules, session, pace: paceInfo.pace, paceCount: paceInfo.count, due };
  }, []);

  if (view === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const { course, tasks, modules, session, pace, paceCount, due } = view;

  const reviewPanel = (
    <Panel title="Ôn tập" hint={due > 0 ? `${due} thẻ đến hạn` : "Chưa có thẻ nào đến hạn"}>
      {due > 0 ? (
        <>
          <p className="mb-3 text-sm text-neutral-700">Ôn ngay để các thẻ không bị quên.</p>
          <Link href="/study/review" className={btnCls("primary")}>
            Vào ôn tập
          </Link>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-700">Hoàn thành task flashcard hoặc nhớ lại để có thẻ ôn.</p>
          <Link href="/review" className={btnCls("ghost")}>
            Xem trang Ôn tập
          </Link>
        </>
      )}
    </Panel>
  );

  if (!course) {
    return (
      <div>
        <PageHeader title="Next Up" subtitle="Chuẩn bị trước khi vào phòng học." />
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <Panel title="Chưa có khóa học">
            <p className="mb-4">Chọn một ghi chú trong Thư viện để Luna chia việc, rồi quay lại đây để bắt đầu học.</p>
            <Link href="/plan" className={btnCls("primary")}>
              Tạo khóa học
            </Link>
          </Panel>
          {reviewPanel}
        </div>
      </div>
    );
  }

  const focusMod = moduleId !== null && modules.some((m) => m.id === moduleId) ? moduleId : null;
  let queue = queueFor(tasks, focusMod);
  if (queue.length === 0 && focusMod !== null) queue = queueFor(tasks, null);
  const current = pickSelected(queue, selectedId);
  const todoAll = tasks.filter((t) => t.status === "todo");
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total ? (done / total) * 100 : 0;
  const remEst = todoAll.reduce((s, t) => s + t.estMinutes, 0);

  const cfg: PomoConfig = {
    focusMin: settings.focusMinutes,
    shortBreakMin: settings.breakMinutes,
    longBreakMin: settings.longBreakMinutes,
    rounds: settings.pomoRounds,
  };

  function launch(c: PomoConfig) {
    updateSettings({
      focusMinutes: c.focusMin,
      breakMinutes: c.shortBreakMin,
      longBreakMinutes: c.longBreakMin,
      pomoRounds: c.rounds,
    });
    ssSet(STUDY_KEYS.go, "1");
    ssSet(STUDY_KEYS.module, focusMod === null ? "" : String(focusMod));
    ssSet(STUDY_KEYS.task, current ? String(current.id) : "");
    setShowSetup(false);
    router.push("/study");
  }

  async function skip(t: Task) {
    await skipTask(t.id);
    setSelectedId(null);
    toast(`Đã bỏ qua "${t.title}".`);
  }

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

      {reviewPanel}

      <Panel title="Phiên hôm nay" tone="navy">
        {session ? (
          <p className="text-sm">
            {session.taskCount ?? 0}/{settings.sessionTasks} task · {Math.round((session.activeSeconds ?? 0) / 60)}/
            {settings.sessionMinutes} phút
          </p>
        ) : (
          <p className="text-sm">
            Chưa có phiên nào đang chạy. Giới hạn mềm: {settings.sessionMinutes} phút hoặc {settings.sessionTasks} task.
          </p>
        )}
        <p className="mt-3 font-display text-sm uppercase tracking-wide">Ngày hoàn thành dự kiến</p>
        <p className="mt-1 text-sm">{etaText(remEst, pace, paceCount)}</p>
      </Panel>
    </div>
  );

  if (!current) {
    return (
      <div>
        <PageHeader title="Next Up" subtitle={course.title} />
        <QuestStrip />
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <Panel title="Sẵn sàng học" tone="amber">
            <p className="font-display text-3xl uppercase">Khóa học này đã xong task</p>
            <p className="mt-2 text-sm">Bạn có thể tạo khóa học mới từ tab Lộ trình, hoặc vào ôn tập.</p>
          </Panel>
          {side}
        </div>
      </div>
    );
  }

  const mod = modules.find((m) => m.id === current.moduleId);
  const left = todoAll.filter((t) => t.moduleId === current.moduleId).length;
  const list = [current, ...upcomingOf(queue, current, 5)];

  let hope = `Task này khoảng ${current.estMinutes} phút, trong tổng ${remEst} phút còn lại.`;
  if (pace) {
    const b = etaDays(remEst, pace);
    const a = etaDays(remEst - current.estMinutes, pace);
    hope =
      b - a >= 1
        ? `Hoàn thành task này → khóa học xong sớm hơn khoảng ${b - a} ngày.`
        : `Hoàn thành task này → còn lại khoảng ${Math.max(0, Math.round((remEst - current.estMinutes) * pace.ratio))} phút học.`;
  }

  return (
    <div>
      {showSetup && <PomoSetup initial={cfg} mode="start" onConfirm={launch} onClose={() => setShowSetup(false)} />}

      <PageHeader title="Next Up" subtitle={course.title} />
      <QuestStrip />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel
            title="Sẵn sàng học"
            hint={`Còn ${left} task nữa là xong ${mod ? `"${mod.title}"` : "module này"}`}
            tone="amber"
          >
            <label className="mb-4 flex items-center gap-2 text-sm">
              <span className="font-semibold">Học module</span>
              <select
                aria-label="Chọn module"
                value={focusMod ?? "all"}
                onChange={(e) => {
                  setModuleId(e.target.value === "all" ? null : Number(e.target.value));
                  setSelectedId(null);
                }}
                className="min-w-0 flex-1 rounded-lg border-2 border-ink bg-white px-3 py-1.5 text-sm"
              >
                <option value="all">Tất cả module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>

            <p className="font-display text-sm uppercase tracking-wide">
              {TYPE_LABEL[current.type]} · khoảng {current.estMinutes} phút
              {current.isMilestone ? " · mốc" : ""}
            </p>
            <p className="mt-2 font-display text-4xl uppercase leading-tight">{current.title}</p>
            {current.teaser && <p className="mt-3 max-w-xl text-sm">{current.teaser}</p>}
            <p className="mt-3 text-sm font-semibold">{hope}</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  ambient.unlock();
                  launch(cfg);
                }}
              >
                Bắt đầu học
              </Button>
              <Button variant="ghost" onClick={() => skip(current)}>
                Bỏ qua task
              </Button>
            </div>
            <p className="mt-3 text-xs">
              Bấm &quot;Bắt đầu học&quot; sẽ chuyển sang chế độ tập trung toàn màn hình, thoát bất cứ lúc nào.
            </p>
          </Panel>

          <Panel title="Hàng đợi" hint="Bấm một task để chọn học từ đó" flush>
            <ul className="divide-y-2 divide-neutral-200">
              {list.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    aria-pressed={t.id === current.id}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      t.id === current.id ? "bg-sky/30" : "hover:bg-sky/15"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white font-display text-sm">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t.title}</span>
                      <span className="block text-xs text-neutral-500">{t.isMilestone ? "Mốc của module" : " "}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border-2 border-ink px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[t.type]}`}>
                      {TYPE_LABEL[t.type]} · {t.estMinutes}&apos;
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <details className="overflow-hidden rounded-xl border-2 border-ink bg-white">
            <summary className="cursor-pointer bg-sky/30 px-4 py-3 font-display text-base uppercase">
              Vì sao Luna chọn task này?
            </summary>
            <div className="border-t-2 border-ink p-4 text-sm text-neutral-700">
              <p>
                Hiện Luna chọn task đầu tiên chưa làm theo thứ tự khóa học (bạn đổi bằng cách chọn module hoặc bấm task
                trong hàng đợi). Công thức chấm điểm (độ gần mốc, đa dạng loại task, độ quên, thời lượng còn lại) sẽ có ở
                bước sau.
              </p>
              {current.reason && <p className="mt-2">Cách chia task này: {current.reason}</p>}
            </div>
          </details>
        </div>

        {side}
      </div>
    </div>
  );
}