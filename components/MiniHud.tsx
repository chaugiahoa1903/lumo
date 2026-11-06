"use client";

import { formatClock } from "@/lib/focus";
import { useAmbient } from "@/lib/ambient";
import { soundPlay, soundStop } from "@/lib/audioSource";

// Viên thuốc gọn ở đầu cảnh học: vòng giờ, giờ còn lại, tạm dừng, bật/tắt nhạc.
export default function MiniHud({
  remainingSec,
  totalSec,
  ticking,
  over,
  onToggle,
}: {
  remainingSec: number;
  totalSec: number;
  ticking: boolean;
  over: boolean;
  onToggle: () => void;
}) {
  const amb = useAmbient();
  const playing = amb.playing;
  const frac = totalSec > 0 ? Math.min(1, Math.max(0, 1 - remainingSec / totalSec)) : 0;
  const r = 12;
  const c = 2 * Math.PI * r;
  const tone = over ? "border-ink bg-amber-retro text-ink" : "border-white/20 bg-[#070b24]/80 text-white";

  return (
    <div className={`flex items-center gap-2 rounded-full border py-1 pl-2 pr-1.5 backdrop-blur ${tone}`}>
      <svg viewBox="0 0 30 30" className="h-7 w-7 -rotate-90" aria-hidden>
        <circle cx="15" cy="15" r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
        <circle
          cx="15"
          cy="15"
          r={r}
          fill="none"
          stroke={over ? "#0e0e0e" : "#82c8e5"}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span role="timer" aria-label={`Còn ${formatClock(remainingSec)}`} className="font-display text-xl leading-none">
        {formatClock(remainingSec)}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          over ? "border-ink hover:bg-black/10" : "border-white/30 hover:bg-white/15"
        }`}
      >
        {ticking ? "Tạm dừng" : "Tiếp tục"}
      </button>
      <button
        type="button"
        onClick={() => (playing ? soundStop() : soundPlay())}
        aria-label={playing ? "Tắt nhạc" : "Bật nhạc"}
        aria-pressed={playing}
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          playing ? (over ? "bg-ink text-white" : "bg-white text-ink") : over ? "border border-ink" : "border border-white/30"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </svg>
      </button>
    </div>
  );
}