"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "./focus";
import { breakMinutes, type PomoConfig } from "./pomodoro";
import { useSettings } from "./settings";
import { ambient } from "./ambient";
import { useToast } from "@/components/Toast";

// Đồng hồ Pomodoro dùng chung cho chế độ học và chế độ ôn tập.
// Giờ chỉ chạy khi ticking = true; nghỉ có đồng hồ riêng.
export function usePomo(opts: { onBlockOver?: () => void } = {}) {
  const [settings, updateSettings] = useSettings();
  const toast = useToast();
  const [activeMs, setActiveMs] = useState(0);
  const [blockOffset, setBlockOffset] = useState(0);
  const [ticking, setTicking] = useState(false);
  const [roundsDone, setRoundsDone] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const [breakMs, setBreakMs] = useState(0);
  const [breakTotalMs, setBreakTotalMs] = useState(0);
  const activeRef = useRef(0);
  const bellRef = useRef(false);
  const overRef = useRef(opts.onBlockOver);

  const cfg: PomoConfig = {
    focusMin: settings.focusMinutes,
    shortBreakMin: settings.breakMinutes,
    longBreakMin: settings.longBreakMinutes,
    rounds: settings.pomoRounds,
  };
  const blockTotalMs = cfg.focusMin * 60_000;
  const blockElapsed = Math.max(0, activeMs - blockOffset);
  const over = blockElapsed >= blockTotalMs;
  const remainingSec = Math.max(0, Math.ceil((blockTotalMs - blockElapsed) / 1000));
  const breakSec = Math.max(0, Math.ceil(breakMs / 1000));

  useEffect(() => {
    activeRef.current = activeMs;
    overRef.current = opts.onBlockOver;
  });

  // Đồng hồ hiệp
  useEffect(() => {
    if (!ticking) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      setActiveMs((v) => v + d);
    }, 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  // Đồng hồ nghỉ
  useEffect(() => {
    if (!onBreak) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      setBreakMs((v) => Math.max(0, v - d));
    }, 250);
    return () => window.clearInterval(id);
  }, [onBreak]);

  useEffect(() => {
    if (onBreak && breakMs <= 0) {
      ambient.chime();
      toast("Hết giờ nghỉ. Sẵn sàng cho hiệp tiếp theo?", { ms: 8000 });
      setOnBreak(false);
    }
  }, [onBreak, breakMs, toast]);

  // Chuông hết hiệp, một lần mỗi hiệp
  useEffect(() => {
    if (ticking && over && !bellRef.current) {
      bellRef.current = true;
      ambient.chime();
      overRef.current?.();
    }
    if (!over) bellRef.current = false;
  }, [ticking, over]);

  // Giờ còn lại hiện trên tiêu đề tab
  useEffect(() => {
    if (ticking) document.title = `${formatClock(remainingSec)} · Lumo`;
    else if (onBreak) document.title = `Nghỉ ${formatClock(breakSec)} · Lumo`;
    else document.title = "Lumo";
    return () => {
      document.title = "Lumo";
    };
  }, [ticking, onBreak, remainingSec, breakSec]);

  function startBreak() {
    const doneRounds = roundsDone + 1;
    const ms = breakMinutes(cfg, doneRounds) * 60_000;
    setRoundsDone(doneRounds);
    setBreakTotalMs(ms);
    setBreakMs(ms);
    setBlockOffset(activeRef.current);
    setTicking(false);
    setOnBreak(true);
  }
  function skipBreak() {
    setOnBreak(false);
  }
  function extendBreak() {
    setBreakMs((v) => v + 60_000);
    setBreakTotalMs((v) => v + 60_000);
  }
  function moreBlock() {
    setRoundsDone((r) => r + 1);
    setBlockOffset(activeRef.current);
    setTicking(false);
  }
  function newBlock() {
    setBlockOffset(activeRef.current);
  }
  function endRun() {
    setTicking(false);
    setRoundsDone(0);
    setBlockOffset(activeRef.current);
  }

  return {
    cfg,
    settings,
    updateSettings,
    activeRef,
    ticking,
    setTicking,
    over,
    remainingSec,
    blockTotalMs,
    roundsDone,
    onBreak,
    breakSec,
    breakTotalMs,
    startBreak,
    skipBreak,
    extendBreak,
    moreBlock,
    newBlock,
    endRun,
  };
}