"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { loadMastery } from "@/lib/mastery";
import ScrollArea from "@/components/ScrollArea";
import { Panel } from "@/components/ui";

function Stars({ n }: { n: number }) {
  return (
    <span role="img" aria-label={`${n} trên 3 sao`} className="text-lg leading-none tracking-widest">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? "text-ink" : "text-neutral-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

const ROAD_STYLE = {
  backgroundColor: "#ffffff",
  backgroundImage: "conic-gradient(var(--color-ink) 25%, #ffffff 0 50%, var(--color-ink) 0 75%, #ffffff 0)",
  backgroundSize: "12px 12px",
};

export default function ConquestMap() {
  const data = useLiveQuery(async () => {
    const course = await db.courses.orderBy("createdAt").last();
    if (!course) return null;
    return { course, mastery: await loadMastery(course.id) };
  }, []);

  if (data === undefined) return null;

  if (data === null || data.mastery.length === 0) {
    return (
      <Panel title="Bản đồ chinh phục" hint="Tạo khóa học để mở bản đồ">
        <p className="text-sm text-neutral-600">Mỗi module trong khóa học sẽ là một chặng trên đường đua caro.</p>
      </Panel>
    );
  }

  const { course, mastery } = data;
  const currentId = mastery.find((m) => m.stars === 0)?.moduleId;
  const explored = mastery.filter((m) => m.stars >= 1).length;
  const allMastered = mastery.every((m) => m.stars >= 3);

  return (
    <Panel title="Bản đồ chinh phục" hint={`${course.title} · ${explored}/${mastery.length} chặng đã khám phá`}>
      <ScrollArea label="Bản đồ chinh phục" maxHeight={380} focusKey={currentId ?? null}>
      <div className="relative pl-14 pr-2">
        <div aria-hidden className="absolute bottom-6 left-3 top-2 w-6 border-x-2 border-ink" style={ROAD_STYLE} />
        <ul className="stagger space-y-4">
          {mastery.map((m, i) => {
            const isCurrent = m.moduleId === currentId;
            return (
              <li key={m.moduleId} className="relative" data-current={isCurrent ? "true" : undefined}>
                <span
                  className={`absolute -left-14 top-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink font-display text-xl ${
                    m.stars >= 3 ? "bg-amber-retro" : m.stars >= 1 ? "bg-cobalt text-white" : "bg-white"
                  }`}
                >
                  {i + 1}
                </span>
                <div
                  className={`rounded-lg border-2 border-ink p-3 ${
                    m.stars >= 3 ? "bg-amber-retro" : isCurrent ? "bg-sky/40" : "bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-lg uppercase leading-tight">{m.title}</p>
                    <Stars n={m.stars} />
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">
                    {m.done}/{m.total} task · {m.hint}
                  </p>
                  {isCurrent && (
                    <p className="mt-1 inline-block rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs font-semibold">
                      Bạn đang ở đây
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          <li className="relative">
            <span className="absolute -left-14 top-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-ink text-xs font-bold text-white">
              ĐÍCH
            </span>
            <div className={`rounded-lg border-2 border-ink p-3 ${allMastered ? "bg-amber-retro" : "bg-white"}`}>
              <p className="font-display text-lg uppercase leading-tight">Về đích</p>
              <p className="mt-1 text-sm text-neutral-700">
                {allMastered
                  ? "Bạn đã chinh phục hoàn toàn khóa học này."
                  : explored === mastery.length
                    ? "Bạn đã khám phá hết khóa học. Ôn tập để lấy thêm sao."
                    : `Còn ${mastery.length - explored} chặng chưa khám phá.`}
              </p>
            </div>
          </li>
        </ul>
      </div>
      </ScrollArea>
      <p className="mt-4 text-xs text-neutral-500">
        ★ khám phá: xong mọi task · ★★ nắm chắc: ≥80% thẻ đã được ôn đúng theo lịch · ★★★ thành thạo: ≥80% thẻ ôn đúng
        liên tiếp 2 lần. Sao lấy từ lịch ôn thật nên cần vài ngày, không đạt được trong một buổi.
      </p>
    </Panel>
  );
}
