"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { activityTimestamps } from "@/lib/review";
import { computeStreak } from "@/lib/streak";
import { GOAL_CHOICES, levelInfo, loadXp } from "@/lib/xp";
import { useSettings } from "@/lib/settings";
import CountUp from "@/components/CountUp";
import { ProgressBar } from "@/components/ui";

export default function QuestStrip() {
  const [settings, update] = useSettings();
  const data = useLiveQuery(async () => {
    const [xp, stamps] = await Promise.all([loadXp(), activityTimestamps()]);
    return { xp, streak: computeStreak(stamps) };
  }, []);

  if (!data) return null;

  const lv = levelInfo(data.xp.total);
  const goal = settings.dailyGoalXp;
  const reached = data.xp.today >= goal;

  return (
    <div className="mb-6 grid divide-y-2 divide-ink overflow-hidden rounded-xl border-2 border-ink bg-white md:grid-cols-3 md:divide-x-2 md:divide-y-0">
      <div className="p-4">
        <p className="font-display text-xs uppercase tracking-wide text-neutral-500">Cấp độ</p>
        <p className="font-display text-2xl uppercase leading-tight">
          Cấp {lv.level} · {lv.title}
        </p>
        <div className="mt-2">
          <ProgressBar
            value={(lv.into / lv.span) * 100}
            label={`${lv.into}/${lv.span} XP · còn ${lv.toNext} XP lên cấp ${lv.level + 1}`}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-xs uppercase tracking-wide text-neutral-500">Mục tiêu hôm nay</p>
          <select
            aria-label="Mục tiêu XP mỗi ngày"
            value={goal}
            onChange={(e) => update({ dailyGoalXp: Number(e.target.value) })}
            className="rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs"
          >
            {GOAL_CHOICES.map((g) => (
              <option key={g} value={g}>
                {g} XP
              </option>
            ))}
          </select>
        </div>
        <p className="font-display text-2xl uppercase leading-tight">
          <CountUp value={data.xp.today} /> / {goal} XP
        </p>
        <div className="mt-2">
          <ProgressBar
            value={(data.xp.today / goal) * 100}
            label={reached ? "Đã đạt mục tiêu. Dừng lại hay học thêm đều ổn." : `Còn ${goal - data.xp.today} XP nữa`}
          />
        </div>
      </div>

      <div className="p-4">
        <p className="font-display text-xs uppercase tracking-wide text-neutral-500">Chuỗi ngày học</p>
        <p className="font-display text-2xl uppercase leading-tight">
          <CountUp value={data.streak.streak} /> ngày
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          {data.streak.todayDone ? "Hôm nay bạn đã học rồi." : "Hôm nay chưa học."} Ngày nghỉ dự trữ:{" "}
          {data.streak.freezes}/2.
        </p>
      </div>
    </div>
  );
}