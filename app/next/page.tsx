"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Module, type Session, type Task, type TaskType } from "@/lib/db";
import { completeTask, endSession, isSessionActive, logStart, skipTask, type Outcome } from "@/lib/learning";
import { etaDate, etaDays, formatEtaDate, loadPace, MIN_TASKS_FOR_ETA, type Pace } from "@/lib/eta";
import { BLOCK_OPTIONS, formatClock, pickSelected, queueFor, stepTask, upcomingOf } from "@/lib/focus";
import { breakMinutes, describeConfig, isLongBreak, roundNumber, type PomoConfig } from "@/lib/pomodoro";
import { levelInfo, sumXp } from "@/lib/xp";
import { useSettings } from "@/lib/settings";
import { ambient } from "@/lib/ambient";
import { useToast } from "@/components/Toast";
import CountUp from "@/components/CountUp";
import TimerDial from "@/components/TimerDial";
import FocusBar from "@/components/FocusBar";
import PomoSetup from "@/components/PomoSetup";
import { SoundCenter, VolumePill } from "@/components/SoundPlayer";
import Wheel from "@/components/Wheel";
import { btnCls, Button, Panel, ProgressBar } from "@/components/ui";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };
const TYPE_BG: Record<TaskType, string> = { read: "bg-sky", flashcard: "bg-amber-retro", recall: "bg-white" };
const THRESHOLDS = [25, 50, 75, 100];

// Vị trí bong bóng quanh đồng hồ (tâm, tính theo % của sân khấu) và cỡ gốc (px).
const SLOTS = [
  { x: 30, y: 22, s: 112 },
  { x: 47, y: 9, s: 76 },
  { x: 66, y: 24, s: 128 },
  { x: 29, y: 60, s: 118 },
  { x: 72, y: 62, s: 104 },
  { x: 61, y: 90, s: 70 },
];

type View = {
  course?: Course;
  tasks: Task[];
  modules: Module[];
  session?: Session;
  pace: Pace | null;
  paceCount: number;
  xp: { total: number; today: number };
};
type Phase = "idle" | "running" | "feedback" | "rested" | "break";
interface Result {
  taskId: number;
  title: string;
  moduleTitle?: string;
  milestone: boolean;
  doneAfter: number;
  total: number;
  sessionId: number;
  sessionTasks: number;
  sessionSeconds: number;
}

function Ico({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
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
          Học thêm một hiệp
        </Button>
      </div>
    </Panel>
  );
}

const roundBtn =
  "btn-press flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink disabled:cursor-not-allowed disabled:opacity-40";

