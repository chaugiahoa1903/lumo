"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { pickByMode, rankModulesByGoal, type GoalMode, type GoalModule } from "@/lib/goalfit";
import { useToast } from "@/components/Toast";
import ScrollArea from "@/components/ScrollArea";
import { Button, Panel } from "@/components/ui";

type Target = "all" | "goal";

const MODES: { key: GoalMode; label: string; hint: string }[] = [
  { key: "skim", label: "Lướt", hint: "≈ 1/3 thời gian" },
  { key: "core", label: "Cốt lõi", hint: "≈ 2/3 thời gian" },
  { key: "full", label: "Đầy đủ", hint: "cả sách, trừ phụ lục" },
];

const seg = (on: boolean) =>
  `flex-1 rounded-lg border-2 border-ink px-3 py-2 text-sm font-semibold transition-colors ${
    on ? "bg-cobalt text-white" : "bg-white hover:bg-sky/40"
  }`;

// Mục tiêu học của khóa học: "Học tất cả" (mặc định) hoặc "Học theo mục tiêu".
// Luna chấm điểm từng module bằng TF-IDF + cosine (so từ, không hiểu nghĩa).
// "Áp dụng" chỉ đánh dấu task chưa làm: module được chọn -> todo, không chọn -> skipped. Task đã xong giữ nguyên.
export default function GoalPicker({ courseId }: { courseId: number }) {
  const toast = useToast();
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<GoalMode>("core");
  const [busy, setBusy] = useState(false);

  const modules = useLiveQuery(() => db.modules.where("courseId").equals(courseId).sortBy("order"), [courseId]);
  const tasks = useLiveQuery(() => db.tasks.where("courseId").equals(courseId).toArray(), [courseId]);

  const gm = useMemo<GoalModule[]>(() => {
    if (!modules || !tasks) return [];
    return modules.map((m) => {
      const ts = tasks.filter((t) => t.moduleId === m.id);
      return {
        id: m.id,
        title: m.title,
        text: ts
          .filter((t) => t.type === "read")
          .map((t) => t.body ?? "")
          .join("\n"),
        minutes: ts.reduce((s, t) => s + t.estMinutes, 0),
        optional: /^appendix\b/i.test(m.title),
      };
    });
  }, [modules, tasks]);

  const hasGoal = goal.trim().length > 0;
  const ranks = useMemo(() => (hasGoal ? rankModulesByGoal(goal, gm) : []), [goal, gm, hasGoal]);
  const picks = useMemo(
    () => (mode === "full" || hasGoal ? pickByMode(ranks, gm, mode) : new Set<number>()),
    [ranks, gm, mode, hasGoal],
  );

  const skipped = tasks?.filter((t) => t.status === "skipped").length ?? 0;
  const effective: Target = target ?? (skipped > 0 ? "goal" : "all");
  const noMatch = hasGoal && ranks.length > 0 && ranks.every((r) => r.score === 0);
  const needGoal = mode !== "full" && !hasGoal;

  const mins = (set: Set<number>) => gm.filter((m) => set.has(m.id)).reduce((s, m) => s + m.minutes, 0);
  const totalMain = mins(new Set(gm.filter((m) => !m.optional).map((m) => m.id)));
  const chosenMin = mins(picks);
  const remainMin = (tasks ?? [])
    .filter((t) => t.status === "todo")
    .reduce((s, t) => s + t.estMinutes, 0);
  const activeModules = gm.filter((m) => (tasks ?? []).some((t) => t.moduleId === m.id && t.status === "todo")).length;

  async function restore() {
    if (!tasks) return;
    setBusy(true);
    try {
      await db.transaction("rw", db.tasks, async () => {
        for (const t of tasks) if (t.status === "skipped") await db.tasks.update(t.id, { status: "todo" });
      });
      toast("Đã khôi phục mọi task bị bỏ qua. Bạn học toàn bộ khóa học.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseAll() {
    setTarget("all");
    if (skipped > 0) await restore();
  }

  async function apply() {
    if (!tasks || !modules) return;
    setBusy(true);
    try {
      await db.transaction("rw", db.tasks, async () => {
        for (const t of tasks) {
          if (t.status === "done") continue;
          const want = picks.has(t.moduleId) ? "todo" : "skipped";
          if (t.status !== want) await db.tasks.update(t.id, { status: want });
        }
      });
      toast(`Đã chọn ${picks.size}/${modules.length} module. Phần còn lại được bỏ qua, chọn "Học tất cả" để khôi phục.`);
      router.push("/next");
    } finally {
      setBusy(false);
    }
  }

  if (!modules || !tasks) return null;

  return (
    <Panel
      title="Mục tiêu học của bạn"
      hint={effective === "all" ? "Học tất cả" : skipped > 0 ? `Đang học ${activeModules}/${modules.length} module` : "Học theo mục tiêu"}
    >
      <div className="flex gap-2" role="group" aria-label="Kiểu học">
        <button type="button" aria-pressed={effective === "all"} disabled={busy} onClick={chooseAll} className={seg(effective === "all")}>
          Học tất cả
        </button>
        <button type="button" aria-pressed={effective === "goal"} onClick={() => setTarget("goal")} className={seg(effective === "goal")}>
          Học theo mục tiêu
        </button>
      </div>

      {effective === "all" ? (
        <p className="mt-3 text-sm text-neutral-600">
          Học mọi module theo thứ tự của sách: {modules.length} module, còn khoảng {remainMin} phút.
        </p>
      ) : (
        <div className="mt-3">
          <input
            aria-label="Bạn muốn học để làm gì?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Bạn muốn học để làm gì? Ví dụ: filter data with WHERE and handle NULL"
            className="w-full rounded-lg border-2 border-ink bg-white px-3 py-2 text-base"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Luna so từ khóa với nội dung từng module, nên hãy dùng từ có trong tài liệu (sách tiếng Anh thì gõ tiếng Anh).
          </p>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Mức độ">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => setMode(m.key)}
                title={m.hint}
                className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-semibold transition-colors ${
                  mode === m.key ? "bg-cobalt text-white" : "bg-white hover:bg-sky/40"
                }`}
              >
                {m.label} <span className={mode === m.key ? "text-white/80" : "text-neutral-500"}>· {m.hint}</span>
              </button>
            ))}
          </div>

          {noMatch && (
            <p className="mt-3 rounded-lg border-2 border-ink bg-amber-retro px-3 py-2 text-sm">
              Không có từ nào trong mục tiêu khớp với tài liệu. Thử từ khóa xuất hiện trong sách.
            </p>
          )}
          {needGoal && <p className="mt-3 text-sm text-neutral-600">Gõ mục tiêu để Luna gợi ý phần cần học, hoặc chọn "Đầy đủ".</p>}

          {!needGoal && !noMatch && (
            <>
              <div className="mt-3 rounded-lg border-2 border-ink bg-white">
                <ScrollArea label="Module theo mục tiêu" maxHeight={232}>
                  <ul className="divide-y divide-neutral-200">
                    {gm.map((m) => {
                      const on = picks.has(m.id);
                      const r = ranks.find((x) => x.id === m.id);
                      return (
                        <li key={m.id} className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm ${on ? "bg-sky/40" : "opacity-60"}`}>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{m.title}</span>
                            <span className="block truncate text-xs text-neutral-600">
                              {m.minutes} phút{m.optional ? " · phụ lục" : ""}
                              {on && r && r.matched.length > 0 ? ` · khớp: ${r.matched.join(", ")}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold">{on ? "Học" : "Bỏ qua"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </div>
              <p className="mt-2 text-sm font-semibold">
                Chọn {picks.size}/{gm.length} module · {chosenMin} phút thay vì {totalMain} phút
                {totalMain > 0 ? ` (giảm ${Math.round((1 - chosenMin / totalMain) * 100)}%)` : ""}
              </p>
            </>
          )}

          <div className="mt-3">
            <Button disabled={busy || needGoal || noMatch || picks.size === 0} onClick={apply}>
              Áp dụng
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
