"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { checkBadges } from "@/lib/badges";
import { levelInfo, loadXp } from "@/lib/xp";
import { loadMastery } from "@/lib/mastery";
import { dayKey } from "@/lib/streak";
import { useSettings } from "@/lib/settings";
import { useToast } from "@/components/Toast";

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* bỏ qua */
  }
}

// Theo dõi dữ liệu học và báo các mốc: huy hiệu, lên cấp, đạt mục tiêu ngày, module lên sao.
export default function BadgeWatcher() {
  const toast = useToast();
  const router = useRouter();
  const [settings] = useSettings();
  const goalRef = useRef(settings.dailyGoalXp);
  const busy = useRef(false);
  const dirty = useRef(false);

  const sig = useLiveQuery(
    async () =>
      `${await db.events.count()}|${await db.reviews.count()}|${await db.tasks.where("status").equals("done").count()}`,
    []
  );

  useEffect(() => {
    goalRef.current = settings.dailyGoalXp;
  }, [settings.dailyGoalXp]);

  const run = useCallback(async () => {
    if (busy.current) {
      dirty.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        dirty.current = false;

        const fresh = await checkBadges();
        if (fresh.length > 0) {
          toast(`Mở khóa huy hiệu: ${fresh.map((b) => b.name).join(", ")}`, {
            actionLabel: "Xem",
            onAction: () => router.push("/progress"),
            ms: 9000,
          });
        }

        const xp = await loadXp();
        const lv = levelInfo(xp.total);
        const storedLv = lsGet("lumo.level");
        if (storedLv !== null && lv.level > Number(storedLv)) toast(`Lên cấp ${lv.level}: ${lv.title}`, { ms: 8000 });
        lsSet("lumo.level", String(lv.level));

        const goal = goalRef.current;
        const gk = `lumo.goal.${dayKey(Date.now())}`;
        if (xp.today >= goal && lsGet(gk) === null) {
          lsSet(gk, "1");
          toast(`Hoàn thành mục tiêu hôm nay (${goal} XP). Dừng lại hay học thêm đều ổn.`, { ms: 8000 });
        }

        const ms = await loadMastery();
        const prevRaw = lsGet("lumo.stars");
        let prev: Record<string, number> | null = null;
        if (prevRaw !== null) {
          try {
            prev = JSON.parse(prevRaw) as Record<string, number>;
          } catch {
            prev = null;
          }
        }
        const next: Record<string, number> = {};
        for (const m of ms) {
          next[String(m.moduleId)] = m.stars;
          if (prev !== null && m.stars > (prev[String(m.moduleId)] ?? 0)) {
            toast(`Module "${m.title}" đạt ${"★".repeat(m.stars)}`, {
              actionLabel: "Xem bản đồ",
              onAction: () => router.push("/progress"),
              ms: 8000,
            });
          }
        }
        lsSet("lumo.stars", JSON.stringify(next));
      } while (dirty.current);
    } catch {
      /* bỏ qua, sẽ kiểm tra lại ở lần dữ liệu thay đổi sau */
    } finally {
      busy.current = false;
    }
  }, [toast, router]);

  useEffect(() => {
    if (sig !== undefined) void run();
  }, [sig, run]);

  return null;
}