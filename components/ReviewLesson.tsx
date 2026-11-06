"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { checkTyped, generateQuestions, type Card, type Question } from "@/lib/quiz";
import { activityTimestamps, recordCard, recordSessionDone } from "@/lib/review";
import { computeStreak } from "@/lib/streak";
import CountUp from "@/components/CountUp";
import { Button, Panel, ProgressBar, inputCls } from "@/components/ui";

type Phase = "lesson" | "result";
type Status = "answering" | "right" | "wrong";

function ResultView({
  xp,
  firstTry,
  total,
  practice,
  onExit,
}: {
  xp: number;
  firstTry: number;
  total: number;
  practice: boolean;
  onExit: () => void;
}) {
  const info = useLiveQuery(async () => computeStreak(await activityTimestamps()), []);
  return (
    <div className="mx-auto max-w-2xl">
      <Panel title="Hoàn thành bài ôn" hint={practice ? "Luyện tập thêm" : "Ôn theo lịch"} tone="amber">
        <p className="font-display text-6xl leading-none">
          <CountUp value={xp} suffix=" XP" />
        </p>
        <p className="mt-3 font-display text-lg uppercase">
          {firstTry}/{total} thẻ đúng ngay lần đầu
        </p>
        {info && (
          <p className="mt-1 text-sm">
            Chuỗi ngày học: {info.streak} ngày liên tiếp · ngày nghỉ dự trữ: {info.freezes}/2
          </p>
        )}
        {!practice && <p className="mt-1 text-sm">Lịch ôn của các thẻ đã được cập nhật.</p>}
        <div className="mt-5">
          <Button onClick={onExit}>Xong</Button>
        </div>
      </Panel>
    </div>
  );
}

