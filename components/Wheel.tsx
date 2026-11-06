"use client";

import { useCallback, useEffect, useRef } from "react";
import { STEP_DEG, arcPoint, arcRotation, type Side } from "@/lib/wheelGeometry";

export interface WheelItem {
  key: string | number;
  label: string;
}

const GAP = 16;
const VISIBLE = 3;

// Bánh xe kiểu Apple Watch, các mục xếp trên một cung tròn đồng tâm với đồng hồ.
// Gốc toạ độ (0, 0) của bánh xe là tâm đồng hồ. Điều khiển bằng cuộn chuột, kéo, hoặc phím mũi tên.
export default function Wheel({
  items,
  index,
  onChange,
  side,
  label,
  radius,
  disabled = false,
}: {
  items: { key: string | number; label: string }[];
  index: number;
  onChange: (i: number) => void;
  side: Side;
  label: string;
  radius: number;
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

  const hitH = 2 * radius * Math.sin((VISIBLE * STEP_DEG * Math.PI) / 180) + 110;
  const hitLeft = side === "left" ? -radius - 240 : radius - 140;

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
      style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, touchAction: "none" }}
      className={`group outline-none ${disabled ? "opacity-40" : ""}`}
    >
      {/* vùng nhận cuộn và kéo bao quanh cung */}
      <div
        aria-hidden
        style={{ position: "absolute", left: hitLeft, top: -hitH / 2, width: 360, height: hitH }}
        className="rounded-[2rem] transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-sky/60"
      />

      {items.map((it, i) => {
        const off = i - index;
        const abs = Math.abs(off);
        const visible = abs <= VISIBLE;
        const { x, y } = arcPoint(off, side, radius);
        const rot = arcRotation(off, side);
        const selected = off === 0;
        const sz = selected ? 11 : 5;
        return (
          <div
            key={it.key}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
              opacity: visible ? Math.max(0, 1 - abs * 0.25) : 0,
              pointerEvents: visible && !disabled ? "auto" : "none",
              transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms",
            }}
          >
            <span
              aria-hidden
              className={`absolute rounded-full transition-all duration-300 ${
                selected ? "bg-amber-retro shadow-[0_0_14px_#d4a05f]" : "bg-white/45"
              }`}
              style={{ left: -sz / 2, top: -sz / 2, width: sz, height: sz }}
            />
            <button
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
              className={`absolute top-0 -translate-y-1/2 max-w-[190px] truncate whitespace-nowrap px-1 py-1 text-left transition-colors ${
                selected ? "text-xl font-bold text-white" : "text-[15px] font-medium text-white/70 hover:text-white"
              }`}
              style={{ ...(side === "left" ? { right: GAP } : { left: GAP }), textShadow: "0 1px 10px rgba(0,0,0,0.65)" }}
            >
              {it.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}