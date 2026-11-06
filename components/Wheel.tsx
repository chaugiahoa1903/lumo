"use client";

import { useCallback, useEffect, useRef } from "react";

export interface WheelItem {
  key: string | number;
  label: string;
}

const STEP = 52; // px giữa hai mục

// Bánh xe chọn kiểu Apple Watch: mục giữa to và đậm, mục xa mờ dần và cong vào tâm.
// Điều khiển bằng cuộn chuột, kéo, hoặc phím mũi tên khi đang focus.
export default function Wheel({
  items,
  index,
  onChange,
  side,
  label,
  disabled = false,
}: {
  items: WheelItem[];
  index: number;
  onChange: (i: number) => void;
  side: "left" | "right";
  label: string;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(index);
  const cbRef = useRef(onChange);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const dragRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const count = items.length;

  useEffect(() => {
    idxRef.current = index;
    cbRef.current = onChange;
  });

  const move = useCallback(
    (dir: number) => {
      const next = Math.min(count - 1, Math.max(0, idxRef.current + dir));
      if (next !== idxRef.current) {
        idxRef.current = next;
        cbRef.current(next);
      }
    },
    [count]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el || disabled || count < 2) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accRef.current += e.deltaY;
      const now = performance.now();
      if (Math.abs(accRef.current) >= 50 && now - lastRef.current > 80) {
        move(accRef.current > 0 ? 1 : -1);
        accRef.current = 0;
        lastRef.current = now;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [move, disabled, count]);

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        } else if (e.key === "Home") {
          e.preventDefault();
          move(-count);
        } else if (e.key === "End") {
          e.preventDefault();
          move(count);
        }
      }}
      onPointerDown={(e) => {
        if (disabled) return;
        dragRef.current = e.clientY;
        movedRef.current = false;
      }}
      onPointerMove={(e) => {
        const y0 = dragRef.current;
        if (y0 === null) return;
        const dy = e.clientY - y0;
        if (Math.abs(dy) >= 34) {
          move(dy < 0 ? 1 : -1);
          dragRef.current = e.clientY;
          movedRef.current = true;
        }
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
      }}
      style={{ touchAction: "none" }}
      className={`relative h-[360px] w-[220px] select-none rounded-xl outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-sky/60 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {items.map((it, i) => {
        const off = i - index;
        const abs = Math.abs(off);
        const visible = abs <= 3;
        const arc = abs * abs * 10;
        const x = side === "left" ? arc : -arc;
        const rot = (side === "left" ? 1 : -1) * off * 5;
        const selected = off === 0;
        return (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            disabled={disabled || !visible}
            onClick={() => {
              if (movedRef.current) {
                movedRef.current = false;
                return;
              }
              if (i !== idxRef.current) {
                idxRef.current = i;
                onChange(i);
              }
            }}
            className={`absolute inset-x-0 flex h-9 items-center gap-2 transition-[transform,opacity] duration-300 ease-out ${
              side === "left" ? "justify-end" : "flex-row-reverse justify-end"
            }`}
            style={{
              top: "calc(50% - 18px)",
              transform: `translate(${x}px, ${off * STEP}px) rotate(${rot}deg)`,
              opacity: visible ? Math.max(0, 1 - abs * 0.27) : 0,
              pointerEvents: visible ? "auto" : "none",
            }}
          >
            <span
              className={`max-w-[150px] truncate ${
                selected ? "text-xl font-bold text-white" : "text-[15px] font-medium text-white/60"
              }`}
            >
              {it.label}
            </span>
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${selected ? "bg-amber-retro" : "bg-transparent"}`}
            />
          </button>
        );
      })}
    </div>
  );
}