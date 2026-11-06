"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/settings";

export default function SettingsApplier() {
  const [s] = useSettings();
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(s.reduceMotion);
  }, [s.reduceMotion]);
  return null;
}