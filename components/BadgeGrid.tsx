"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BADGES } from "@/lib/badges";
import { formatStamp } from "@/lib/text";
import { Panel } from "@/components/ui";

// recent: chỉ hiện chừng này huy hiệu mở khóa gần nhất kèm nút "Xem toàn bộ". Bỏ trống = hiện tất cả.
export default function BadgeGrid({ recent }: { recent?: number }) {
  const earned = useLiveQuery(async () => {
    const ev = await db.events.where("type").equals("badge").toArray();
    const m: Record<string, number> = {};
    for (const e of ev) m[String(e.payload?.id)] = e.ts;
    return m;
  }, []);

  if (earned === undefined) return null;

  const got = BADGES.filter((b) => earned[b.id] !== undefined).sort((a, b) => earned[b.id] - earned[a.id]);
  const locked = BADGES.filter((b) => earned[b.id] === undefined);
  const compact = recent !== undefined;
  const list = compact ? got.slice(0, recent) : [...got, ...locked];

  return (
    <Panel
      title="Huy hiệu"
      hint={
        compact
          ? `${got.length}/${BADGES.length} đã mở khóa`
          : `${got.length}/${BADGES.length} đã mở khóa · điều kiện cố định, không ngẫu nhiên`
      }
    >
      {list.length === 0 ? (
        <p className="text-sm text-neutral-600">Chưa có huy hiệu nào. Học tiếp để mở khóa huy hiệu đầu tiên.</p>
      ) : (
        <ul className={`stagger grid gap-3 sm:grid-cols-2 ${compact ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
          {list.map((b) => {
            const ts = earned[b.id];
            const has = ts !== undefined;
            return (
              <li
                key={b.id}
                className={`rounded-lg border-2 border-ink p-3 ${has ? "bg-amber-retro" : "border-dashed bg-white"}`}
              >
                <p className="font-display text-lg uppercase leading-tight">{has || !b.hidden ? b.name : "???"}</p>
                <p className="mt-1 text-sm text-neutral-700">
                  {has || !b.hidden ? b.desc : "Huy hiệu ẩn: cứ học rồi sẽ biết."}
                </p>
                <p className="mt-2 text-xs font-semibold text-neutral-600">
                  {has ? `Mở khóa ${formatStamp(ts)}` : "Chưa mở khóa"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {compact && (
        <div className="mt-4">
          <Link
            href="/badges"
            className="inline-block rounded-full border-2 border-ink bg-white px-4 py-1.5 text-sm font-semibold hover:bg-sky/40"
          >
            Xem toàn bộ huy hiệu ({BADGES.length})
          </Link>
        </div>
      )}
    </Panel>
  );
}
