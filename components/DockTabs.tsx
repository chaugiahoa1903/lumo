"use client";

// Tab phóng to theo con trỏ: cấu trúc và chuyển động lấy từ "Cursor-magnified app dock"
// (Lucian UX/UI Prompt #208, MIT, (c) 2026 Seokwoooo).
import { useEffect, useRef } from "react";
import { readSettings } from "@/lib/settings";

export interface DockItem {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

const MAX = 1.45;
const SPREAD = 80;
const GAP = 8;

function isReduced() {
  let r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    if (readSettings().reduceMotion) r = true;
  } catch {
    /* bỏ qua */
  }
  return r;
}

export default function DockTabs({ items, label, className = "" }: { items: DockItem[]; label: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLSpanElement | null)[]>([]);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const st = useRef({ mx: null as number | null, s: [] as number[], base: [] as number[], raf: 0 });
  const sig = items.map((i) => i.label).join("|");

  useEffect(() => {
    st.current.base = btns.current.map((b) => (b ? b.offsetWidth : 0));
  }, [sig]);

  useEffect(() => {
    const state = st.current;
    return () => cancelAnimationFrame(state.raf);
  }, []);

  function frame() {
    const s = st.current;
    s.raf = 0;
    let busy = false;
    let x = 0;
    btns.current.forEach((b, i) => {
      const base = s.base[i] ?? 0;
      const c = x + base / 2;
      x += base + GAP;
      let tg = 1;
      if (s.mx !== null) {
        const d = (s.mx - c) / SPREAD;
        tg = 1 + (MAX - 1) * Math.exp(-d * d * 1.6);
      }
      const cur = s.s[i] ?? 1;
      let nx = cur + (tg - cur) * 0.28;
      if (Math.abs(tg - nx) > 0.002) busy = true;
      else nx = tg;
      s.s[i] = nx;
      const cell = cells.current[i];
      if (cell && b) {
        cell.style.width = nx === 1 ? "" : `${(base * nx).toFixed(1)}px`;
        b.style.transform = nx === 1 ? "" : `scale(${nx.toFixed(3)})`;
      }
    });
    if (busy) s.raf = requestAnimationFrame(frame);
  }

  function run() {
    if (!st.current.raf) st.current.raf = requestAnimationFrame(frame);
  }

  return (
    <div
      ref={wrap}
      role="tablist"
      aria-label={label}
      className={`flex items-end gap-2 pt-3 ${className}`}
      onPointerMove={(e) => {
        if (isReduced() || e.pointerType === "touch") return;
        const r = wrap.current?.getBoundingClientRect();
        if (!r) return;
        st.current.mx = e.clientX - r.left;
        run();
      }}
      onPointerLeave={() => {
        st.current.mx = null;
        run();
      }}
    >
      {items.map((it, i) => (
        <span
          key={it.id}
          ref={(el) => {
            cells.current[i] = el;
          }}
          className="inline-flex flex-none"
        >
          <button
            ref={(el) => {
              btns.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={it.active}
            onClick={it.onSelect}
            style={{ transformOrigin: "left bottom" }}
            className={`whitespace-nowrap rounded-full border-2 border-ink px-4 py-1.5 text-sm font-semibold transition-colors ${
              it.active ? "bg-cobalt text-white" : "bg-white hover:bg-sky/40"
            }`}
          >
            {it.label}
          </button>
        </span>
      ))}
    </div>
  );
}