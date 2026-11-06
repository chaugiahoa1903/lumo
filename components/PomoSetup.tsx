"use client";

import { useEffect, useState } from "react";
import { PRESETS, cycleMinutes, type PomoConfig } from "@/lib/pomodoro";
import { Button } from "@/components/ui";

const FOCUS = [15, 20, 25, 30, 45, 50, 60];
const SHORT = [3, 5, 10];
const LONG = [10, 15, 20, 30];
const ROUNDS = [2, 3, 4, 5, 6];

const withValue = (list: number[], v: number) => (list.includes(v) ? list : [...list, v].sort((a, b) => a - b));
const sel = "w-full rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm";

function Field({
  label,
  value,
  options,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{label}</span>
      <select className={sel} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {withValue(options, value).map((o) => (
          <option key={o} value={o}>
            {o} {unit}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PomoSetup({
  initial,
  mode,
  onConfirm,
  onClose,
}: {
  initial: PomoConfig;
  mode: "start" | "edit";
  onConfirm: (cfg: PomoConfig) => void;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<PomoConfig>(initial);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thiết lập hiệp tập trung"
        className="palette-in w-full max-w-md rounded-2xl border-2 border-ink bg-white p-5 text-ink shadow-[6px_6px_0_var(--color-ink)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>Thiết lập hiệp tập trung</h2>
        <p className="mt-1 text-sm text-neutral-600">Pomodoro: học theo hiệp, nghỉ giữa các hiệp.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const on =
              p.cfg.focusMin === cfg.focusMin &&
              p.cfg.shortBreakMin === cfg.shortBreakMin &&
              p.cfg.longBreakMin === cfg.longBreakMin &&
              p.cfg.rounds === cfg.rounds;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setCfg(p.cfg)}
                className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-semibold transition-colors ${
                  on ? "bg-ink text-white" : "bg-white hover:bg-sky/40"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Tập trung" value={cfg.focusMin} options={FOCUS} unit="phút" onChange={(v) => setCfg({ ...cfg, focusMin: v })} />
          <Field label="Số hiệp mỗi vòng" value={cfg.rounds} options={ROUNDS} unit="hiệp" onChange={(v) => setCfg({ ...cfg, rounds: v })} />
          <Field label="Nghỉ ngắn" value={cfg.shortBreakMin} options={SHORT} unit="phút" onChange={(v) => setCfg({ ...cfg, shortBreakMin: v })} />
          <Field label="Nghỉ dài" value={cfg.longBreakMin} options={LONG} unit="phút" onChange={(v) => setCfg({ ...cfg, longBreakMin: v })} />
        </div>

        <p className="mt-4 rounded-lg border-2 border-dashed border-ink p-3 text-sm">
          Một vòng gồm {cfg.rounds} hiệp {cfg.focusMin} phút ({cycleMinutes(cfg)} phút tập trung). Nghỉ ngắn{" "}
          {cfg.shortBreakMin} phút sau mỗi hiệp, nghỉ dài {cfg.longBreakMin} phút sau hiệp cuối của vòng. Hết hiệp, bạn vẫn
          được xong task đang làm rồi mới nghỉ.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button autoFocus onClick={() => onConfirm(cfg)}>
            {mode === "start" ? "Bắt đầu học" : "Lưu thiết lập"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
        </div>
      </div>
    </div>
  );
}