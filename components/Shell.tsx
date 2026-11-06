"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Chế độ học (/study) tự chiếm toàn màn hình; giao diện quản lý nằm trong một tờ giấy trắng nổi trên nền sao.
// overflow-clip (thay cho overflow-hidden) để các khung sticky bên trong vẫn dính theo cuộn của trang.
export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/study")) {
    return <main className="relative z-10 text-white">{children}</main>;
  }

  return (
    <main className="relative z-10 pb-24 md:px-8 md:pb-10 md:pt-[88px]">
      <div className="mx-auto min-h-[70vh] max-w-6xl overflow-clip bg-white text-ink md:rounded-2xl md:border-2 md:border-ink">
        <div className="checker" aria-hidden />
        <div className="px-4 pb-28 pt-6 md:px-10 md:pb-28 md:pt-8">{children}</div>
      </div>
    </main>
  );
}