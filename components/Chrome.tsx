"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Ẩn thanh điều hướng của giao diện quản lý khi đang ở giao diện tập trung (/study).
export default function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/study")) return null;
  return <>{children}</>;
}