"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n";

// Giữ thuộc tính lang của thẻ html khớp với ngôn ngữ đang chọn (cho trình đọc màn hình).
export default function LangApplier() {
  const l = useLang();
  useEffect(() => {
    document.documentElement.lang = l;
  }, [l]);
  return null;
}