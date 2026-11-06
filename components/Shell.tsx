"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Phòng tập trung (Next Up) nằm thẳng trên nền sao; các trang khác nằm trong một tờ giấy trắng nổi.
export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/next")) {
    return (
      <main className="relative z-10 mx-auto min-h-screen max-w-[1280px] px-4 pb-24 pt-6 text-white md:px-8 md:pb-10 md:pt-[88px]">
        {children}
      </main>
    );
  }

  return (
    <main className="relative z-10 pb-24 md:px-8 md:pb-10 md:pt-[88px]">
      <div className="mx-auto min-h-[70vh] max-w-6xl overflow-hidden bg-white text-ink md:rounded-2xl md:border-2 md:border-ink">
        <div className="checker" aria-hidden />
        <div className="px-4 pb-28 pt-6 md:px-10 md:pb-28 md:pt-8">{children}</div>
      </div>
    </main>
  );
}