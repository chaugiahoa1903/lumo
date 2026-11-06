"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncReviews } from "@/lib/review";
import { openPalette } from "@/components/CommandPalette";

const ITEMS = [
  { href: "/library", label: "Thư viện" },
  { href: "/plan", label: "Lộ trình" },
  { href: "/next", label: "Next Up" },
  { href: "/review", label: "Ôn tập" },
  { href: "/progress", label: "Tiến độ" },
];

// Thanh trên cùng có nền tối đặc: nội dung cuộn qua bị che hẳn, chữ và logo luôn đọc được.
export default function TopNav() {
  const pathname = usePathname();
  const due = useLiveQuery(() => db.reviews.where("dueAt").belowOrEqual(Date.now()).count(), []);
  const settingsActive = pathname.startsWith("/settings");

  useEffect(() => {
    void syncReviews();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-30 hidden h-[72px] items-center justify-between border-b border-white/10 bg-[#050818]/90 px-8 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl md:flex">
      <Link href="/library" className="font-wordmark text-3xl leading-none text-white" aria-label="Lumo, về Thư viện">
        LUMO
      </Link>

      <nav aria-label="Điều hướng chính" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-9">
        {ITEMS.map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                active ? "text-white" : "text-white/70 hover:text-white"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full bg-amber-retro transition-transform duration-300 ${
                  active ? "scale-100" : "scale-0"
                }`}
              />
              {it.label}
              {it.href === "/review" && due ? (
                <span className="rounded-full bg-amber-retro px-1.5 text-[11px] font-semibold text-ink">{due}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Tìm nhanh (Ctrl K)"
          title="Tìm nhanh (Ctrl K)"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
        <Link
          href="/settings"
          aria-current={settingsActive ? "page" : undefined}
          className={`flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-ink transition-colors ${
            settingsActive ? "bg-amber-retro" : "bg-white hover:bg-sky"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
          Cài đặt
        </Link>
      </div>
    </header>
  );
}