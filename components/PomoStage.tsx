"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BLOCK_OPTIONS } from "@/lib/focus";
import { SOUNDS } from "@/lib/sounds";
import { ambient, useAmbient } from "@/lib/ambient";
import { useSettings } from "@/lib/settings";
import { setVol, soundPlay, soundStop } from "@/lib/audioSource";
import { wheelRadius } from "@/lib/wheelGeometry";
import TimerDial from "@/components/TimerDial";
import Wheel from "@/components/Wheel";

export function Ico({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const toolBtn =
  "flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40";

function VolumePill({ desc }: { desc: string }) {
  const amb = useAmbient();
  const [settings, update] = useSettings();
  const playing = amb.playing;
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-3 rounded-full bg-white/10 p-2 pr-5 backdrop-blur">
        <button
          type="button"
          aria-label={playing ? "Dừng nhạc" : "Phát nhạc"}
          aria-pressed={playing}
          onClick={() => (playing ? soundStop() : soundPlay())}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            playing ? "bg-white text-ink" : "border border-white/40 text-white hover:bg-white/10"
          }`}
        >
          <Ico>
            <path d="M9 18V5l11-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="17" cy="16" r="3" />
          </Ico>
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(amb.volume * 100)}
          onChange={(e) => setVol(Number(e.target.value) / 100)}
          aria-label="Âm lượng"
          className="h-1 w-28 cursor-pointer accent-white"
        />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={settings.autoSound}
        onClick={() => update({ autoSound: !settings.autoSound })}
        className="flex items-center gap-2 pl-3 text-xs text-white/80 hover:text-white"
      >
        <span
          className={`relative h-4 w-7 rounded-full border border-white/40 transition-colors ${
            settings.autoSound ? "bg-amber-retro" : "bg-transparent"
          }`}
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${
              settings.autoSound ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
        Nhạc chạy và dừng theo đồng hồ
      </button>
      <p className="max-w-[260px] truncate pl-3 text-[11px] text-white/65">{desc}</p>
    </div>
  );
}

interface Props {
  label: string;
  roundText: string;
  running: boolean;
  remainingSec: number;
  totalSec: number;
  focusMin: number;
  focusLocked: boolean;
  onFocusMin: (m: number) => void;
  onSetup: () => void;
  mainIcon: "play" | "pause" | "skip";
  mainLabel: string;
  onMain: () => void;
  mainDisabled?: boolean;
  title: string;
  subtitle: string;
  onPrev?: () => void; // không còn dùng (đã bỏ nút trước/sau), giữ để nơi gọi không phải sửa
  onNext?: () => void; // không còn dùng
  tools?: ReactNode;
  canLearn: boolean;
  onLearn: () => void;
}

// Cảnh đồng hồ: đồng hồ ở giữa, hai bánh xe uốn theo vòng tròn đồng hồ (trái: âm nền, phải: độ dài hiệp).
export default function PomoStage(p: Props) {
  const amb = useAmbient();
  const [R, setR] = useState(320);

  useEffect(() => {
    const f = () => setR(wheelRadius(window.innerWidth, window.innerHeight));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const idx = Math.max(0, SOUNDS.findIndex((s) => s.id === amb.soundId));
  const item = SOUNDS[idx];
  const soundItems = SOUNDS.map((s) => ({ key: s.id, label: s.name }));

  const blockOpts = BLOCK_OPTIONS.includes(p.focusMin)
    ? BLOCK_OPTIONS
    : [...BLOCK_OPTIONS, p.focusMin].sort((a, b) => a - b);
  const blockItems = blockOpts.map((m) => ({ key: m, label: `${m} phút` }));
  const blockIndex = Math.max(0, blockOpts.indexOf(p.focusMin));

  const sel = "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur";

  const mainIcon =
    p.mainIcon === "pause" ? (
      <path d="M8 5v14M16 5v14" strokeWidth={3} />
    ) : p.mainIcon === "skip" ? (
      <path d="M5 5l9 7-9 7zM18 5v14" />
    ) : (
      <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
    );

  const toolsBlock = (
    <div className="flex items-center gap-2 rounded-full bg-white/10 p-2 backdrop-blur">
      {p.tools}
      <button type="button" aria-label="Thiết lập hiệp" title="Thiết lập hiệp" onClick={p.onSetup} className={toolBtn}>
        <Ico className="h-5 w-5">
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </Ico>
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0">
      {/* Chọn nhanh trên màn hẹp (bánh xe chỉ có từ 1024px) */}
      <div className="absolute inset-x-0 top-20 z-10 flex justify-center gap-3 px-4 lg:hidden">
        <select
          aria-label="Âm nền"
          className={sel}
          value={amb.soundId}
          onChange={(e) => ambient.setSound(e.target.value)}
        >
          {SOUNDS.map((s) => (
            <option key={s.id} value={s.id} className="text-ink">
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Độ dài hiệp"
          className={sel}
          disabled={p.focusLocked}
          value={p.focusMin}
          onChange={(e) => p.onFocusMin(Number(e.target.value))}
        >
          {blockOpts.map((m) => (
            <option key={m} value={m} className="text-ink">
              {m} phút
            </option>
          ))}
        </select>
      </div>

      {/* Tâm đồng hồ: vòng tròn, hai bánh xe và đồng hồ cùng nằm quanh điểm này */}
      <div className="absolute left-1/2 z-10" style={{ top: "40%" }}>
        <div aria-hidden className="pointer-events-none hidden lg:block">
          <div
            className="absolute rounded-full border border-white/25"
            style={{ width: 2 * R, height: 2 * R, left: -R, top: -R }}
          />
          <div
            className="absolute rounded-full border border-white/10"
            style={{ width: 2.6 * R, height: 2.6 * R, left: -1.3 * R, top: -1.3 * R }}
          />
        </div>

        <div className="hidden lg:block">
          <Wheel
            side="left"
            label="Chọn âm nền"
            items={soundItems}
            index={idx}
            radius={R}
            onChange={(i) => ambient.setSound(SOUNDS[i].id)}
          />
          <Wheel
            side="right"
            label="Chọn độ dài hiệp"
            items={blockItems}
            index={blockIndex}
            radius={R}
            disabled={p.focusLocked}
            onChange={(i) => p.onFocusMin(blockOpts[i])}
          />
        </div>

        <div className="absolute" style={{ transform: "translate(-50%, -50%)" }}>
          <TimerDial size="fit" label={p.label} remainingSec={p.remainingSec} totalSec={p.totalSec} />
        </div>
      </div>

      {/* Thanh dưới: âm lượng, nút chính cùng thông tin task, công cụ */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-5 md:px-10">
        <div className="relative mx-auto grid max-w-[1200px] items-end gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="hidden lg:block">
            <VolumePill desc={`♪ ${item.name} · ${item.desc}`} />
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={p.onMain}
              disabled={p.mainDisabled}
              aria-label={p.mainLabel}
              className="btn-press flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ico className="h-6 w-6">{mainIcon}</Ico>
            </button>
            <p
              className="mt-2 text-xs font-semibold uppercase tracking-widest text-white"
              style={{ textShadow: "0 1px 10px rgba(0,0,0,0.7)" }}
            >
              {p.mainLabel} · {p.roundText}
            </p>

            <div className="mt-3 w-[min(92vw,460px)] rounded-3xl border border-white/20 bg-[#060a22]/60 px-5 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <p className="truncate font-display text-2xl uppercase text-white">{p.title}</p>
              <p className="truncate text-sm text-white/90">{p.subtitle}</p>
            </div>

            {p.canLearn && (
              <button
                type="button"
                onClick={p.onLearn}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky/60 bg-[#060a22]/65 px-6 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_0_3px_rgba(130,200,229,0.12),0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-150 hover:bg-[#0c1a4a]/80 active:scale-[0.97]"
              >
                <Ico className="h-4 w-4">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </Ico>
                Quay lại bài học
              </button>
            )}

            <div className="mt-3 flex flex-col items-center gap-3 lg:hidden">
              <VolumePill desc={`♪ ${item.name} · ${item.desc}`} />
              {toolsBlock}
            </div>
          </div>

          <div className="hidden justify-end lg:flex">{toolsBlock}</div>
        </div>
      </div>
    </div>
  );
}