"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export interface Settings {
  reduceMotion: boolean;
  sessionMinutes: number; // giới hạn mềm mỗi phiên (phút)
  sessionTasks: number; // giới hạn mềm mỗi phiên (số task)
  dailyGoalXp: number; // mục tiêu XP mỗi ngày
}

export const DEFAULT_SETTINGS: Settings = { reduceMotion: false, sessionMinutes: 20, sessionTasks: 8, dailyGoalXp: 30 };
export const SETTINGS_KEY = "lumo.settings.v1";
const EVENT = "lumo-settings";

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function parse(raw: string): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      reduceMotion: p.reduceMotion === true,
      sessionMinutes: clampInt(p.sessionMinutes, 5, 60, DEFAULT_SETTINGS.sessionMinutes),
      sessionTasks: clampInt(p.sessionTasks, 3, 20, DEFAULT_SETTINGS.sessionTasks),
      dailyGoalXp: clampInt(p.dailyGoalXp, 10, 100, DEFAULT_SETTINGS.dailyGoalXp),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getRaw(): string {
  try {
    return localStorage.getItem(SETTINGS_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* bỏ qua nếu trình duyệt chặn lưu */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSettings() {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "");
  const settings = useMemo(() => parse(raw), [raw]);
  const update = useCallback((patch: Partial<Settings>) => saveSettings({ ...parse(getRaw()), ...patch }), []);
  return [settings, update] as const;
}