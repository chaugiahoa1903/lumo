"use client";

import { usePathname } from "next/navigation";
import { ambient, useAmbient } from "@/lib/ambient";
import { soundById } from "@/lib/sounds";

// Viên thuốc nhỏ để dừng âm nền khi bạn đã rời khỏi phòng tập trung.
export default function SoundPill() {
  const s = useAmbient();
  const pathname = usePathname();
  if (!s.playing || pathname.startsWith("/next")) return null;
  return (
    <div className="fixed bottom-20 left-4 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-[#070b24] py-1.5 pl-4 pr-1.5 text-sm text-white md:bottom-6 md:left-8">
      <span aria-hidden>♪</span>
      <span className="max-w-[9rem] truncate">{soundById(s.soundId).name}</span>
      <button
        type="button"
        onClick={() => ambient.pause()}
        aria-label="Dừng âm thanh"
        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink"
      >
        Dừng
      </button>
    </div>
  );
}