"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/Dialog";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Course, type Module, type Session, type Task, type TaskType } from "@/lib/db";
import { completeTask, endSession, isSessionActive, logStart, skipTask, type Outcome } from "@/lib/learning";
import { formatClock, pickSelected, queueFor, stepTask } from "@/lib/focus";
import { breakMinutes, isLongBreak, roundNumber } from "@/lib/pomodoro";
import { STUDY_KEYS, ssDel, ssGet } from "@/lib/studyflow";
import { usePomo } from "@/lib/usePomo";
import { useAutoSound } from "@/lib/audioSource";
import { ambient, celebrate } from "@/lib/ambient";
import { useToast } from "@/components/Toast";
import CountUp from "@/components/CountUp";
import Celebrate from "@/components/Celebrate";
import { isCheckpoint, moduleProgress } from "@/lib/progress";
import FocusConsole, { Ico, toolBtn } from "@/components/FocusConsole";
import MiniHud from "@/components/MiniHud";
import PomoSetup from "@/components/PomoSetup";
import StudyFrame, { type Scene } from "@/components/StudyFrame";
import type { Mood } from "@/components/GlassBackdrop";
import { btnCls, Button, Panel, ProgressBar } from "@/components/ui";

const TYPE_LABEL: Record<TaskType, string> = { read: "Đọc", flashcard: "Flashcard", recall: "Nhớ lại" };
const THRESHOLDS = [25, 50, 75, 100];

type View = { course?: Course; tasks: Task[]; modules: Module[]; session?: Session };
type Phase = "ready" | "running" | "feedback" | "rested";
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
  moduleDone: number;
  moduleTotal: number;
  moduleLeft: number;
  toMilestone: number | null;
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

