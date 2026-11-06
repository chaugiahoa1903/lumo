"use client";

import { useEffect, useRef, type ReactNode } from "react";
import GlassBackdrop, { type Mood } from "@/components/GlassBackdrop";

export type Scene = "dial" | "learn";

// Có cuộn được lên nữa không? Duyệt từ phần tử đang trỏ lên đến khung cuộn.
function atTop(el: HTMLElement | null, stop: HTMLElement): boolean {
  let n: HTMLElement | null = el;
  while (n) {
    if (n.scrollTop > 0) return false;
    if (n === stop) break;
    n = n.parentElement;
  }
  return true;
}

// Khung toàn màn hình hai cảnh xếp dọc: đồng hồ ở trên, học/ôn tập ở dưới. Nền là kính vân dọc đứng yên.
export default function StudyFrame({
  scene,
  onScene,
  dial,
  learn,
  canLearn,
  modeLabel,
  headerCenter,
  onExit,
}: {
  scene: Scene;
  onScene: (s: Scene) => void;
  dial: ReactNode;
  learn: ReactNode;
  canLearn: boolean;
  modeLabel: string;
  mood?: Mood; // không còn dùng (nền không còn đổi theo trạng thái), giữ để nơi gọi không phải sửa
  headerCenter?: ReactNode;
  onExit: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const learnRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(scene);
  const canRef = useRef(canLearn);
  const cbRef = useRef(onScene);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const notTopRef = useRef(0);
  const lockRef = useRef(0);
  const touchRef = useRef<{ y: number; top: boolean } | null>(null);
  const dragRef = useRef<number | null>(null);

  useEffect(() => {
    sceneRef.current = scene;
    canRef.current = canLearn;
    cbRef.current = onScene;
  });

  useEffect(() => {
    document.documentElement.dataset.studyScene = scene;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [scene]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.studyScene;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const go = (s: Scene) => {
      accRef.current = 0;
      lockRef.current = performance.now() + 800;
      cbRef.current(s);
    };
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.closest('[role="listbox"]')) return;
      const now = performance.now();
      if (now < lockRef.current) return;

      if (sceneRef.current === "learn") {
        const sc = learnRef.current;
        if (!sc) return;
        if (e.deltaY >= 0) {
          accRef.current = 0;
          return;
        }
        if (!atTop(t, sc)) {
          notTopRef.current = now;
          accRef.current = 0;
          return;
        }
        if (now - notTopRef.current < 600) return; // đang cuộn quán tính vừa chạm đầu trang
        if (now - lastRef.current > 400) accRef.current = 0;
        lastRef.current = now;
        accRef.current += -e.deltaY;
        if (accRef.current >= 140) go("dial");
      } else if (e.deltaY > 0 && canRef.current) {
        if (now - lastRef.current > 400) accRef.current = 0;
        lastRef.current = now;
        accRef.current += e.deltaY;
        if (accRef.current >= 80) go("learn");
      }
    };
    root.addEventListener("wheel", onWheel, { passive: true });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed left-0 top-0 z-20 overflow-hidden text-white"
      style={{ width: "100vw", height: "100dvh" }}
      onTouchStart={(e) => {
        const sc = learnRef.current;
        const t = e.target as HTMLElement;
        touchRef.current = {
          y: e.touches[0].clientY,
          top: sceneRef.current === "learn" && sc ? atTop(t, sc) : true,
        };
      }}
      onTouchEnd={(e) => {
        const s = touchRef.current;
        touchRef.current = null;
        if (!s) return;
        const t = e.target as HTMLElement;
        if (t.closest('[role="listbox"]')) return;
        const dy = e.changedTouches[0].clientY - s.y;
        if (scene === "learn" && s.top && dy > 120) onScene("dial");
        else if (scene === "dial" && canLearn && dy < -120) onScene("learn");
      }}
    >
      <GlassBackdrop />

      <header className="absolute inset-x-0 top-0 z-30 flex h-[72px] items-center justify-between gap-3 px-6 md:px-10">
        <span className="font-wordmark text-2xl text-white/90">LUMO</span>
        <div className="min-w-0">
          {scene === "learn" ? headerCenter : <span className="text-sm text-white/75">{modeLabel}</span>}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
        >
          Thoát
        </button>
      </header>

      <div
        className="absolute inset-0 z-10"
        style={{
          transform: scene === "learn" ? "translateY(-100%)" : "translateY(0)",
          transition: "transform 750ms cubic-bezier(0.77, 0, 0.18, 1)",
        }}
      >
        <div className="absolute inset-0" inert={scene !== "dial"} aria-hidden={scene !== "dial"}>
          {dial}
        </div>

        <div
          ref={learnRef}
          className="glass-scroll absolute inset-x-0 top-full h-full overflow-y-auto px-4 pb-20 pt-[100px]"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0, transparent 56px, #000 90px)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, transparent 56px, #000 90px)",
          }}
          inert={scene !== "learn"}
          aria-hidden={scene !== "learn"}
        >
          <div className="mx-auto w-full max-w-3xl">
            <button
              type="button"
              onClick={() => onScene("dial")}
              onPointerDown={(e) => {
                dragRef.current = e.clientY;
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (dragRef.current !== null && e.clientY - dragRef.current > 60) {
                  dragRef.current = null;
                  onScene("dial");
                }
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              style={{ touchAction: "none" }}
              className="mx-auto mb-4 flex items-center gap-2 rounded-full border border-white/25 bg-[#060a22]/60 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-xl transition-colors hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 15l6-6 6 6" />
              </svg>
              Về đồng hồ · cuộn lên hoặc kéo xuống
            </button>
            {learn}
          </div>
        </div>
      </div>
    </div>
  );
}