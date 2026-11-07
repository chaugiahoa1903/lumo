"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ambient, useAmbient } from "@/lib/ambient";
import { SOUNDS, soundById } from "@/lib/sounds";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(cb: () => void) {
  const m = window.matchMedia(MOTION_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => true
  );
}

const BARS = 5;

// Vài vạch nhỏ, chuyển động chậm, biên độ thấp. Chỉ chạy khi đang phát và không bật "giảm chuyển động".
function Bars({ active }: { active: boolean }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const els = refs.current;
    const reset = () => els.forEach((el) => el && (el.style.height = "3px"));
    if (!active) {
      reset();
      return;
    }
    const cur = new Array<number>(BARS).fill(0);
    let raf = 0;
    const loop = () => {
      const b = ambient.getBands(BARS);
      for (let i = 0; i < BARS; i++) {
        cur[i] += (b[i] - cur[i]) * 0.08;
        const el = els[i];
        if (el) el.style.height = `${3 + cur[i] * 9}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      reset();
    };
  }, [active]);
  return (
    <span aria-hidden className="flex h-4 items-end gap-[3px]">
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="w-[3px] rounded-full bg-white/70"
          style={{ height: 3 }}
        />
      ))}
    </span>
  );
}

// Tên bài là một nút: bấm để mở trống cuộn nhỏ, cuộn tới bài nào thì đổi sang bài đó.
// Cấu trúc và chuyển động lấy từ "Rolling drum time picker" (Lucian UX/UI Prompt #362, MIT, (c) 2026 Seokwoooo).
const IH = 28;
const ROWS = 5;
const PAD = IH * 2;

function bend(el: HTMLElement, flat: boolean) {
  const mid = el.scrollTop + (IH * ROWS) / 2;
  el.querySelectorAll<HTMLElement>("li").forEach((li, k) => {
    const d = (k * IH + PAD + IH / 2 - mid) / IH;
    if (flat) {
      li.style.transform = "";
      li.style.opacity = Math.max(0.3, 1 - Math.abs(d) * 0.3).toFixed(2);
      return;
    }
    const a = Math.max(-80, Math.min(80, d * 22));
    li.style.transform = `rotateX(${(-a).toFixed(1)}deg) translateZ(${(-Math.abs(d) * 4).toFixed(1)}px)`;
    li.style.opacity = Math.max(0.15, 1 - Math.abs(d) * 0.28).toFixed(2);
  });
}

function TrackPicker({ soundId, name, up }: { soundId: string; name: string; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const col = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const raf = useRef(0);
  const idRef = useRef(soundId);
  const reduced = useReducedMotion();
  const idx = Math.max(0, SOUNDS.findIndex((s) => s.id === soundId));

  useEffect(() => {
    idRef.current = soundId;
  });

  useEffect(() => {
    if (!open) return;
    const el = col.current;
    if (el) {
      el.scrollTop = idx * IH;
      bend(el, reduced);
      el.focus({ preventScroll: true });
    }
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.clearTimeout(timer.current);
      cancelAnimationFrame(raf.current);
    };
    // chỉ chạy lúc mở; idx lấy đúng giá trị tại thời điểm mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const goTo = (k: number) => {
    const n = Math.max(0, Math.min(SOUNDS.length - 1, k));
    col.current?.scrollTo({ top: n * IH, behavior: reduced ? "auto" : "smooth" });
  };

  const onScroll = () => {
    const el = col.current;
    if (!el) return;
    if (!raf.current) {
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        bend(el, reduced);
      });
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const k = Math.max(0, Math.min(SOUNDS.length - 1, Math.round(el.scrollTop / IH)));
      if (SOUNDS[k].id !== idRef.current) ambient.setSound(SOUNDS[k].id);
    }, 150);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const el = col.current;
    goTo((el ? Math.round(el.scrollTop / IH) : idx) + d);
  };

  const mask = "linear-gradient(transparent, #000 30%, #000 70%, transparent)";

  return (
    <div ref={box} className={`relative min-w-0 ${up ? "" : "flex-1"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chọn bài"
        className="flex max-w-full items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <span className="truncate">{name}</span>
        <span aria-hidden className="text-[10px] opacity-70">
          ▾
        </span>
      </button>
      {open && (
        <div
          className={`absolute bottom-full mb-2 w-44 rounded-2xl border border-white/20 bg-[#070b24] p-1 shadow-xl ${
            up ? "right-0" : "left-0"
          }`}
        >
          <div className="relative" style={{ height: IH * ROWS, WebkitMaskImage: mask, maskImage: mask }}>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 rounded-xl bg-white/15"
              style={{ top: PAD, height: IH }}
            />
            <div
              ref={col}
              tabIndex={0}
              role="listbox"
              aria-label="Chọn bài nhạc"
              aria-activedescendant={`trk-${SOUNDS[idx].id}`}
              onScroll={onScroll}
              onKeyDown={onKey}
              className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:shadow-[inset_0_0_0_2px_#fff]"
              style={{ perspective: 300 }}
            >
              <ul className="m-0 list-none p-0" style={{ padding: `${PAD}px 0` }}>
                {SOUNDS.map((s, i) => (
                  <li
                    key={s.id}
                    id={`trk-${s.id}`}
                    role="option"
                    aria-selected={i === idx}
                    onClick={() => goTo(i)}
                    className="flex cursor-pointer snap-center items-center justify-center px-2 text-sm font-semibold text-white"
                    style={{ height: IH, transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
                  >
                    <span className="truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const btn =
  "flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

export default function MiniPlayer() {
  const s = useAmbient();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [seen, setSeen] = useState(false);

  // Sau khi đã phát một lần, giữ thanh lại để người dùng bấm phát tiếp được.
  useEffect(() => {
    if (s.playing) setSeen(true);
  }, [s.playing]);

  if (!s.playing && !seen) return null;

  const compact = pathname.startsWith("/study");
  const name = soundById(s.soundId).name;

  const controls = (
    <>
      <button type="button" className={btn} onClick={() => ambient.stepSound(-1)} aria-label="Bài trước">
        ⏮
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-ink"
        onClick={() => ambient.toggle()}
        aria-label={s.playing ? "Dừng nhạc" : "Phát nhạc"}
      >
        {s.playing ? "❚❚" : "▶"}
      </button>
      <button type="button" className={btn} onClick={() => ambient.stepSound(1)} aria-label="Bài sau">
        ⏭
      </button>
    </>
  );

  const volume = (w: string) => (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={s.volume}
      onChange={(e) => ambient.setVolume(Number(e.target.value))}
      aria-label="Âm lượng"
      className={`${w} accent-white`}
    />
  );

  if (compact) {
    return (
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-1 rounded-full border border-white/20 bg-[#070b24] py-1 pl-2 pr-1 text-xs text-white">
        <span aria-hidden>♪</span>
        <TrackPicker soundId={s.soundId} name={name} up />
        {controls}
        {volume("w-16")}
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-[#070b24] py-1.5 pl-4 pr-2 text-sm text-white md:bottom-6">
      {!reduced && <Bars active={s.playing} />}
      <TrackPicker soundId={s.soundId} name={name} />
      {controls}
      {volume("w-20 md:w-28")}
    </div>
  );
}