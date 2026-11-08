"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { useLang, type Lang } from "@/lib/i18n";
import { dayKey, monthGrid, pickToday, statsByDay, weekSummary } from "@/lib/overview";
import { Button, PageHeader, Panel } from "@/components/ui";

const T: Record<Lang, Record<string, string>> = {
  vi: {
    welcome: "Chào mừng trở lại",
    sub: "Tổng quan việc học của bạn",
    rename: "Đổi tên",
    save: "Lưu",
    namePh: "Tên của bạn",
    week: "7 ngày qua",
    tasks: "task xong",
    minutes: "phút học",
    days: "ngày có học",
    today: "Hôm nay cần học",
    noTask: "Không còn task nào. Hãy tạo khóa học mới hoặc vào ôn tập.",
    noCourse: "Bạn chưa có khóa học nào.",
    due: "thẻ ôn đến hạn",
    plan: "task, khoảng {m} phút",
    start: "Bắt đầu học",
    calendar: "Lịch học",
    dayEmpty: "Không có task nào hoàn thành ngày này.",
    dayCount: "{n} task xong",
    prev: "Tháng trước",
    next: "Tháng sau",
    todayBtn: "Hôm nay",
    loading: "Đang tải...",
    chartNote: "Cột cao theo số phút học mỗi ngày.",
    mins: "{n} ph",
  },
  en: {
    welcome: "Welcome back",
    sub: "Your learning overview",
    rename: "Rename",
    save: "Save",
    namePh: "Your name",
    week: "Last 7 days",
    tasks: "tasks done",
    minutes: "minutes studied",
    days: "active days",
    today: "To study today",
    noTask: "No tasks left. Create a new course or head to review.",
    noCourse: "You have no course yet.",
    due: "review cards due",
    plan: "tasks, about {m} min",
    start: "Start studying",
    calendar: "Study calendar",
    dayEmpty: "No tasks were completed on this day.",
    dayCount: "{n} tasks done",
    prev: "Previous month",
    next: "Next month",
    todayBtn: "Today",
    loading: "Loading...",
    chartNote: "Bar height follows minutes studied each day.",
    mins: "{n} min",
  },
};

const WEEKDAYS: Record<Lang, string[]> = {
  vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border-2 border-ink bg-white px-3 py-2">
      <p className="font-display text-3xl leading-none">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{label}</p>
    </div>
  );
}

