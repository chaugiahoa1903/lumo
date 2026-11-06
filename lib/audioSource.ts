"use client";

import { useEffect, useRef } from "react";
import { ambient } from "./ambient";

export function soundPlay() {
  ambient.play();
}

export function soundStop() {
  ambient.pause();
}

export function setVol(v: number) {
  ambient.setVolume(v);
}

// Nhạc chạy khi đồng hồ chạy, dừng khi đồng hồ dừng; rời trang thì dừng.
export function useAutoSound(active: boolean, enabled: boolean) {
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  });
  useEffect(() => {
    if (!enabled) return;
    if (active) soundPlay();
    else soundStop();
  }, [active, enabled]);
  useEffect(
    () => () => {
      if (enabledRef.current) soundStop();
    },
    []
  );
}