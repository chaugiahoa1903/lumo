"use client";

// Phóng to theo con trỏ: lấy ý tưởng từ "Cursor-magnified app dock"
// (Lucian UX/UI Prompt #208, MIT, (c) 2026 Seokwoooo). Chỉ dùng transform, không đổi bố cục.
import { useEffect, useRef, type ReactNode } from "react";
import { readSettings } from "@/lib/settings";

const MAX = 0.35;
const SPREAD = 70;

function isReduced() {
  let r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    if (readSettings().reduceMotion) r = true;
  } catch {
    /* bỏ qua */
  }
  return r;
}

// Bọc các phần tử con có thuộc tính data-dock.
export default function DockNav({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  const wrap = useRef<HTMLElement>(null);
  const st = useRef({ mx: null as number | null, s: [] as number[], raf: 0 });

  useEffect(() => {
    const state = st.current;
    return () => cancelAnimationFrame(state.raf);
  }, []);

  function frame() {
    const w = wrap.current;
    const s = st.current;
    s.raf = 0;
    if (!w) return;
    let busy = false;
    w.querySelectorAll<HTMLElement>("[data-dock]").forEach((el, i) => {
      const c = el.offsetLeft + el.offsetWidth / 2;
      let tg = 1;
      if (s.mx !== null) {
        const d = (s.mx - c) / SPREAD;
        tg = 1 + MAX * Math.exp(-d * d * 1.6);
      }
      const cur = s.s[i] ?? 1;
      let nx = cur + (tg - cur) * 0.28;
      if (Math.abs(tg - nx) > 0.002) busy = true;
      else nx = tg;
      s.s[i] = nx;
      el.style.transform = nx === 1 ? "" : `translateY(${(-(nx - 1) * 10).toFixed(2)}px) scale(${nx.toFixed(3)})`;
    });
    if (busy) s.raf = requestAnimationFrame(frame);
  }

  function run() {
    if (!st.current.raf) st.current.raf = requestAnimationFrame(frame);
  }

  return (
    <nav
      ref={wrap}
      aria-label={label}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType === "touch" || isReduced()) return;
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
      {children}
    </nav>
  );
}