export default function ReviewLesson({
  cards,
  corpus,
  practice,
  onExit,
}: {
  cards: Card[];
  corpus: string[];
  practice: boolean;
  onExit: () => void;
}) {
  const [questions] = useState<Question[]>(() => generateQuestions(cards, corpus, Date.now() % 1_000_000));
  const [queue, setQueue] = useState<number[]>(() => questions.map((_, i) => i));
  const [phase, setPhase] = useState<Phase>("lesson");
  const [status, setStatus] = useState<Status>("answering");
  const [doneCount, setDoneCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const failed = useRef<Set<number>>(new Set());
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handlers = useRef<{ primary: () => void; pick: (i: number) => void }>({
    primary: () => {},
    pick: () => {},
  });

  const q: Question | undefined = queue.length ? questions[queue[0]] : undefined;

  function resetInputs() {
    setStatus("answering");
    setSelected(null);
    setTapped([]);
    setTyped("");
    setRevealed(false);
  }

  function check(correct: boolean) {
    if (status !== "answering" || queue.length === 0) return;
    if (!correct) failed.current.add(queue[0]);
    setStatus(correct ? "right" : "wrong");
  }

  async function next() {
    if (busy.current || queue.length === 0) return;
    busy.current = true;
    try {
      const qi = queue[0];
      if (status === "right") {
        const hadMiss = failed.current.has(qi);
        await recordCard(questions[qi].taskId, hadMiss ? "again" : "good", practice);
        const newXp = xp + (hadMiss ? 5 : 10);
        const newFirst = firstTry + (hadMiss ? 0 : 1);
        setXp(newXp);
        setFirstTry(newFirst);
        setDoneCount((n) => n + 1);
        const rest = queue.slice(1);
        setQueue(rest);
        if (rest.length === 0) {
          await recordSessionDone({ xp: newXp, firstTry: newFirst, total: questions.length, practice });
          setPhase("result");
        }
      } else {
        setQueue([...queue.slice(1), qi]);
      }
      resetInputs();
    } finally {
      busy.current = false;
    }
  }

  function primary() {
    if (phase !== "lesson" || !q) return;
    if (status !== "answering") {
      void next();
      return;
    }
    if (q.kind === "choice") {
      if (selected !== null) check(selected === q.correct);
    } else if (q.kind === "reorder") {
      if (tapped.length === q.target.length) check(tapped.every((wi, k) => q.words[wi] === q.target[k]));
    } else if (q.kind === "type") {
      if (typed.trim()) check(checkTyped(typed, q.answerText));
    } else if (!revealed) {
      setRevealed(true);
    }
  }

  function pick(i: number) {
    if (status === "answering" && q?.kind === "choice" && i < q.options.length) setSelected(i);
  }

  useEffect(() => {
    handlers.current = { primary, pick };
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (document.documentElement.dataset.studyScene === "dial") return;
      if (e.key === "Enter") {
        if (e.repeat) return;
        e.preventDefault();
        handlers.current.primary();
        return;
      }
      if (/^[1-4]$/.test(e.key)) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        handlers.current.pick(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (q?.kind === "type" && status === "answering") inputRef.current?.focus();
  }, [queue, status, q?.kind]);

  if (phase === "result") {
    return <ResultView xp={xp} firstTry={firstTry} total={questions.length} practice={practice} onExit={onExit} />;
  }
  if (!q) return null;

  const canCheck =
    q.kind === "choice"
      ? selected !== null
      : q.kind === "reorder"
        ? tapped.length === q.target.length
        : q.kind === "type"
          ? typed.trim() !== ""
          : false;
  const lastOne = queue.length === 1 && status === "right";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Thoát bài ôn"
          className="btn-press rounded-full bg-white px-3.5 py-1.5 text-lg font-bold leading-none"
        >
          ×
        </button>
        <div className="flex-1">
          <ProgressBar value={(doneCount / questions.length) * 100} />
        </div>
        <span className="font-display text-lg uppercase">{xp} XP</span>
      </div>

      <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {practice ? "Luyện tập thêm · không đổi lịch ôn" : "Ôn theo lịch"} · {q.title}
      </p>

      <div className={`rounded-xl border-2 border-ink bg-white p-5 ${status === "wrong" ? "shake" : ""}`}>
        {q.kind === "choice" && (
          <>
            <p className="mb-1 text-sm font-semibold text-neutral-600">
              {q.family === "upper" ? "Chọn từ khóa còn thiếu" : "Chọn từ còn thiếu"}
            </p>
            <p className="mb-4 text-xl leading-relaxed">{q.prompt}</p>
            <ul className="space-y-2">
              {q.options.map((o, i) => {
                const cls =
                  status === "answering"
                    ? selected === i
                      ? "bg-sky"
                      : "bg-white hover:bg-sky/40"
                    : i === q.correct
                      ? "bg-emerald-200"
                      : selected === i
                        ? "bg-red-200"
                        : "bg-white opacity-60";
                return (
                  <li key={o}>
                    <button
                      type="button"
                      disabled={status !== "answering"}
                      onClick={() => setSelected(i)}
                      className={`flex w-full items-center gap-3 rounded-lg border-2 border-ink px-3 py-2.5 text-left transition-colors ${cls}`}
                    >
                      <kbd className="rounded border border-ink px-1.5 text-xs">{i + 1}</kbd>
                      {o}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {q.kind === "reorder" && (
          <>
            <p className="mb-3 text-sm font-semibold text-neutral-600">
              {q.before || q.after ? "Xếp lại các từ còn thiếu cho đúng thứ tự" : "Xếp lại câu cho đúng thứ tự"}
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {q.before && <span className="text-base text-neutral-700">{q.before}</span>}
              <div className="flex min-h-[3rem] min-w-[10rem] flex-wrap gap-2 rounded-lg border-2 border-dashed border-ink p-2">
                {tapped.map((wi) => (
                  <button
                    key={wi}
                    type="button"
                    disabled={status !== "answering"}
                    onClick={() => setTapped(tapped.filter((x) => x !== wi))}
                    className="rounded-lg border-2 border-ink bg-sky px-3 py-1.5 text-sm font-semibold"
                  >
                    {q.words[wi]}
                  </button>
                ))}
              </div>
              {q.after && <span className="text-base text-neutral-700">{q.after}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {q.words.map((w, wi) =>
                tapped.includes(wi) ? (
                  <span
                    key={wi}
                    className="select-none rounded-lg border-2 border-transparent bg-neutral-200 px-3 py-1.5 text-sm text-transparent"
                  >
                    {w}
                  </span>
                ) : (
                  <button
                    key={wi}
                    type="button"
                    disabled={status !== "answering"}
                    onClick={() => setTapped([...tapped, wi])}
                    className="rounded-lg border-2 border-ink bg-white px-3 py-1.5 text-sm font-semibold hover:bg-sky/40"
                  >
                    {w}
                  </button>
                )
              )}
            </div>
          </>
        )}

        {q.kind === "type" && (
          <>
            <p className="mb-1 text-sm font-semibold text-neutral-600">Gõ từ còn thiếu (không cần đúng dấu)</p>
            <p className="mb-4 text-xl leading-relaxed">{q.prompt}</p>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={status !== "answering"}
              placeholder="Gõ đáp án..."
              aria-label="Đáp án"
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
          </>
        )}

        {q.kind === "recall" && (
          <>
            <p className="mb-1 text-sm font-semibold text-neutral-600">Tự đánh giá</p>
            <p className="text-xl leading-relaxed">{q.prompt}</p>
            {revealed && (
              <p className="fade-in mt-4 rounded-lg border-2 border-ink bg-sky/40 p-3 text-sm">{q.full}</p>
            )}
          </>
        )}
      </div>

      {status !== "answering" && (
        <div
          className={`pop-in mt-4 rounded-xl border-2 border-ink p-4 ${
            status === "right" ? "bg-emerald-200" : "bg-red-200"
          }`}
        >
          <p className="font-display text-xl uppercase">{status === "right" ? "Chính xác!" : "Chưa đúng"}</p>
          {q.kind !== "recall" && (
            <>
              {status === "wrong" && (q.kind === "choice" || q.kind === "type") && (
                <p className="mt-1 text-sm font-semibold">Đáp án: {q.answerText}</p>
              )}
              <p className="mt-1 text-sm">{q.full}</p>
            </>
          )}
          {status === "wrong" && <p className="mt-1 text-xs">Câu này sẽ quay lại ở cuối bài.</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {status === "answering" ? (
          q.kind === "recall" ? (
            !revealed ? (
              <Button onClick={() => setRevealed(true)}>Hiện đáp án</Button>
            ) : (
              <>
                <Button onClick={() => check(true)}>Mình nhớ</Button>
                <Button variant="ghost" onClick={() => check(false)}>
                  Chưa nhớ
                </Button>
              </>
            )
          ) : (
            <Button disabled={!canCheck} onClick={primary}>
              Kiểm tra
            </Button>
          )
        ) : (
          <Button onClick={() => void next()}>{lastOne ? "Hoàn thành" : "Tiếp tục"}</Button>
        )}
        <span className="text-xs text-neutral-500">Nhấn Enter để tiếp tục</span>
      </div>
    </div>
  );
}