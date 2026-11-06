"use client";

import { useEffect, useRef, useState } from "react";

function reduced(): boolean {
  return (
    document.documentElement.dataset.reduceMotion === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function CountUp({
  value,
  suffix = "",
  duration = 700,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    let raf = 0;

    if (reduced()) {
      raf = requestAnimationFrame(() => {
        from.current = value;
        setShown(value);
      });
      return () => cancelAnimationFrame(raf);
    }

    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (value - start) * eased);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {shown}
      {suffix}
    </>
  );
}