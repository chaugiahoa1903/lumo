"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { corpusOf, type Card } from "@/lib/quiz";
import { loadDeck, syncReviews, toCard } from "@/lib/review";
import { usePomo } from "@/lib/usePomo";
import { useAutoSound } from "@/lib/audioSource";
import { ambient } from "@/lib/ambient";
import { useToast } from "@/components/Toast";
import FocusConsole, { Ico, toolBtn } from "@/components/FocusConsole";
import MiniHud from "@/components/MiniHud";
import PomoSetup from "@/components/PomoSetup";
import ReviewLesson from "@/components/ReviewLesson";
import StudyFrame, { type Scene } from "@/components/StudyFrame";
import { btnCls, Panel } from "@/components/ui";

const SESSION_SIZE = 8;

type Loaded = { cards: Card[]; corpus: string[] } | "empty" | null;

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function ReviewRoom({ cards, corpus, practice }: { cards: Card[]; corpus: string[]; practice: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const pomo = usePomo({
    onBlockOver: () => toast("Hết hiệp. Hoàn thành bài ôn rồi nghỉ nhé.", { ms: 9000 }),
  });
  const { cfg, settings } = pomo;
  useAutoSound(pomo.ticking, settings.autoSound);
  const [scene, setScene] = useState<Scene>("dial");
  const [started, setStarted] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const exit = () => router.push("/review");

  function onMain() {
    ambient.unlock();
    if (!started) {
      setStarted(true);
      pomo.setTicking(true);
      setScene("learn");
      return;
    }
    if (pomo.ticking) pomo.setTicking(false);
    else {
      pomo.setTicking(true);
      setScene("learn");
    }
  }

  const dialLabel = started
    ? pomo.ticking
      ? "Đang ôn tập"
      : "Tạm dừng"
    : pomo.over
      ? "Hết hiệp"
      : "Sẵn sàng";

  const tools = (
    <Link href="/review" aria-label="Về trang Ôn tập" title="Về trang Ôn tập" className={toolBtn}>
      <Ico className="h-4 w-4">
        <path d="M5 6h14M5 12h14M5 18h9" />
      </Ico>
    </Link>
  );

  const dial = (
    <div className="absolute inset-0 flex items-center justify-center px-4 pb-4 pt-[76px]">
      <FocusConsole
        label={dialLabel}
        roundText={`${cards.length} thẻ`}
        running={pomo.ticking}
        remainingSec={pomo.remainingSec}
        totalSec={pomo.blockTotalMs / 1000}
        focusMin={cfg.focusMin}
        focusLocked={started && pomo.ticking}
        onFocusMin={(m) => pomo.updateSettings({ focusMinutes: m })}
        onSetup={() => setShowSetup(true)}
        mainIcon={started && pomo.ticking ? "pause" : "play"}
        mainLabel={started ? (pomo.ticking ? "Tạm dừng" : "Tiếp tục") : "Bắt đầu ôn"}
        onMain={onMain}
        title={practice ? "Luyện tập thêm" : "Ôn theo lịch"}
        subtitle={`${cards.length} thẻ cần ôn`}
        tools={tools}
        canLearn={started}
        onLearn={() => setScene("learn")}
      />
    </div>
  );

  const learn = (
    <>
      {pomo.over && (
        <div className="mb-4 rounded-xl border-2 border-ink bg-amber-retro p-3 text-sm font-semibold text-ink">
          Hết hiệp {cfg.focusMin} phút. Hoàn thành bài ôn rồi nghỉ nhé.
        </div>
      )}
      <div className="rounded-2xl border-2 border-ink bg-white p-5 text-ink">
        {started && <ReviewLesson cards={cards} corpus={corpus} practice={practice} onExit={exit} />}
      </div>
    </>
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
      <StudyFrame
        scene={scene}
        onScene={setScene}
        canLearn={started}
        modeLabel={practice ? "Luyện tập thêm" : "Ôn theo lịch"}
        mood={started && pomo.ticking ? "focus" : "idle"}
        headerCenter={
          <MiniHud
            remainingSec={pomo.remainingSec}
            totalSec={pomo.blockTotalMs / 1000}
            ticking={pomo.ticking}
            over={pomo.over}
            onToggle={() => pomo.setTicking(!pomo.ticking)}
          />
        }
        onExit={exit}
        dial={dial}
        learn={learn}
      />
    </>
  );
}

// Bài ôn trong chế độ tập trung. practice = luyện tập thêm (không đổi lịch ôn).
export default function ReviewStudy({ practice }: { practice: boolean }) {
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await syncReviews();
      const deck = await loadDeck();
      const now = Date.now();
      const pick = practice
        ? sample(deck, SESSION_SIZE)
        : deck
            .filter((d) => d.review.dueAt <= now)
            .sort((a, b) => a.review.dueAt - b.review.dueAt)
            .slice(0, SESSION_SIZE);
      if (!alive) return;
      if (pick.length === 0) setLoaded("empty");
      else setLoaded({ cards: pick.map(toCard), corpus: corpusOf(deck.map(toCard)) });
    })();
    return () => {
      alive = false;
    };
  }, [practice]);

  if (loaded === null) {
    return <p className="pt-24 text-center text-white/70">Đang chuẩn bị bài ôn...</p>;
  }

  if (loaded === "empty") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-24">
        <Panel title="Chưa có thẻ nào" tone="amber">
          <p className="font-display text-3xl uppercase leading-tight">
            {practice ? "Chưa có thẻ nào để luyện" : "Hôm nay chưa có thẻ nào đến hạn"}
          </p>
          <p className="mt-2 text-sm">Thẻ ôn được tạo từ các task flashcard và nhớ lại bạn đã hoàn thành.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/review" className={btnCls("primary")}>
              Về trang Ôn tập
            </Link>
            <Link href="/next" className={btnCls("ghost")}>
              Về trang chuẩn bị
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  return <ReviewRoom cards={loaded.cards} corpus={loaded.corpus} practice={practice} />;
}