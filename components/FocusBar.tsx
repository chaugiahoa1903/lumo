"use client";

import { formatClock } from "@/lib/focus";
import { ambient, useAmbient } from "@/lib/ambient";
import { soundById } from "@/lib/sounds";

// Thanh đồng hồ mỏng dính phía trên khi đang học: chiếm rất ít chỗ, nội dung học nằm ngay bên dưới.
export default function FocusBar({
  remainingSec,
  totalSec,
  ticking,
  over,
  label,
  roundText,
  onToggle,
}: {
  remainingSec: number;
  totalSec: number;
  ticking: boolean;
  over: boolean;
  label: string;
  roundText: string;
  onToggle: () => void;
}) {
  const s = useAmbient();
  const snd = soundById(s.soundId);
  const frac = totalSec > 0 ? Math.min(1, Math.max(0, 1 - remainingSec / totalSec)) : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  const tone = over ? "border-ink bg-amber-retro text-ink" : "border-white/20 bg-[#070b24]/85 text-white";
  const ghost = over ? "hover:bg-black/10" : "hover:bg-white/15";

  return (
    <div
      className={`sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2.5 backdrop-blur md:top-[84px] ${tone}`}
    >
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={over ? "#0e0e0e" : "#82c8e5"}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.4s linear" }}
        />
      </svg>

      <div role="timer" aria-label={`Còn ${formatClock(remainingSec)} trong hiệp`}>
        <p className="font-display text-2xl leading-none">{formatClock(remainingSec)}</p>
        <p className="mt-0.5 text-xs opacity-80">
          {label} · {roundText}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          over ? "border-ink" : "border-white/30"
        } ${ghost}`}
      >
        {ticking ? "Tạm dừng" : "Tiếp tục"}
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" aria-label="Âm thanh trước" onClick={() => ambient.stepSound(-1)} className={`rounded-full p-1.5 ${ghost}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="max-w-[7.5rem] truncate text-sm font-semibold">{snd.name}</span>
        <button type="button" aria-label="Âm thanh sau" onClick={() => ambient.stepSound(1)} className={`rounded-full p-1.5 ${ghost}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => ambient.toggle()}
          aria-label={s.playing ? "Tạm dừng âm thanh" : "Phát âm thanh"}
          className={`ml-1 flex h-8 w-8 items-center justify-center rounded-full ${over ? "bg-ink text-white" : "bg-white text-ink"}`}
        >
          {s.playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
              <path d="M8 5v14M16 5v14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(s.volume * 100)}
          onChange={(e) => ambient.setVolume(Number(e.target.value) / 100)}
          aria-label="Âm lượng"
          className="ml-2 hidden h-1 w-20 cursor-pointer accent-current sm:block"
        />
      </div>
    </div>
  );
}