"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const FADE = 28; // độ cao vùng mờ ở mép (px)
const MIN_DOTS = 3;
const MAX_DOTS = 7;

// Khung cuộn riêng: ẩn thanh cuộn, thay bằng hàng chấm chỉ vị trí ở mép phải
// (chấm đang xem to và đậm, chuyển mượt). Mép trên/dưới mờ dần khi còn nội dung.
// Chấm bấm được để nhảy tới đoạn tương ứng. Bàn phím vẫn cuộn bằng phím mũi tên như thường.
// focusKey: khi đổi, tự cuộn tới phần tử có data-current="true" trong khung.
export default function ScrollArea({
  children,
  label,
  maxHeight = 360,
  className = "",
  focusKey,
}: {
  children: ReactNode;
  label: string;
  maxHeight?: number | string;
  className?: string;
  focusKey?: string | number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  const [dots, setDots] = useState({ n: 0, cur: 0 }); // n = 0: không cần cuộn, ẩn chấm

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdge((p) => (p.top === top && p.bottom === bottom ? p : { top, bottom }));
    if (max <= 1) {
      setDots((p) => (p.n === 0 ? p : { n: 0, cur: 0 }));
      return;
    }
    const pages = el.scrollHeight / el.clientHeight;
    const n = Math.max(MIN_DOTS, Math.min(MAX_DOTS, Math.ceil(pages) + 1));
    const cur = Math.round((el.scrollTop / max) * (n - 1));
    setDots((p) => (p.n === n && p.cur === cur ? p : { n, cur }));
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current); // nội dung đổi chiều cao thì đo lại
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const c = box.current;
    if (!c || focusKey === undefined || focusKey === null) return;
    const el = c.querySelector<HTMLElement>('[data-current="true"]');
    if (!el) return;
    const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop;
    c.scrollTo({ top: Math.max(0, top - c.clientHeight / 2 + el.clientHeight / 2), behavior: behavior() });
  }, [focusKey]);

  function behavior(): ScrollBehavior {
    const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return calm ? "auto" : "smooth";
  }

  function jump(k: number) {
    const el = box.current;
    if (!el || dots.n < 2) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTo({ top: (max * k) / (dots.n - 1), behavior: behavior() });
  }

  const mask = `linear-gradient(to bottom, ${edge.top ? "transparent" : "#000"} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${
    edge.bottom ? "transparent" : "#000"
  } 100%)`;

  const hasDots = dots.n > 0;

  return (
    <div className="relative">
      <div
        ref={box}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        style={{ maxHeight, maskImage: mask, WebkitMaskImage: mask }}
        className={`overflow-y-auto overscroll-contain [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt [&::-webkit-scrollbar]:hidden ${className}`}
      >
        <div ref={inner} className={hasDots ? "pr-5" : ""}>
          {children}
        </div>
      </div>

      {hasDots && (
        <div
          aria-hidden="true"
          className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col items-center"
        >
          {Array.from({ length: dots.n }, (_, k) => (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              onClick={() => jump(k)}
              className="flex h-4 w-4 items-center justify-center"
            >
              <i
                className={`block h-1.5 w-1.5 rounded-full transition-[transform,background-color] duration-300 ${
                  k === dots.cur ? "scale-150 bg-ink" : "bg-ink/25"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
