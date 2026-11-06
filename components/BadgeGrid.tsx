"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BADGES } from "@/lib/badges";
import { formatStamp } from "@/lib/text";
import { Panel } from "@/components/ui";

export default function BadgeGrid() {
  const earned = useLiveQuery(async () => {
    const ev = await db.events.where("type").equals("badge").toArray();
    const m: Record<string, number> = {};
    for (const e of ev) m[String(e.payload?.id)] = e.ts;
    return m;
  }, []);

  if (earned === undefined) return null;
  const count = BADGES.filter((b) => earned[b.id] !== undefined).length;

  return (
    <Panel title="Huy hiệu" hint={`${count}/${BADGES.length} đã mở khóa · điều kiện cố định, không ngẫu nhiên`}>
      <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {BADGES.map((b) => {
          const ts = earned[b.id];
          const got = ts !== undefined;
          return (
            <li
              key={b.id}
              className={`rounded-lg border-2 border-ink p-3 ${got ? "bg-amber-retro" : "border-dashed bg-white"}`}
            >
              <p className="font-display text-lg uppercase leading-tight">{got || !b.hidden ? b.name : "???"}</p>
              <p className="mt-1 text-sm text-neutral-700">
                {got || !b.hidden ? b.desc : "Huy hiệu ẩn: cứ học rồi sẽ biết."}
              </p>
              <p className="mt-2 text-xs font-semibold text-neutral-600">
                {got ? `Mở khóa ${formatStamp(ts)}` : "Chưa mở khóa"}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}