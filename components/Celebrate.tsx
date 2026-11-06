"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

const COLORS = ["#82c8e5", "#ffffff", "#d4a05f", "#3b8cf0", "#b8dcff"];

// Số giả ngẫu nhiên ổn định theo (i, k), nằm trong [0, 1).
function hash(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Hiệu ứng mỗi lần "Xong": vòng tích nảy lên và pháo giấy bay từ giữa màn hình.
export default function Celebrate({ big = false }: { big?: boolean }) {
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setAlive(false), big ? 2800 : 2200);
    return () => window.clearTimeout(id);
  }, [big]);

  const pieces = useMemo(() => {
    const n = big ? 64 : 36;
    return Array.from({ length: n }, (_, i) => {
      const side = hash(i, 1) < 0.5 ? -1 : 1;
      const round = hash(i, 7) < 0.3;
      return {
        w: round ? 7 : 6 + hash(i, 2) * 5,
        h: round ? 7 : 10 + hash(i, 3) * 7,
        round,
        color: COLORS[Math.floor(hash(i, 4) * COLORS.length)],
        dx: side * (70 + hash(i, 5) * 360),
        up: 120 + hash(i, 6) * 190,
        fall: 160 + hash(i, 8) * 360,
        rot: side * (240 + hash(i, 9) * 600),
        delay: hash(i, 10) * 0.15,
        dur: 1.5 + hash(i, 11) * 0.7,
      };
    });
  }, [big]);

  if (!alive) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div
        className="badge-pop absolute left-1/2 top-[22%] flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/50 bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_16px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl"
      >
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute left-1/2 top-[38%]"
          style={
            {
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: p.round ? "9999px" : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              "--dx": `${p.dx}px`,
              "--up": `${p.up}px`,
              "--fall": `${p.fall}px`,
              "--rot": `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}