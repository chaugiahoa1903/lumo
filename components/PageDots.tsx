"use client";

import { useCallback, useEffect, useState } from "react";

const MIN_DOTS = 3;
const MAX_DOTS = 7;

// Thay thanh cuộn của cả trang bằng hàng chấm cố định ở mép phải.
// Thanh cuộn gốc được ẩn bằng CSS trong globals.css (khối "lumo-hide-page-scrollbar").
export default function PageDots() {
  const [dots, setDots] = useState({ n: 0, cur: 0 });

  const measure = useCallback(() => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 4) {
      setDots((p) => (p.n === 0 ? p : { n: 0, cur: 0 }));
      return;
    }
    const pages = el.scrollHeight / el.clientHeight;
    const n = Math.max(MIN_DOTS, Math.min(MAX_DOTS, Math.ceil(pages) + 1));
    const cur = Math.round((Math.min(max, Math.max(0, window.scrollY)) / max) * (n - 1));
    setDots((p) => (p.n === n && p.cur === cur ? p : { n, cur }));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure); // trang đổi chiều cao (đổi route, mở/đóng nội dung) thì đo lại
      ro.observe(document.body);
    }
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure]);

  function jump(k: number) {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: (max * k) / (dots.n - 1), behavior: calm ? "auto" : "smooth" });
  }

  if (dots.n === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed right-1.5 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center rounded-full border border-white/20 bg-ink/70 py-1 backdrop-blur-sm"
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
              k === dots.cur ? "scale-150 bg-white" : "bg-white/35"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