export default function NextPage() {
  const [settings, updateSettings] = useSettings();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [runningId, setRunningId] = useState<number | null>(null);
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeMs, setActiveMs] = useState(0); // đồng hồ chạy khi đang làm task (không tính lúc tạm dừng)
  const [blockOffset, setBlockOffset] = useState(0); // mốc bắt đầu của hiệp hiện tại
  const [ticking, setTicking] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [barPct, setBarPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState(false);
  const [pomoStarted, setPomoStarted] = useState(false);
  const [roundsDone, setRoundsDone] = useState(0);
  const [setup, setSetup] = useState<{ mode: "start" | "edit"; taskId: number | null } | null>(null);
  const [breakMs, setBreakMs] = useState(0);
  const [breakTotalMs, setBreakTotalMs] = useState(0);
  const activeRef = useRef(0);
  const taskStartRef = useRef(0);
  const bellRef = useRef(false);

  const cfg: PomoConfig = {
    focusMin: settings.focusMinutes,
    shortBreakMin: settings.breakMinutes,
    longBreakMin: settings.longBreakMinutes,
    rounds: settings.pomoRounds,
  };
  const blockTotalMs = cfg.focusMin * 60_000;
  const blockElapsed = Math.max(0, activeMs - blockOffset);
  const over = blockElapsed >= blockTotalMs;
  const remainingSec = Math.max(0, Math.ceil((blockTotalMs - blockElapsed) / 1000));
  const breakSec = Math.max(0, Math.ceil(breakMs / 1000));

  const view = useLiveQuery<View>(async () => {
    const [course, lastSession, paceInfo, events] = await Promise.all([
      db.courses.orderBy("createdAt").last(),
      db.sessions.orderBy("startedAt").last(),
      loadPace(),
      db.events.where("type").anyOf(["task_done", "review_done"]).toArray(),
    ]);
    const xp = sumXp(events);
    const session = isSessionActive(lastSession, Date.now()) ? lastSession : undefined;
    if (!course) return { tasks: [], modules: [], session, pace: paceInfo.pace, paceCount: paceInfo.count, xp };
    const [tasks, modules] = await Promise.all([
      db.tasks.where("courseId").equals(course.id).sortBy("order"),
      db.modules.where("courseId").equals(course.id).sortBy("order"),
    ]);
    return { course, tasks, modules, session, pace: paceInfo.pace, paceCount: paceInfo.count, xp };
  }, []);

  const finishBreak = useCallback(
    (natural: boolean) => {
      if (natural) {
        ambient.chime();
        toast("Hết giờ nghỉ. Sẵn sàng cho hiệp tiếp theo?", { ms: 8000 });
      }
      setPhase("idle");
    },
    [toast]
  );

  useEffect(() => {
    activeRef.current = activeMs;
  });

  // Đồng hồ hiệp: chỉ chạy khi đang làm task.
  useEffect(() => {
    if (!ticking) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      setActiveMs((v) => v + d);
    }, 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  // Đồng hồ nghỉ.
  useEffect(() => {
    if (phase !== "break") return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      setBreakMs((v) => Math.max(0, v - d));
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "break" && breakMs <= 0) finishBreak(true);
  }, [phase, breakMs, finishBreak]);

  // Chuông báo hết hiệp (một lần mỗi hiệp).
  useEffect(() => {
    if (phase === "running" && ticking && over && !bellRef.current) {
      bellRef.current = true;
      ambient.chime();
      toast(`Hết hiệp ${cfg.focusMin} phút. Xong task này rồi nghỉ nhé.`, { ms: 9000 });
    }
    if (!over) bellRef.current = false;
  }, [phase, ticking, over, cfg.focusMin, toast]);

  // Giờ còn lại hiện trên tiêu đề tab.
  useEffect(() => {
    if (phase === "running" && ticking) document.title = `${formatClock(remainingSec)} · Lumo`;
    else if (phase === "break") document.title = `Nghỉ ${formatClock(breakSec)} · Lumo`;
    else document.title = "Lumo";
    return () => {
      document.title = "Lumo";
    };
  }, [phase, ticking, remainingSec, breakSec]);

  if (view === undefined) return <p className="text-white/70">Đang tải...</p>;

  const { course, tasks, modules, session, pace, paceCount, xp } = view;

  if (!course) {
    return (
      <div className="mx-auto max-w-xl">
        <Panel title="Chưa có khóa học">
          <p className="mb-4">Chọn một ghi chú trong Thư viện để Luna chia việc, rồi quay lại đây để bắt đầu một hiệp.</p>
          <Link href="/plan" className={btnCls("primary")}>
            Tạo khóa học
          </Link>
        </Panel>
      </div>
    );
  }

  // ----- dữ liệu dẫn xuất -----
  const focusMod = moduleId !== null && modules.some((m) => m.id === moduleId) ? moduleId : null;
  let queue = queueFor(tasks, focusMod);
  if (queue.length === 0 && focusMod !== null) queue = queueFor(tasks, null);
  const current = pickSelected(queue, selectedId);
  const todoAll = tasks.filter((t) => t.status === "todo");
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total ? (done / total) * 100 : 0;
  const remEst = todoAll.reduce((s, t) => s + t.estMinutes, 0);
  const lv = levelInfo(xp.total);
  const goal = settings.dailyGoalXp;
  const running = runningId !== null ? tasks.find((t) => t.id === runningId) : undefined;
  const capHit = (n: number, sec: number) => n >= settings.sessionTasks || sec >= settings.sessionMinutes * 60;
  const sessionCapped = !!session && capHit(session.taskCount ?? 0, session.activeSeconds ?? 0);
  const taskSec = Math.max(0, Math.floor((activeMs - taskStartRef.current) / 1000));
  const roundText = `Hiệp ${roundNumber(roundsDone, cfg.rounds)}/${cfg.rounds}`;

  // ----- hành động -----
  function begin(t: Task) {
    ambient.unlock();
    taskStartRef.current = activeRef.current;
    setRevealed(false);
    setRunningId(t.id);
    setSelectedId(t.id);
    setPhase("running");
    setTicking(true);
    void logStart(t.id);
  }

  function requestStart(t: Task) {
    ambient.unlock();
    if (!pomoStarted) {
      setSetup({ mode: "start", taskId: t.id });
      return;
    }
    begin(t);
  }

  function confirmSetup(c: PomoConfig) {
    updateSettings({
      focusMinutes: c.focusMin,
      breakMinutes: c.shortBreakMin,
      longBreakMinutes: c.longBreakMin,
      pomoRounds: c.rounds,
    });
    const s = setup;
    setSetup(null);
    if (s?.mode === "start") {
      setPomoStarted(true);
      setRoundsDone(0);
      setBlockOffset(activeRef.current);
      const t = tasks.find((x) => x.id === s.taskId) ?? current;
      if (t) begin(t);
    }
  }

  async function finish(t: Task, outcome?: Outcome) {
    if (busy) return;
    setBusy(true);
    try {
      const seconds = (activeRef.current - taskStartRef.current) / 1000;
      const r = await completeTask(t.id, seconds, outcome);
      setTicking(false);
      if (!r) {
        setRunningId(null);
        setPhase("idle");
        return;
      }
      const before = done;
      const after = before + 1;
      const mod = modules.find((m) => m.id === t.moduleId);
      setResult({
        taskId: t.id,
        title: t.title,
        moduleTitle: mod?.title,
        milestone: t.isMilestone,
        doneAfter: after,
        total,
        sessionId: r.sessionId,
        sessionTasks: r.sessionTasks,
        sessionSeconds: r.sessionSeconds,
      });
      setSelectedId(null);
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
    setTicking(false);
    setSelectedId(null);
    setPhase("idle");
    toast(`Đã bỏ qua "${t.title}".`);
  }

  async function rest(sessionId: number | undefined) {
    if (sessionId !== undefined) await endSession(sessionId);
    setRunningId(null);
    setTicking(false);
    setPomoStarted(false);
    setRoundsDone(0);
    setBlockOffset(activeRef.current);
    setPhase("rested");
  }

  async function moreSession(sessionId: number | undefined) {
    if (sessionId !== undefined) await endSession(sessionId);
    setBlockOffset(activeRef.current);
    setRunningId(null);
    setTicking(false);
    setPhase("idle");
  }

  function startBreak() {
    const doneRounds = roundsDone + 1;
    const ms = breakMinutes(cfg, doneRounds) * 60_000;
    setRoundsDone(doneRounds);
    setBreakTotalMs(ms);
    setBreakMs(ms);
    setBlockOffset(activeRef.current);
    setRunningId(null);
    setTicking(false);
    setPhase("break");
  }

  function moreBlock() {
    setRoundsDone((r) => r + 1);
    setBlockOffset(activeRef.current);
    setRunningId(null);
    setTicking(false);
    setPhase("idle");
  }

  // ----- phần dùng chung -----
  const dialLabel = over ? "Hết hiệp" : phase === "feedback" ? "Tạm nghỉ tay" : "Sẵn sàng";

  const compact = (body: ReactNode) => (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center gap-4 pb-6">
        <TimerDial size="md" label={dialLabel} remainingSec={remainingSec} totalSec={blockTotalMs / 1000} />
      </div>
      {body}
    </div>
  );

  const breakOffer = (sessionId?: number) => {
    const doneRounds = roundsDone + 1;
    const long = isLongBreak(doneRounds, cfg.rounds);
    const mins = breakMinutes(cfg, doneRounds);
    return (
      <Panel
        title={`Hết hiệp ${roundNumber(roundsDone, cfg.rounds)}/${cfg.rounds}`}
        hint={`Bạn đã tập trung ${cfg.focusMin} phút`}
        tone="amber"
      >
        <p className="font-display text-3xl uppercase leading-tight">
          {long ? `Xong ${cfg.rounds} hiệp, nghỉ dài ${mins} phút` : `Nghỉ ${mins} phút nhé`}
        </p>
        <p className="mt-2 text-sm">Nghỉ giữa các hiệp là một phần của Pomodoro. Nếu đang có đà, bạn vẫn học thêm được.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={startBreak}>Nghỉ {mins} phút</Button>
          <Button variant="ghost" onClick={moreBlock}>
            Học thêm một hiệp
          </Button>
          {sessionId !== undefined && (
            <Button variant="ghost" onClick={() => rest(sessionId)}>
              Kết thúc phiên
            </Button>
          )}
        </div>
      </Panel>
    );
  };

  // ----- các trạng thái -----
  if (phase === "rested") {
    return compact(
      <Panel title="Hẹn gặp lại" tone="amber">
        <p className="font-display text-3xl uppercase leading-tight">Bạn đã dừng đúng lúc</p>
        {current && (
          <p className="mt-3 text-sm">
            Lần sau: &quot;{current.title}&quot;{current.teaser ? ` · ${current.teaser}` : ""}
          </p>
        )}
        <div className="mt-5">
          <Button variant="ghost" onClick={() => setPhase("idle")}>
            Quay lại phòng tập trung
          </Button>
        </div>
      </Panel>
    );
  }

  if (phase === "break") {
    const long = isLongBreak(roundsDone, cfg.rounds);
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-4 pb-6">
          <TimerDial
            size="md"
            label={long ? "Nghỉ dài" : "Nghỉ ngắn"}
            remainingSec={breakSec}
            totalSec={Math.max(1, breakTotalMs / 1000)}
          />
        </div>
        <Panel title={long ? "Nghỉ dài" : "Nghỉ ngắn"} hint={`Vừa xong hiệp ${roundsDone}`} tone="amber">
          <p className="font-display text-3xl uppercase leading-tight">Đứng dậy một chút</p>
          <p className="mt-2 text-sm">
            Uống nước, vươn vai, nhìn ra xa.
            {current ? ` Task kế tiếp: "${current.title}".` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => finishBreak(false)}>Bỏ qua nghỉ</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBreakMs((v) => v + 60_000);
                setBreakTotalMs((v) => v + 60_000);
              }}
            >
              +1 phút
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  if (phase === "running" && running) {
    const t = running;
    return (
      <div className="mx-auto max-w-4xl">
        <FocusBar
          remainingSec={remainingSec}
          totalSec={blockTotalMs / 1000}
          ticking={ticking}
          over={over}
          label={over ? "Hết hiệp, xong task này rồi nghỉ" : ticking ? "Đang tập trung" : "Tạm dừng"}
          roundText={roundText}
          onToggle={() => setTicking((v) => !v)}
        />
        <Panel
          title="Đang làm"
          hint={`${TYPE_LABEL[t.type]} · ước lượng ${t.estMinutes} phút · đã ${formatClock(taskSec)}`}
          tone="amber"
        >
          <p className="font-display text-3xl uppercase leading-tight">{t.title}</p>
          <div className="mt-4 rounded-lg border-2 border-ink bg-white p-4">
            {t.type === "read" ? (
              <div className="max-h-[62vh] overflow-auto whitespace-pre-wrap leading-relaxed">
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
      </div>
    );
  }

  if (phase === "feedback" && result) {
    const r = result;
    const nextTask = current && current.id !== r.taskId ? current : undefined;
    const pctAfter = r.total ? (r.doneAfter / r.total) * 100 : 0;
    const thr = THRESHOLDS.find((x) => x > pctAfter);
    const need = thr ? Math.ceil((r.total * thr) / 100) - r.doneAfter : 0;
    const confirmText =
      pctAfter >= 100
        ? "Bạn đã hoàn thành toàn bộ khóa học."
        : `Bạn đã hoàn thành ${Math.round(pctAfter)}% – cách mốc ${thr}% chỉ ${need} task.`;
    const capped = capHit(r.sessionTasks, r.sessionSeconds);
    const blockOver = over && !capped;
    return compact(
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
            {!capped && !blockOver && (
              <div className="mt-5 flex flex-wrap gap-3">
                {nextTask ? (
                  <Button onClick={() => begin(nextTask)}>Làm tiếp</Button>
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
            next={nextTask}
            onRest={() => rest(r.sessionId)}
            onMore={() => moreSession(r.sessionId)}
          />
        )}
        {blockOver && breakOffer(r.sessionId)}
      </div>
    );
  }

  if (!current) {
    return compact(
      <Panel title="Task kế tiếp" tone="amber">
        <p className="font-display text-3xl uppercase">Khóa học này đã xong task</p>
        <p className="mt-2 text-sm">Bạn có thể tạo khóa học mới từ tab Lộ trình, hoặc ôn lại ở tab Ôn tập.</p>
      </Panel>
    );
  }

  if (session && sessionCapped) {
    return compact(
      <StopPanel
        doneCount={session.taskCount ?? 0}
        seconds={session.activeSeconds ?? 0}
        next={current}
        onRest={() => rest(session.id)}
        onMore={() => moreSession(session.id)}
      />
    );
  }

  if (over && pomoStarted) {
    return compact(breakOffer(session?.id));
  }

  // ----- phòng tập trung -----
  const mod = modules.find((m) => m.id === current.moduleId);
  const left = todoAll.filter((t) => t.moduleId === current.moduleId).length;
  const upcoming = upcomingOf(queue, current, 6);
  const prevT = stepTask(queue, current, -1);
  const nextT = stepTask(queue, current, 1);

  let hope = `Task này khoảng ${current.estMinutes} phút, trong tổng ${remEst} phút còn lại.`;
  if (pace) {
    const b = etaDays(remEst, pace);
    const a = etaDays(remEst - current.estMinutes, pace);
    hope =
      b - a >= 1
        ? `Hoàn thành task này → khóa học xong sớm hơn khoảng ${b - a} ngày.`
        : `Hoàn thành task này → còn lại khoảng ${Math.max(0, Math.round((remEst - current.estMinutes) * pace.ratio))} phút học.`;
  }

  const moduleItems = [
    { key: "all", label: "Tất cả module" },
    ...modules.map((m) => ({ key: m.id, label: m.title })),
  ];
  const moduleIndex = focusMod === null ? 0 : 1 + modules.findIndex((m) => m.id === focusMod);
  const blockItems = BLOCK_OPTIONS.map((m) => ({ key: m, label: `${m} phút` }));
  const blockIndex = Math.max(0, BLOCK_OPTIONS.indexOf(cfg.focusMin));
  const selCls = "rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm text-ink";

  return (
    <div>
      {setup && (
        <PomoSetup initial={cfg} mode={setup.mode} onConfirm={confirmSetup} onClose={() => setSetup(null)} />
      )}

      {/* Chọn nhanh trên màn hẹp (bánh xe chỉ có từ 1024px) */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3 lg:hidden">
        <select
          aria-label="Module"
          className={selCls}
          value={focusMod ?? "all"}
          onChange={(e) => {
            const v = e.target.value;
            setModuleId(v === "all" ? null : Number(v));
            setSelectedId(null);
          }}
        >
          <option value="all">Tất cả module</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Độ dài hiệp"
          className={selCls}
          value={cfg.focusMin}
          onChange={(e) => updateSettings({ focusMinutes: Number(e.target.value) })}
        >
          {BLOCK_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} phút
            </option>
          ))}
        </select>
      </div>

      {/* Sân khấu: đồng hồ ở giữa, hai bánh xe hai bên, bong bóng task bay quanh */}
      <div className="relative mx-auto w-full max-w-[1100px] lg:h-[600px]">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
          <div className="absolute left-1/2 top-[55%] h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-[55%] h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
        </div>

        <div className="absolute left-0 top-[55%] hidden -translate-y-1/2 lg:block">
          <Wheel
            side="left"
            label="Chọn module"
            items={moduleItems}
            index={moduleIndex}
            onChange={(i) => {
              setModuleId(i === 0 ? null : modules[i - 1].id);
              setSelectedId(null);
            }}
          />
        </div>
        <div className="absolute right-0 top-[55%] hidden -translate-y-1/2 lg:block">
          <Wheel
            side="right"
            label="Chọn độ dài hiệp"
            items={blockItems}
            index={blockIndex}
            onChange={(i) => updateSettings({ focusMinutes: BLOCK_OPTIONS[i] })}
          />
        </div>

        <div className="flex justify-center pt-2 lg:absolute lg:left-1/2 lg:top-[55%] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:pt-0">
          <TimerDial size="lg" label={dialLabel} remainingSec={remainingSec} totalSec={blockTotalMs / 1000} />
        </div>

        {upcoming.map((t, i) => {
          const slot = SLOTS[i];
          if (!slot) return null;
          const size = Math.round(slot.s * (0.85 + Math.min(5, t.estMinutes) * 0.06));
          return (
            <div
              key={t.id}
              className="group absolute hidden lg:block"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
              }}
            >
              {t.isMilestone && (
                <span className="absolute -left-2 -top-3 z-10 rounded-full bg-amber-retro px-2 py-0.5 text-[11px] font-bold text-ink">
                  ◆ Mốc
                </span>
              )}
              <button
                type="button"
                aria-label={`Bắt đầu: ${t.title}`}
                title="Bắt đầu task này"
                onClick={() => requestStart(t)}
                className="absolute -top-11 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-white text-ink opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Ico className="h-4 w-4">
                  <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
                </Ico>
              </button>
              <div className="bob h-full w-full" style={{ animationDelay: `${-i * 1.1}s` }}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  title={t.title}
                  className={`flex h-full w-full flex-col items-center justify-center rounded-full border border-white/30 p-2 text-center text-ink transition-transform duration-200 hover:scale-110 ${TYPE_BG[t.type]}`}
                >
                  {size >= 90 && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide">{TYPE_LABEL[t.type]}</span>
                  )}
                  <span className="font-display text-2xl leading-none">{t.estMinutes}&apos;</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dải chip task kế tiếp trên màn hẹp */}
      {upcoming.length > 0 && (
        <ul className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {upcoming.map((t) => (
            <li key={t.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`rounded-full border-2 border-ink px-3 py-1.5 text-xs font-semibold text-ink ${TYPE_BG[t.type]}`}
              >
                {TYPE_LABEL[t.type]} · {t.estMinutes}&apos;
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Task đang chọn và nút bắt đầu học */}
      <div className="mx-auto mt-2 w-full max-w-2xl text-center">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Task trước"
            disabled={!prevT}
            onClick={() => prevT && setSelectedId(prevT.id)}
            className="rounded-full p-2 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Ico className="h-6 w-6">
              <path d="M6 5v14M19 5L9 12l10 7z" />
            </Ico>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-3xl uppercase text-white">{current.title}</p>
            <p className="mt-1 truncate text-sm text-white/60">
              {mod?.title ?? course.title} · {TYPE_LABEL[current.type]} · khoảng {current.estMinutes} phút
              {current.isMilestone ? " · mốc" : ""}
            </p>
            {current.teaser && <p className="mt-1 truncate text-sm text-white/70">{current.teaser}</p>}
          </div>
          <button
            type="button"
            aria-label="Task sau"
            disabled={!nextT}
            onClick={() => nextT && setSelectedId(nextT.id)}
            className="rounded-full p-2 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Ico className="h-6 w-6">
              <path d="M18 5v14M5 5l10 7-10 7z" />
            </Ico>
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => requestStart(current)}
            className="btn-press rounded-full bg-amber-retro px-10 py-3 font-display text-xl uppercase tracking-wide text-ink"
          >
            Bắt đầu học
          </button>
          <button
            type="button"
            onClick={() => setSetup({ mode: "edit", taskId: null })}
            className="text-xs text-white/60 underline hover:text-white"
          >
            Thiết lập hiệp · {describeConfig(cfg)}
          </button>
        </div>

        <p className="mt-3 text-sm font-semibold text-sky">{hope}</p>

        <div className="mx-auto mt-3 w-full max-w-sm">
          <p className="text-sm text-white/80">
            Còn <CountUp value={left} /> task nữa là xong {mod ? `"${mod.title}"` : "module này"}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-sky transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-white/60">
            {course.title} · {done}/{total} task · Cấp {lv.level} {lv.title} · {xp.today}/{goal} XP hôm nay
          </p>
        </div>

        <button
          type="button"
          onClick={() => setWhy((v) => !v)}
          aria-expanded={why}
          className="mt-3 text-xs text-white/60 underline hover:text-white"
        >
          {why ? "Ẩn chi tiết" : "Vì sao Luna chọn task này? · ngày hoàn thành dự kiến"}
        </button>
        {why && (
          <div className="fade-in mt-3 space-y-2 rounded-xl border border-white/20 bg-white/5 p-4 text-left text-sm text-white/80">
            <p>
              Hiện Luna chọn task đầu tiên chưa làm theo thứ tự khóa học (bạn có thể chọn module bằng bánh xe trái, hoặc
              bấm bong bóng để đổi task). Công thức chấm điểm (độ gần mốc, đa dạng loại task, độ quên, thời lượng còn lại)
              sẽ có ở bước sau.
            </p>
            {current.reason && <p>Cách chia task này: {current.reason}</p>}
            <p>
              <span className="font-semibold text-white">Ngày hoàn thành dự kiến:</span> {etaText(remEst, pace, paceCount)}
            </p>
            <p>
              Giới hạn mềm mỗi phiên: {settings.sessionMinutes} phút hoặc {settings.sessionTasks} task, chỉnh ở Cài đặt.
            </p>
          </div>
        )}
      </div>

      {/* Thanh dưới: âm lượng, trình phát âm thanh nền, lối tắt */}
      <div className="relative mx-auto mt-10 w-full max-w-[1100px] pb-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[16%] top-7 hidden h-48 rounded-t-[50%] border-t border-white/15 lg:block"
        />
        <div className="relative grid items-end gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex justify-center lg:justify-start">
            <VolumePill />
          </div>
          <SoundCenter />
          <div className="flex justify-center lg:justify-end">
            <div className="flex items-center gap-2 rounded-full bg-white/10 p-2">
              <Link href="/plan" aria-label="Mở Lộ trình" title="Lộ trình" className={roundBtn}>
                <Ico>
                  <path d="M5 6h14M5 12h14M5 18h9" />
                </Ico>
              </Link>
              <Link href="/review" aria-label="Mở Ôn tập" title="Ôn tập" className={roundBtn}>
                <Ico>
                  <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
                </Ico>
              </Link>
              <button
                type="button"
                aria-label="Bỏ qua task này"
                title="Bỏ qua task này"
                onClick={() => skip(current)}
                className={roundBtn}
              >
                <Ico>
                  <path d="M5 5l9 7-9 7zM18 5v14" />
                </Ico>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}