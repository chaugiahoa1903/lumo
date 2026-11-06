"use client";

import type { ReactNode } from "react";
import { ambient, useAmbient } from "@/lib/ambient";
import { soundById } from "@/lib/sounds";

function Ico({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function VolumePill() {
  const s = useAmbient();
  return (
    <div className="flex items-center gap-4 rounded-full bg-white/10 p-2 pr-6">
      <button
        type="button"
        aria-label={s.volume === 0 ? "Bật tiếng" : "Tắt tiếng"}
        onClick={() => ambient.setVolume(s.volume === 0 ? 0.5 : 0)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink"
      >
        <Ico className="h-6 w-6">
          <path d="M11 5L6 9H3v6h3l5 4V5z" />
          {s.volume === 0 ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
        </Ico>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(s.volume * 100)}
        onChange={(e) => ambient.setVolume(Number(e.target.value) / 100)}
        aria-label="Âm lượng"
        className="h-1 w-28 cursor-pointer accent-white"
      />
    </div>
  );
}

export function SoundCenter() {
  const s = useAmbient();
  const snd = soundById(s.soundId);
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => ambient.toggle()}
        aria-label={s.playing ? "Tạm dừng âm thanh" : "Phát âm thanh"}
        className="btn-press flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink"
      >
        {s.playing ? (
          <Ico className="h-6 w-6">
            <path d="M8 5v14M16 5v14" strokeWidth={3} />
          </Ico>
        ) : (
          <Ico className="h-6 w-6">
            <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
          </Ico>
        )}
      </button>
      <div className="mt-4 flex w-full max-w-sm items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Âm thanh trước"
          onClick={() => ambient.stepSound(-1)}
          className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
        >
          <Ico className="h-6 w-6">
            <path d="M6 5v14M19 5L9 12l10 7z" />
          </Ico>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-display text-2xl uppercase text-white">{snd.name}</p>
          <p className="text-sm text-white/60">{snd.desc}</p>
        </div>
        <button
          type="button"
          aria-label="Âm thanh sau"
          onClick={() => ambient.stepSound(1)}
          className="rounded-full p-2 text-white transition-colors hover:bg-white/10"
        >
          <Ico className="h-6 w-6">
            <path d="M18 5v14M5 5l10 7-10 7z" />
          </Ico>
        </button>
      </div>
      <p className="mt-2 text-xs text-white/50">
        {s.playing ? "Đang phát · âm thanh được tạo ngay trong trình duyệt" : "Âm nền cho lúc học, bấm phát để nghe"}
      </p>
    </div>
  );
}