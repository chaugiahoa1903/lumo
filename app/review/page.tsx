"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { activityTimestamps, loadDeck, syncReviews } from "@/lib/review";
import { computeStreak } from "@/lib/streak";
import { totalXp } from "@/lib/xp";
import { formatStamp } from "@/lib/text";
import CountUp from "@/components/CountUp";
import { btnCls, PageHeader, Panel } from "@/components/ui";

const SESSION_SIZE = 8;

export default function ReviewPage() {
  useEffect(() => {
    void syncReviews();
  }, []);

  const data = useLiveQuery(async () => {
    const [deck, xp, stamps] = await Promise.all([loadDeck(), totalXp(), activityTimestamps()]);
    const now = Date.now();
    const due = deck.filter((d) => d.review.dueAt <= now);
    const upcoming = deck
      .filter((d) => d.review.dueAt > now)
      .sort((a, b) => a.review.dueAt - b.review.dueAt)[0];
    return { deckSize: deck.length, due: due.length, nextDue: upcoming?.review.dueAt, xp, streak: computeStreak(stamps) };
  }, []);

  if (data === undefined) return <p className="text-neutral-500">Đang tải...</p>;

  const { deckSize, due, nextDue, xp, streak } = data;

  return (
    <div>
      <PageHeader title="Ôn tập" subtitle="Bài ôn ngắn, đúng ngay thì thẻ quay lại thưa dần, sai thì quay lại sớm." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Bài ôn hôm nay" hint={`${deckSize} thẻ trong bộ ôn`} tone="amber">
            {deckSize === 0 ? (
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
            ) : due > 0 ? (
              <>
                <p className="font-display text-6xl leading-none">
                  <CountUp value={due} />
                </p>
                <p className="mt-2 font-display text-lg uppercase">thẻ đến hạn ôn</p>
                <p className="mt-1 text-sm">Mỗi bài tối đa {SESSION_SIZE} thẻ, khoảng vài phút, ở chế độ tập trung.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/study/review" className={btnCls("primary")}>
                    Bắt đầu ôn
                  </Link>
                  <Link href="/study/practice" className={btnCls("ghost")}>
                    Luyện tập thêm
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="font-display text-3xl uppercase leading-tight">Hôm nay chưa có thẻ nào đến hạn</p>
                {nextDue && <p className="mt-2 text-sm">Thẻ gần nhất đến hạn lúc {formatStamp(nextDue)}.</p>}
                <div className="mt-5">
                  <Link href="/study/practice" className={btnCls("ghost")}>
                    Luyện tập thêm
                  </Link>
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
            <p className="mt-2 text-sm">
              Task đọc +8 XP, flashcard/nhớ lại +10 XP. Thẻ ôn đúng ngay lần đầu +10 XP, phải hỏi lại +5 XP.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}