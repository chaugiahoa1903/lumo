"use client";

import { formatClock } from "@/lib/focus";

const SIZE = {
  lg: "w-[300px] lg:w-[320px]",
  md: "w-[230px]",
  fit: "w-[clamp(210px,38vh,330px)]",
} as const;
const TEXT = {
  lg: "mt-1 text-7xl",
  md: "mt-1 text-6xl",
  fit: "mt-1 [font-size:clamp(2.6rem,9vh,4.6rem)]",
} as const;

// Đồng hồ tròn: đếm ngược một hiệp, chấm vàng chạy quanh vành.
export default function TimerDial({
  remainingSec,
  totalSec,
  label,
  size = "lg",
}: {
  remainingSec: number;
  totalSec: number;
  label: string;
  size?: "lg" | "md" | "fit";
}) {
  const frac = totalSec > 0 ? Math.min(1, Math.max(0, 1 - remainingSec / totalSec)) : 0;
  const r = 47;
  const c = 2 * Math.PI * r;
  const ang = frac * 2 * Math.PI;
  const dx = 50 + r * Math.cos(ang);
  const dy = 50 + r * Math.sin(ang);

  return (
    <div
      role="timer"
      aria-label={`Còn ${formatClock(remainingSec)} trong ${formatClock(totalSec)}`}
      className={`dial-glow relative aspect-square shrink-0 rounded-full bg-[#f5f5f7] text-ink ${SIZE[size]}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#d9dde6" strokeWidth="0.8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#0047ab"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.4s linear" }}
        />
        <circle cx={dx} cy={dy} r="2.4" fill="#d4a05f" stroke="#0e0e0e" strokeWidth="0.5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-xs uppercase tracking-widest text-neutral-500">{label}</p>
        <p className={`font-display leading-none ${TEXT[size]}`}>{formatClock(remainingSec)}</p>
        <p className="mt-2 text-sm text-neutral-500">/ {formatClock(totalSec)}</p>
      </div>
    </div>
  );
}