export default function OverviewPage() {
  const lang = useLang();
  const tx = T[lang];
  const [s, update] = useSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const now = useMemo(() => Date.now(), []);
  const today = new Date(now);
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [picked, setPicked] = useState<string>(dayKey(now));

  const data = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    const course = await db.courses.orderBy("createdAt").last();
    const modules = course ? await db.modules.where("courseId").equals(course.id).sortBy("order") : [];
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const due = await db.reviews.where("dueAt").belowOrEqual(end.getTime()).count();
    return { tasks, course, modules, due };
  }, []);

  const stats = useMemo(() => (data ? statsByDay(data.tasks) : null), [data]);
  const week = useMemo(() => (stats ? weekSummary(stats, now) : null), [stats, now]);
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym]);

  const todayTasks = useMemo(() => {
    if (!data?.course) return [];
    const order = new Map(data.modules.map((m) => [m.id, m.order]));
    const course = data.course;
    const todo = data.tasks
      .filter((t) => t.courseId === course.id && t.status === "todo")
      .sort((a, b) => (order.get(a.moduleId) ?? 0) - (order.get(b.moduleId) ?? 0) || a.order - b.order);
    return pickToday(todo, s.studyTotalMin);
  }, [data, s.studyTotalMin]);

  const dayTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks
      .filter((t) => t.status === "done" && typeof t.completedAt === "number" && dayKey(t.completedAt) === picked)
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  }, [data, picked]);

  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const maxSec = Math.max(60, ...(week?.days.map((d) => d.seconds) ?? [0]));
  const todayKey = dayKey(now);

  function shift(delta: number) {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  }

  function saveName() {
    const v = draft.trim();
    if (v) update({ displayName: v.slice(0, 40) });
    setEditing(false);
  }

  const todayMinutes = todayTasks.reduce((sum, t) => sum + t.estMinutes, 0);

  return (
    <div>
      <PageHeader title={`${tx.welcome}, ${s.displayName}`} subtitle={tx.sub} />

      <div className="mt-3">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              aria-label={tx.namePh}
              placeholder={tx.namePh}
              value={draft}
              maxLength={40}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditing(false);
              }}
              className="rounded-lg border-2 border-ink bg-white px-3 py-1.5 text-sm"
            />
            <Button onClick={saveName}>{tx.save}</Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(s.displayName);
              setEditing(true);
            }}
          >
            {tx.rename}
          </Button>
        )}
      </div>

      {!data || !week || !stats ? (
        <p className="mt-6 text-sm text-neutral-600">{tx.loading}</p>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <Panel title={tx.week}>
            <div className="grid grid-cols-3 gap-3">
              <Stat value={week.totalTasks} label={tx.tasks} />
              <Stat value={week.totalMinutes} label={tx.minutes} />
              <Stat value={week.activeDays} label={tx.days} />
            </div>
            <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={tx.chartNote}>
              {week.days.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-neutral-600">{d.count > 0 ? d.count : ""}</span>
                  <div
                    title={`${new Date(d.ts).toLocaleDateString(locale)}: ${fill(tx.mins, { n: Math.round(d.seconds / 60) })}`}
                    className={`w-full rounded-t-md border-2 border-ink ${d.key === todayKey ? "bg-cobalt" : "bg-sky"}`}
                    style={{ height: `${d.seconds > 0 ? Math.max(6, Math.round((d.seconds / maxSec) * 72)) : 3}px` }}
                  />
                  <span className="text-[10px] font-semibold">
                    {WEEKDAYS[lang][(new Date(d.ts).getDay() + 6) % 7]}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">{tx.chartNote}</p>
          </Panel>

          <Panel title={tx.today} hint={todayTasks.length > 0 ? `${todayTasks.length} ${fill(tx.plan, { m: todayMinutes })}` : undefined}>
            {data.due > 0 && (
              <p className="mb-3 rounded-lg border-2 border-ink bg-amber-retro px-3 py-2 text-sm font-semibold">
                {data.due} {tx.due}
              </p>
            )}
            {!data.course ? (
              <p className="text-sm text-neutral-600">{tx.noCourse}</p>
            ) : todayTasks.length === 0 ? (
              <p className="text-sm text-neutral-600">{tx.noTask}</p>
            ) : (
              <>
                <ul className="divide-y divide-neutral-200 rounded-lg border-2 border-ink bg-white">
                  {todayTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-semibold">{t.title}</span>
                      <span className="shrink-0 text-xs text-neutral-600">{fill(tx.mins, { n: t.estMinutes })}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <Link href="/next">
                    <Button>{tx.start}</Button>
                  </Link>
                </div>
              </>
            )}
          </Panel>

          <div className="lg:col-span-2">
            <Panel title={tx.calendar} hint={monthLabel}>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => shift(-1)}>
                  {tx.prev}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setYm({ y: today.getFullYear(), m: today.getMonth() });
                    setPicked(todayKey);
                  }}
                >
                  {tx.todayBtn}
                </Button>
                <Button variant="ghost" onClick={() => shift(1)}>
                  {tx.next}
                </Button>
              </div>

              <div className="mt-3 grid max-w-xl grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-600">
                {WEEKDAYS[lang].map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="mt-1 grid max-w-xl grid-cols-7 gap-1">
                {grid.map((c) => {
                  const n = stats.get(c.key)?.count ?? 0;
                  const level = n === 0 ? "bg-white" : n <= 2 ? "bg-sky/50" : n <= 5 ? "bg-sky" : "bg-cobalt text-white";
                  const sel = c.key === picked;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={sel}
                      aria-label={`${new Date(c.ts).toLocaleDateString(locale)}: ${fill(tx.dayCount, { n })}`}
                      onClick={() => setPicked(c.key)}
                      className={`aspect-square rounded-lg border-2 text-sm font-semibold transition-transform hover:scale-105 ${level} ${
                        sel ? "border-ink ring-2 ring-amber-retro" : c.key === todayKey ? "border-ink" : "border-neutral-300"
                      } ${c.inMonth ? "" : "opacity-40"}`}
                    >
                      {new Date(c.ts).getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 max-w-xl text-sm">
                <p className="font-semibold">
                  {new Date(`${picked}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  {fill(tx.dayCount, { n: dayTasks.length })}
                </p>
                {dayTasks.length === 0 ? (
                  <p className="mt-1 text-neutral-600">{tx.dayEmpty}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border-2 border-ink bg-white">
                    {dayTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="min-w-0 truncate">{t.title}</span>
                        <span className="shrink-0 text-xs text-neutral-600">
                          {fill(tx.mins, { n: Math.max(1, Math.round((t.actualSeconds ?? 0) / 60)) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}