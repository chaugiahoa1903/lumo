"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Module, type Session, type Task, type TaskType } from "@/lib/db";
import { completeTask, endSession, isSessionActive, logStart, skipTask, type Outcome } from "@/lib/learning";
import { etaDate, etaDays, formatEtaDate, loadPace, MIN_TASKS_FOR_ETA, type Pace } from "@/lib/eta";
import { useSettings } from "@/lib/settings";
import { useToast } from "@/components/Toast";
import CountUp from "@/components/CountUp";
import QuestStrip from "@/components/QuestStrip";
import { btnCls, Button, PageHeader, Panel, ProgressBar } from "@/components/ui";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };
const THRESHOLDS = [25, 50, 75, 100];

type View = {
  course?: Course;
  tasks: Task[];
  modules: Module[];
  session?: Session;
  pace: Pace | null;
  paceCount: number;
};
type Phase = "idle" | "running" | "feedback" | "rested";
interface Result {
  title: string;
  moduleTitle?: string;
  milestone: boolean;
  doneAfter: number;
  total: number;
  sessionId: number;
  sessionTasks: number;
  sessionSeconds: number;
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function etaText(rem: number, pace: Pace | null, count: number): string {
  if (rem <= 0) return "Đã xong mọi task của khóa học này.";
  if (!pace) return `Cần hoàn thành ít nhất ${MIN_TASKS_FOR_ETA} task để Luna ước tính (mới có ${count}).`;
  const d = etaDate(etaDays(rem, pace));
  return `${formatEtaDate(d)} · tính từ ${pace.tasks} task trong ${pace.days} ngày học, nếu bạn học đều mỗi ngày như vậy.`;
}

function Burst() {
  const colors = ["bg-cobalt", "bg-sky", "bg-ink", "bg-white"];
  const dots = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const d = 80 + (i % 3) * 35;
    return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), rot: i * 47 };
  });
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 z-10 h-0 w-0">
      {dots.map((d, i) => (
        <span
          key={i}
          className={`burst-dot absolute h-3 w-3 rounded-sm border border-ink ${colors[i % colors.length]}`}
          style={{ "--dx": `${d.dx}px`, "--dy": `${d.dy}px`, "--rot": `${d.rot}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function StopPanel({
  doneCount,
  seconds,
  next,
  onRest,
  onMore,
}: {
  doneCount: number;
  seconds: number;
  next?: Task;
  onRest: () => void;
  onMore: () => void;
}) {
  return (
    <Panel title="Điểm dừng thắng lợi" hint="Dừng đúng lúc cũng là một chiến thắng" tone="amber">
      <p className="font-display text-3xl uppercase leading-tight">
        Hôm nay bạn đã xong {doneCount} task trong khoảng {Math.max(1, Math.round(seconds / 60))} phút
      </p>
      {next && (
        <p className="mt-3 text-sm">
          Ngày mai: &quot;{next.title}&quot;{next.teaser ? ` · ${next.teaser}` : ""}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onRest}>Nghỉ ở đây</Button>
        <Button variant="ghost" onClick={onMore}>
          Học thêm một phiên
        </Button>
      </div>
    </Panel>
  );
}

export default function NextPage() {
  const [settings] = useSettings();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [runningId, setRunningId] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [barPct, setBarPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const startRef = useRef(0);

  const view = useLiveQuery<View>(async () => {
    const [course, lastSession, paceInfo] = await Promise.all([
      db.courses.orderBy("createdAt").last(),
      db.sessions.orderBy("startedAt").last(),
      loadPace(),
    ]);
    const session = isSessionActive(lastSession, Date.now()) ? lastSession : undefined;
    if (!course) return { tasks: [], modules: [], session, pace: paceInfo.pace, paceCount: paceInfo.count };
    const [tasks, modules] = await Promise.all([
      db.tasks.where("courseId").equals(course.id).sortBy("order"),
      db.modules.where("courseId").equals(course.id).sortBy("order"),
    ]);
    return { course, tasks, modules, session, pace: paceInfo.pace, paceCount: paceInfo.count };
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  if (view === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const { course, tasks, modules, session, pace, paceCount } = view;

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

  const todo = tasks.filter((t) => t.status === "todo");
  const next = todo[0];
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total ? (done / total) * 100 : 0;
  const remEst = todo.reduce((s, t) => s + t.estMinutes, 0);
  const capHit = (n: number, sec: number) => n >= settings.sessionTasks || sec >= settings.sessionMinutes * 60;
  const sessionCapped = !!session && capHit(session.taskCount ?? 0, session.activeSeconds ?? 0);
  const running = runningId !== null ? tasks.find((t) => t.id === runningId) : undefined;

  function begin(t: Task) {
    startRef.current = Date.now();
    setElapsed(0);
    setRevealed(false);
    setRunningId(t.id);
    setPhase("running");
    void logStart(t.id);
  }

  async function finish(t: Task, outcome?: Outcome) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await completeTask(t.id, (Date.now() - startRef.current) / 1000, outcome);
      if (!r) {
        setPhase("idle");
        return;
      }
      const before = tasks.filter((x) => x.status === "done").length;
      const after = before + 1;
      const mod = modules.find((m) => m.id === t.moduleId);
      setResult({
        title: t.title,
        moduleTitle: mod?.title,
        milestone: t.isMilestone,
        doneAfter: after,
        total,
        sessionId: r.sessionId,
        sessionTasks: r.sessionTasks,
        sessionSeconds: r.sessionSeconds,
      });
      setBarPct(total ? (before / total) * 100 : 0);
      setPhase("feedback");
      window.setTimeout(() => setBarPct(total ? (after / total) * 100 : 0), 80);
    } catch {
      toast("Không lưu được kết quả. Thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function skip(t: Task) {
    await skipTask(t.id);
    setRunningId(null);
    setPhase("idle");
    toast(`Đã bỏ qua "${t.title}".`);
  }

  async function rest(sessionId: number | undefined) {
    if (sessionId !== undefined) await endSession(sessionId);
    setRunningId(null);
    setPhase("rested");
  }

  async function moreSession(sessionId: number | undefined) {
    if (sessionId !== undefined) await endSession(sessionId);
    setRunningId(null);
    setPhase("idle");
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

  let main: ReactNode;

  if (phase === "rested") {
    main = (
      <Panel title="Hẹn gặp lại" tone="amber">
        <p className="font-display text-3xl uppercase leading-tight">Bạn đã dừng đúng lúc</p>
        {next && (
          <p className="mt-3 text-sm">
            Lần sau: &quot;{next.title}&quot;{next.teaser ? ` · ${next.teaser}` : ""}
          </p>
        )}
        <div className="mt-5">
          <Button variant="ghost" onClick={() => setPhase("idle")}>
            Quay lại Next Up
          </Button>
        </div>
      </Panel>
    );
  } else if (phase === "running" && running) {
    const t = running;
    main = (
      <Panel
        title="Đang làm"
        hint={`${TYPE_LABEL[t.type]} · ước lượng ${t.estMinutes} phút · đã ${mmss(elapsed)}`}
        tone="amber"
      >
        <p className="font-display text-3xl uppercase leading-tight">{t.title}</p>
        <div className="mt-4 rounded-lg border-2 border-ink bg-white p-4">
          {t.type === "read" ? (
            <div className="max-h-[55vh] overflow-auto whitespace-pre-wrap leading-relaxed">
              {t.body ?? "(Task này không có nội dung.)"}
            </div>
          ) : (
            <>
              <p className="text-lg font-semibold">{t.body}</p>
              {revealed && (
                <p className="fade-in mt-4 rounded-lg border-2 border-ink bg-sky/40 p-3 text-sm">
                  {t.answer || "(Không có đáp án gợi ý cho task này.)"}
                </p>
              )}
            </>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {t.type === "read" ? (
            <Button disabled={busy} onClick={() => finish(t)}>
              Đã đọc xong
            </Button>
          ) : !revealed ? (
            <Button onClick={() => setRevealed(true)}>Hiện đáp án</Button>
          ) : (
            <>
              <Button disabled={busy} onClick={() => finish(t, "good")}>
                Mình nhớ
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => finish(t, "again")}>
                Chưa nhớ
              </Button>
            </>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => skip(t)}>
            Bỏ qua task
          </Button>
        </div>
      </Panel>
    );
  } else if (phase === "feedback" && result) {
    const r = result;
    const pctAfter = r.total ? (r.doneAfter / r.total) * 100 : 0;
    const thr = THRESHOLDS.find((x) => x > pctAfter);
    const need = thr ? Math.ceil((r.total * thr) / 100) - r.doneAfter : 0;
    const confirmText =
      pctAfter >= 100
        ? "Bạn đã hoàn thành toàn bộ khóa học."
        : `Bạn đã hoàn thành ${Math.round(pctAfter)}% – cách mốc ${thr}% chỉ ${need} task.`;
    const capped = capHit(r.sessionTasks, r.sessionSeconds);
    main = (
      <div className="space-y-6">
        <div className="relative">
          {r.milestone && <Burst />}
          <Panel title={r.milestone ? "Đạt mốc!" : "Xong!"} hint={r.title} tone="amber">
            <p className="font-display text-6xl leading-none">
              <CountUp value={Math.round(pctAfter)} suffix="%" />
            </p>
            <div className="mt-3">
              <ProgressBar value={barPct} label={`${r.doneAfter}/${r.total} task đã xong`} />
            </div>
            <p className="mt-3 font-display text-lg uppercase">{confirmText}</p>
            {r.milestone && r.moduleTitle && (
              <p className="mt-1 text-sm">Bạn vừa hoàn thành module &quot;{r.moduleTitle}&quot;.</p>
            )}
            {!capped && (
              <div className="mt-5 flex flex-wrap gap-3">
                {next ? (
                  <Button onClick={() => begin(next)}>Làm tiếp</Button>
                ) : (
                  <p className="text-sm font-semibold">Khóa học này đã hết task.</p>
                )}
                <Button variant="ghost" onClick={() => rest(r.sessionId)}>
                  Dừng ở đây
                </Button>
              </div>
            )}
          </Panel>
        </div>
        {capped && (
          <StopPanel
            doneCount={r.sessionTasks}
            seconds={r.sessionSeconds}
            next={next}
            onRest={() => rest(r.sessionId)}
            onMore={() => moreSession(r.sessionId)}
          />
        )}
      </div>
    );
  } else if (!next) {
    main = (
      <Panel title="Task kế tiếp" tone="amber">
        <p className="font-display text-3xl uppercase">Khóa học này đã xong task</p>
        <p className="mt-2 text-sm">Bạn có thể tạo khóa học mới từ tab Lộ trình.</p>
      </Panel>
    );
  } else if (sessionCapped && session) {
    main = (
      <StopPanel
        doneCount={session.taskCount ?? 0}
        seconds={session.activeSeconds ?? 0}
        next={next}
        onRest={() => rest(session.id)}
        onMore={() => moreSession(session.id)}
      />
    );
  } else {
    const left = todo.filter((t) => t.moduleId === next.moduleId).length;
    const mod = modules.find((m) => m.id === next.moduleId);
    let hope = `Task này khoảng ${next.estMinutes} phút, trong tổng ${remEst} phút còn lại.`;
    if (pace) {
      const b = etaDays(remEst, pace);
      const a = etaDays(remEst - next.estMinutes, pace);
      hope =
        b - a >= 1
          ? `Hoàn thành task này → khóa học xong sớm hơn khoảng ${b - a} ngày.`
          : `Hoàn thành task này → còn lại khoảng ${Math.max(0, Math.round((remEst - next.estMinutes) * pace.ratio))} phút học.`;
    }
    main = (
      <div className="space-y-6">
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
          <p className="mt-4 text-sm font-semibold">{hope}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => begin(next)}>Bắt đầu</Button>
            <Button variant="ghost" onClick={() => skip(next)}>
              Bỏ qua
            </Button>
          </div>
        </Panel>

        <details className="overflow-hidden rounded-xl border-2 border-ink bg-white">
          <summary className="cursor-pointer bg-sky/30 px-4 py-3 font-display text-base uppercase">
            Vì sao Luna chọn task này?
          </summary>
          <div className="border-t-2 border-ink p-4 text-sm text-neutral-700">
            <p>
              Hiện Luna chọn task đầu tiên chưa làm theo thứ tự khóa học. Công thức chấm điểm (độ gần mốc, đa dạng loại
              task, độ quên, thời lượng còn lại) sẽ có ở bước sau.
            </p>
            {next.reason && <p className="mt-2">Cách chia task này: {next.reason}</p>}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Next Up" subtitle={course.title} />
      <QuestStrip />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {main}
        {side}
      </div>
    </div>
  );
}