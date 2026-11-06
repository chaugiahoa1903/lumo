"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { activityTimestamps, loadDeck, syncReviews, toCard, totalXp } from "@/lib/review";
import { computeStreak } from "@/lib/streak";
import { corpusOf, type Card } from "@/lib/quiz";
import { formatStamp } from "@/lib/text";
import CountUp from "@/components/CountUp";
import ReviewLesson from "@/components/ReviewLesson";
import { btnCls, Button, PageHeader, Panel } from "@/components/ui";

const SESSION_SIZE = 8;

interface Mode {
  cards: Card[];
  practice: boolean;
  key: number;
}

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export default function ReviewPage() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    void syncReviews();
  }, []);

  const data = useLiveQuery(async () => {
    const [deck, xp, stamps] = await Promise.all([loadDeck(), totalXp(), activityTimestamps()]);
    const now = Date.now();
    const due = deck.filter((d) => d.review.dueAt <= now).sort((a, b) => a.review.dueAt - b.review.dueAt);
    const upcoming = deck
      .filter((d) => d.review.dueAt > now)
      .sort((a, b) => a.review.dueAt - b.review.dueAt)[0];
    return { deck, due, nextDue: upcoming?.review.dueAt, xp, streak: computeStreak(stamps) };
  }, []);

  if (data === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const { deck, due, nextDue, xp, streak } = data;

  if (mode) {
    const corpus = corpusOf(deck.map(toCard));
    return (
      <ReviewLesson
        key={mode.key}
        cards={mode.cards}
        corpus={corpus}
        practice={mode.practice}
        onExit={() => setMode(null)}
      />
    );
  }

  function startReview() {
    setMode({ cards: due.slice(0, SESSION_SIZE).map(toCard), practice: false, key: Date.now() });
  }
  function startPractice() {
    setMode({ cards: sample(deck, SESSION_SIZE).map(toCard), practice: true, key: Date.now() });
  }

  return (
    <div>
      <PageHeader title="Ôn tập" subtitle="Bài ôn ngắn, đúng ngay thì thẻ quay lại thưa dần, sai thì quay lại sớm." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Bài ôn hôm nay" hint={`${deck.length} thẻ trong bộ ôn`} tone="amber">
            {deck.length === 0 ? (
              <>
                <p className="font-display text-3xl uppercase leading-tight">Chưa có thẻ nào để ôn</p>
                <p className="mt-2 text-sm">
                  Thẻ ôn được tạo từ các task flashcard và nhớ lại bạn đã hoàn thành ở Next Up.
                </p>
                <div className="mt-5">
                  <Link href="/next" className={btnCls("primary")}>
                    Đi tới Next Up
                  </Link>
                </div>
              </>
            ) : due.length > 0 ? (
              <>
                <p className="font-display text-6xl leading-none">
                  <CountUp value={due.length} />
                </p>
                <p className="mt-2 font-display text-lg uppercase">thẻ đến hạn ôn</p>
                <p className="mt-1 text-sm">Mỗi bài tối đa {SESSION_SIZE} thẻ, khoảng vài phút.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={startReview}>Bắt đầu ôn</Button>
                  <Button variant="ghost" onClick={startPractice}>
                    Luyện tập thêm
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="font-display text-3xl uppercase leading-tight">Hôm nay chưa có thẻ nào đến hạn</p>
                {nextDue && <p className="mt-2 text-sm">Thẻ gần nhất đến hạn lúc {formatStamp(nextDue)}.</p>}
                <div className="mt-5">
                  <Button variant="ghost" onClick={startPractice}>
                    Luyện tập thêm
                  </Button>
                </div>
                <p className="mt-2 text-xs">Luyện tập thêm không làm thay đổi lịch ôn.</p>
              </>
            )}
          </Panel>

          <Panel title="Cách ôn hoạt động">
            <ul className="space-y-2 text-sm text-neutral-700">
              <li>Mỗi thẻ là một task flashcard hoặc nhớ lại bạn đã xong, câu hỏi do Luna tự sinh theo quy tắc.</li>
              <li>
                Trắc nghiệm: đáp án nhiễu lấy từ cùng đoạn tài liệu, và cùng &quot;họ&quot; với đáp án đúng khi là từ
                khóa viết hoa (ví dụ hỏi về COUNT thì có SUM, AVG, MIN, MAX). Luna không hiểu nghĩa từ, chỉ dựa vào kiểu
                chữ và việc xuất hiện cùng đoạn, nên không đủ đáp án hợp lý thì sẽ chuyển sang dạng câu hỏi khác.
              </li>
              <li>
                Đúng ngay lần đầu: thẻ quay lại sau 1, 6, 15 ngày... (thuật toán SM-2). Sai: quay lại sau 1 ngày và câu
                đó được hỏi lại cuối bài.
              </li>
              <li>
                Câu hỏi sinh theo mẫu nên có lúc gượng, nhất là với tài liệu tiếng Việt vì Luna chưa tách từ chính xác.
              </li>
            </ul>
          </Panel>
        </div>

        <div className="stagger space-y-6">
          <Panel title="Chuỗi ngày học">
            <p className="font-display text-6xl leading-none">
              <CountUp value={streak.streak} />
            </p>
            <p className="mt-1 font-display text-sm uppercase tracking-wide">ngày liên tiếp</p>
            <p className="mt-3 text-sm">
              {streak.todayDone ? "Hôm nay bạn đã học rồi." : "Hôm nay bạn chưa học: làm một task hoặc một bài ôn."}
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Ngày nghỉ dự trữ: {streak.freezes}/2. Học đủ 7 ngày được thêm 1 ngày. Bỏ lỡ một ngày sẽ tự dùng một ngày
              nghỉ, không bị phạt.
            </p>
          </Panel>

          <Panel title="Tổng XP" tone="navy">
            <p className="font-display text-5xl leading-none">
              <CountUp value={xp} />
            </p>
            <p className="mt-2 text-sm">+10 mỗi thẻ đúng ngay lần đầu, +5 nếu phải hỏi lại.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}