export default function StudyPage() {
  const router = useRouter();
  const dialog = useDialog();
  const toast = useToast();
  const pomo = usePomo({
    onBlockOver: () => toast("Hết hiệp. Xong task này rồi nghỉ nhé.", { ms: 9000 }),
  });
  const { cfg, settings } = pomo;
  useAutoSound(pomo.ticking, settings.autoSound);
  const [phase, setPhase] = useState<Phase>("ready");
  const [scene, setScene] = useState<Scene>("dial");
  const [runningId, setRunningId] = useState<number | null>(null);
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [booted, setBooted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  // Mỗi khi sang task mới: ẩn đáp án và xóa ô nhập (tránh lộ đáp án của task trước)
  useEffect(() => {
    setRevealed(false);
    setDraft("");
    setPicked([]);
  }, [runningId]);
  const [result, setResult] = useState<Result | null>(null);
  const [barPct, setBarPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const taskStartRef = useRef(0);
  const initRef = useRef(false);

  const view = useLiveQuery<View>(async () => {
    const [course, lastSession] = await Promise.all([
      db.courses.orderBy("createdAt").last(),
      db.sessions.orderBy("startedAt").last(),
    ]);
    const session = isSessionActive(lastSession, Date.now()) ? lastSession : undefined;
    if (!course) return { tasks: [], modules: [], session };
    const [tasks, modules] = await Promise.all([
      db.tasks.where("courseId").equals(course.id).sortBy("order"),
      db.modules.where("courseId").equals(course.id).sortBy("order"),
    ]);
    return { course, tasks, modules, session };
  }, []);

  const tasks = view?.tasks ?? [];
  const modules = view?.modules ?? [];
  const course = view?.course;
  const session = view?.session;
  const focusMod = moduleId !== null && modules.some((m) => m.id === moduleId) ? moduleId : null;
  let queue = queueFor(tasks, focusMod);
  if (queue.length === 0 && focusMod !== null) queue = queueFor(tasks, null);
  const current = pickSelected(queue, selectedId);
  const canLearn = (phase === "running" || phase === "feedback" || phase === "rested") && !pomo.onBreak;
  const mood: Mood = pomo.onBreak ? "break" : phase === "running" && pomo.ticking ? "focus" : "idle";

  // Đọc module và task đã chọn ở trang chuẩn bị (Next Up).
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const m = ssGet(STUDY_KEYS.module);
    const t = ssGet(STUDY_KEYS.task);
    ssDel(STUDY_KEYS.go);
    ssDel(STUDY_KEYS.module);
    ssDel(STUDY_KEYS.task);
    setModuleId(m ? Number(m) : null);
    setSelectedId(t ? Number(t) : null);
    setBooted(true);
  }, []);

  // Cảnh học trống thì quay về đồng hồ.
  useEffect(() => {
    if (scene === "learn" && !canLearn) setScene("dial");
  }, [scene, canLearn]);

  // ----- hành động -----
  function begin(t: Task) {
    ambient.unlock();
    taskStartRef.current = pomo.activeRef.current;
    setRevealed(false);
    setRunningId(t.id);
    setSelectedId(t.id);
    setPhase("running");
    pomo.setTicking(true);
    setScene("learn");
    void logStart(t.id);
  }

  function onMain() {
    ambient.unlock();
    if (pomo.onBreak) {
      pomo.skipBreak();
      return;
    }
    if (phase === "running") {
      if (pomo.ticking) pomo.setTicking(false);
      else {
        pomo.setTicking(true);
        setScene("learn");
      }
      return;
    }
    if (current) begin(current);
  }

  async function onExit() {
    if (phase === "running") {
      const leave = await dialog.confirm({
        title: "Thoát giữa chừng?",
        message: "Task đang làm sẽ không được lưu.",
        confirmLabel: "Thoát",
        cancelLabel: "Ở lại học",
        danger: true,
      });
      if (!leave) return;
    }
    router.push("/next");
  }

  async function finish(t: Task, outcome?: Outcome) {
    if (busy) return;
    setBusy(true);
    try {
      const seconds = (pomo.activeRef.current - taskStartRef.current) / 1000;
      const r = await completeTask(t.id, seconds, outcome);
      pomo.setTicking(false);
      if (!r) {
        setRunningId(null);
        setPhase("ready");
        setScene("dial");
        return;
      }
      const totalTasks = tasks.length;
      const before = tasks.filter((x) => x.status === "done").length;
      const after = before + 1;
      const mod = modules.find((m) => m.id === t.moduleId);
      const tasksAfter = tasks.map((x) => (x.id === t.id ? { ...x, status: "done" as const } : x));
      const mpBefore = moduleProgress(tasks, t.moduleId);
      const mpAfter = moduleProgress(tasksAfter, t.moduleId);
      const capNow = r.sessionTasks >= settings.sessionTasks || r.sessionSeconds >= settings.sessionMinutes * 60;
      const checkpoint = isCheckpoint({
        sessionTasks: r.sessionTasks,
        every: settings.checkpointEvery,
        moduleCompleted: mpAfter.left === 0,
        milestoneHit: t.isMilestone,
      });
      const todoRest = tasks.filter((x) => x.status === "todo" && x.id !== t.id).sort((a, b) => a.order - b.order);
      const nextQuiet = (moduleId === null ? todoRest : todoRest.filter((x) => x.moduleId === moduleId))[0] ?? todoRest[0];
      if (!checkpoint && !capNow && !pomo.over && nextQuiet) {
        toast(`✓ ${mpAfter.done}/${mpAfter.total} trong "${mod?.title ?? "module"}"`, { ms: 1800 });
        begin(nextQuiet);
        return;
      }
      setResult({
        taskId: t.id,
        title: t.title,
        moduleTitle: mod?.title,
        milestone: t.isMilestone,
        doneAfter: after,
        total: totalTasks,
        sessionId: r.sessionId,
        sessionTasks: r.sessionTasks,
        sessionSeconds: r.sessionSeconds,
        moduleDone: mpAfter.done,
        moduleTotal: mpAfter.total,
        moduleLeft: mpAfter.left,
        toMilestone: mpAfter.toMilestone,
      });
      setSelectedId(null);
      setBarPct(mpBefore.total ? (mpBefore.done / mpBefore.total) * 100 : 0);
      setPhase("feedback");
      celebrate(t.isMilestone);
      setCelebrateKey((k) => k + 1);
      window.setTimeout(() => setBarPct(mpAfter.total ? (mpAfter.done / mpAfter.total) * 100 : 0), 80);
    } catch {
      toast("Không lưu được kết quả. Thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function skip(t: Task) {
    await skipTask(t.id);
    setRunningId(null);
    pomo.setTicking(false);
    setSelectedId(null);
    setPhase("ready");
    setScene("dial");
    toast(`Đã bỏ qua "${t.title}".`);
  }

  async function rest(sessionId: number | undefined) {
    if (sessionId !== undefined) await endSession(sessionId);
    setRunningId(null);
    pomo.endRun();
    setPhase("rested");
    setScene("learn");
  }

  async function moreSession(sessionId: number | undefined) {
    if (sessionId !== undefined) await endSession(sessionId);
    pomo.newBlock();
    setRunningId(null);
    pomo.setTicking(false);
    setPhase("ready");
    setScene("dial");
  }

  function takeBreak() {
    pomo.startBreak();
    setRunningId(null);
    setPhase("ready");
    setScene("dial");
  }

  function moreBlock() {
    pomo.moreBlock();
    setRunningId(null);
    setPhase("ready");
    setScene("dial");
  }

  if (view === undefined || !booted) {
    return <p className="pt-24 text-center text-white/70">Đang chuẩn bị phòng học...</p>;
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-24">
        <Panel title="Chưa có khóa học">
          <p className="mb-4">Chọn một ghi chú trong Thư viện để Luna chia việc, rồi quay lại để bắt đầu học.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/plan" className={btnCls("primary")}>
              Tạo khóa học
            </Link>
            <Link href="/next" className={btnCls("ghost")}>
              Về trang chuẩn bị
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const running = runningId !== null ? tasks.find((t) => t.id === runningId) : undefined;
  const capHit = (n: number, sec: number) => n >= settings.sessionTasks || sec >= settings.sessionMinutes * 60;
  const taskSec = Math.max(0, Math.floor((pomo.activeRef.current - taskStartRef.current) / 1000));
  const roundText = `Hiệp ${roundNumber(pomo.roundsDone, cfg.rounds)}/${cfg.rounds}`;
  const prevT = stepTask(queue, current, -1);
  const nextT = stepTask(queue, current, 1);
  const mod = current ? modules.find((m) => m.id === current.moduleId) : undefined;

  const breakOffer = (sessionId?: number) => {
    const doneRounds = pomo.roundsDone + 1;
    const long = isLongBreak(doneRounds, cfg.rounds);
    const mins = breakMinutes(cfg, doneRounds);
    return (
      <Panel
        title={`Hết hiệp ${roundNumber(pomo.roundsDone, cfg.rounds)}/${cfg.rounds}`}
        hint={`Bạn đã tập trung ${cfg.focusMin} phút`}
        tone="amber"
      >
        <p className="font-display text-3xl uppercase leading-tight">
          {long ? `Xong ${cfg.rounds} hiệp, nghỉ dài ${mins} phút` : `Nghỉ ${mins} phút nhé`}
        </p>
        <p className="mt-2 text-sm">Nghỉ giữa các hiệp là một phần của Pomodoro. Nếu đang có đà, bạn vẫn học thêm được.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={takeBreak}>Nghỉ {mins} phút</Button>
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

  // ----- cảnh học -----
  let learn: ReactNode = null;

  if (phase === "running" && running) {
    const t = running;
    learn = (
      <>
        {pomo.over && (
          <div className="mb-4 rounded-xl border-2 border-ink bg-amber-retro p-3 text-sm font-semibold text-ink">
            Hết hiệp {cfg.focusMin} phút. Xong task này rồi nghỉ nhé.
          </div>
        )}
        <Panel
          title="Đang làm"
          hint={`${TYPE_LABEL[t.type]} · ước lượng ${t.estMinutes} phút · đã ${formatClock(taskSec)} · ${roundText}`}
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
                {t.options && t.options.length > 0 && (() => {
                  const correct = t.correct ?? [];
                  const good = picked.filter((p) => correct.includes(p));
                  const wrong = picked.filter((p) => !correct.includes(p));
                  const missed = correct.filter((x) => !picked.includes(x));
                  const names = (idxs: number[]) => idxs.map((i) => t.options![i]).join(", ");
                  return (
                    <div className="mt-3 flex flex-col gap-2">
                      {correct.length > 1 && !revealed && (
                        <p className="text-sm text-neutral-500">Chọn {correct.length} đáp án</p>
                      )}
                      {t.options.map((opt, i) => {
                        const isPicked = picked.includes(i);
                        const isRight = correct.includes(i);
                        let cls = isPicked ? "bg-sky/40" : "bg-white";
                        let tag = "";
                        if (revealed) {
                          if (isPicked && isRight) {
                            cls = "bg-[#bbf7d0]";
                            tag = "Bạn chọn · Đúng";
                          } else if (isPicked) {
                            cls = "bg-[#fecaca]";
                            tag = "Bạn chọn · Sai";
                          } else if (isRight) {
                            cls = "border-dashed bg-[#f0fdf4]";
                            tag = "Đáp án đúng · bạn bỏ sót";
                          } else {
                            cls = "bg-white opacity-50";
                          }
                        }
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={revealed}
                            onClick={() =>
                              setPicked((cur) =>
                                correct.length > 1 ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : [i],
                              )
                            }
                            className={`flex items-center justify-between gap-3 rounded-lg border-2 border-ink px-4 py-2 text-left text-base font-semibold ${cls}`}
                          >
                            <span>{opt}</span>
                            {tag && <span className="shrink-0 text-xs font-semibold">{tag}</span>}
                          </button>
                        );
                      })}
                      {revealed && (
                        <p className="text-sm font-semibold">
                          {wrong.length === 0 && missed.length === 0
                            ? "Bạn chọn đúng hết."
                            : `Đúng ${good.length}/${correct.length}.` +
                              (wrong.length ? ` Chọn sai: ${names(wrong)}.` : "") +
                              (missed.length ? ` Bỏ sót: ${names(missed)}.` : "")}
                        </p>
                      )}
                    </div>
                  );
                })()}
                {!revealed && !t.options?.length && (
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={1}
                    placeholder={t.type === "recall" ? "Gõ 2–3 từ khóa bạn nhớ rồi bấm Hiện đáp án" : "Điền từ còn thiếu rồi bấm Hiện đáp án"}
                    className="mt-3 w-full rounded-lg border-2 border-ink bg-white p-3 text-base"
                  />
                )}
                {revealed && draft.trim() && (
                  <p className="mt-3 rounded-lg border-2 border-ink bg-white p-3 text-sm">
                    <span className="font-semibold">Bạn viết: </span>
                    {draft.trim()}
                  </p>
                )}
                {revealed && (
                  <p className="fade-in mt-4 whitespace-pre-wrap rounded-lg border-2 border-ink bg-sky/40 p-3 text-sm">
                    {(t.options?.length ? (t.answer ?? "").split("\n\n").slice(1).join("\n\n") : t.answer) || "(Không có đáp án gợi ý cho task này.)"}
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
              <Button disabled={!!t.options?.length && picked.length === 0} onClick={() => setRevealed(true)}>Hiện đáp án</Button>
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
      </>
    );
  } else if (phase === "feedback" && result) {
    const r = result;
    const nextTask = current && current.id !== r.taskId ? current : undefined;
    const pctAfter = r.moduleTotal ? (r.moduleDone / r.moduleTotal) * 100 : 0;
    const modLeftText =
      r.moduleLeft === 0
        ? "Bạn đã hoàn thành module này."
        : r.toMilestone !== null
          ? `Còn ${r.toMilestone} task nữa là tới mốc của module.`
          : `Còn ${r.moduleLeft} task nữa là xong module.`;
    const courseText = `Cả khóa học: ${r.doneAfter}/${r.total} task (${Math.round(r.total ? (r.doneAfter / r.total) * 100 : 0)}%).`;
    const confirmText =
      r.doneAfter >= r.total
        ? "Bạn đã hoàn thành toàn bộ khóa học."
        : modLeftText;
    const capped = capHit(r.sessionTasks, r.sessionSeconds);
    const blockOver = pomo.over && !capped;
    learn = (
      <div className="space-y-6">
        <div className="relative">
          {r.milestone && <Burst />}
          <Panel title={r.milestone ? "Đạt mốc!" : "Xong!"} hint={r.title} tone="amber">
            <p className="font-display text-6xl leading-none">
              <CountUp value={Math.round(pctAfter)} suffix="%" />
            </p>
            <div className="mt-3">
              <ProgressBar value={barPct} label={`${r.moduleDone}/${r.moduleTotal} task · ${r.moduleTitle ?? "module này"}`} />
            </div>
            <p className="mt-3 font-display text-lg uppercase">{confirmText}</p>
            <p className="mt-2 text-xs">{courseText}</p>
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
  } else if (phase === "rested") {
    learn = (
      <Panel title="Hẹn gặp lại" tone="amber">
        <p className="font-display text-3xl uppercase leading-tight">Bạn đã dừng đúng lúc</p>
        {current && (
          <p className="mt-3 text-sm">
            Lần sau: &quot;{current.title}&quot;{current.teaser ? ` · ${current.teaser}` : ""}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => router.push("/next")}>Về trang chuẩn bị</Button>
          <Button variant="ghost" onClick={() => setScene("dial")}>
            Về đồng hồ
          </Button>
        </div>
      </Panel>
    );
  }

  // ----- cảnh đồng hồ -----
  const long = isLongBreak(pomo.roundsDone, cfg.rounds);
  const dialLabel = pomo.onBreak
    ? long
      ? "Nghỉ dài"
      : "Nghỉ ngắn"
    : phase === "running"
      ? pomo.ticking
        ? "Đang tập trung"
        : "Tạm dừng"
      : pomo.over
        ? "Hết hiệp"
        : "Sẵn sàng";

  const mainIcon = pomo.onBreak ? "skip" : phase === "running" && pomo.ticking ? "pause" : "play";
  const mainLabel = pomo.onBreak
    ? "Bỏ qua nghỉ"
    : phase === "running"
      ? pomo.ticking
        ? "Tạm dừng"
        : "Tiếp tục"
      : "Bắt đầu học";

  const title = pomo.onBreak ? "Đang nghỉ" : current ? current.title : "Đã xong mọi task";
  const subtitle = pomo.onBreak
    ? current
      ? `Task kế tiếp: ${current.title}`
      : "Đứng dậy một chút"
    : current
      ? `${mod?.title ?? course.title} · ${TYPE_LABEL[current.type]} · khoảng ${current.estMinutes} phút`
      : "Về trang chuẩn bị hoặc vào ôn tập";

  const canStep = phase !== "running" && !pomo.onBreak;

  const tools = (
    <>
      <button
        type="button"
        aria-label="Bỏ qua task này"
        title="Bỏ qua task này"
        disabled={!current || phase === "running" || pomo.onBreak}
        onClick={() => current && skip(current)}
        className={toolBtn}
      >
        <Ico className="h-4 w-4">
          <path d="M5 5l9 7-9 7zM18 5v14" />
        </Ico>
      </button>
      <Link href="/study/review" aria-label="Vào ôn tập" title="Vào ôn tập" className={toolBtn}>
        <Ico className="h-4 w-4">
          <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
        </Ico>
      </Link>
    </>
  );

  const dial = (
    <div className="absolute inset-0 flex items-center justify-center px-4 pb-4 pt-[76px]">
      <FocusConsole
        label={dialLabel}
        roundText={roundText}
        running={pomo.ticking}
        remainingSec={pomo.onBreak ? pomo.breakSec : pomo.remainingSec}
        totalSec={pomo.onBreak ? Math.max(1, pomo.breakTotalMs / 1000) : pomo.blockTotalMs / 1000}
        focusMin={cfg.focusMin}
        focusLocked={phase === "running" || pomo.onBreak}
        onFocusMin={(m) => pomo.updateSettings({ focusMinutes: m })}
        onSetup={() => setShowSetup(true)}
        mainIcon={mainIcon}
        mainLabel={mainLabel}
        onMain={onMain}
        mainDisabled={!pomo.onBreak && phase !== "running" && !current}
        title={title}
        subtitle={subtitle}
        onPrev={canStep && prevT ? () => setSelectedId(prevT.id) : undefined}
        onNext={canStep && nextT ? () => setSelectedId(nextT.id) : undefined}
        tools={tools}
        canLearn={canLearn}
        onLearn={() => setScene("learn")}
      />
    </div>
  );

  return (
    <>
      {showSetup && (
        <PomoSetup
          initial={cfg}
          mode="edit"
          onConfirm={(c) => {
            pomo.updateSettings({
              focusMinutes: c.focusMin,
              breakMinutes: c.shortBreakMin,
              longBreakMinutes: c.longBreakMin,
              pomoRounds: c.rounds,
            });
            setShowSetup(false);
          }}
          onClose={() => setShowSetup(false)}
        />
      )}
      {pomo.onBreak && scene === "dial" && (
        <div className="fixed bottom-6 left-6 z-30">
          <button
            type="button"
            onClick={pomo.extendBreak}
            className="rounded-full border border-white/30 bg-[#070b24]/80 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
          >
            +1 phút nghỉ
          </button>
        </div>
      )}
      {celebrateKey > 0 && <Celebrate key={celebrateKey} big={!!result?.milestone} />}
      <StudyFrame
        scene={scene}
        onScene={setScene}
        canLearn={canLearn}
        modeLabel="Chế độ học"
        mood={mood}
        headerCenter={
          <MiniHud
            remainingSec={pomo.remainingSec}
            totalSec={pomo.blockTotalMs / 1000}
            ticking={pomo.ticking}
            over={pomo.over}
            onToggle={() => pomo.setTicking(!pomo.ticking)}
          />
        }
        onExit={onExit}
        dial={dial}
        learn={learn}
      />
    </>
  );
}