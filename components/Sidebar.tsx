"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { openPalette } from "@/components/CommandPalette";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

type Item = { href: string; label: string; icon: ReactNode };

const NAV: Item[] = [
  {
    href: "/library",
    label: "Thư viện",
    icon: (
      <Svg>
        <rect x="4" y="4" width="4" height="16" />
        <rect x="10" y="4" width="4" height="16" />
        <path d="M16.5 5.5l3.8 1-3.4 13-3.8-1z" />
      </Svg>
    ),
  },
  {
    href: "/plan",
    label: "Lộ trình",
    icon: (
      <Svg>
        <path d="M5 6h14M5 12h14M5 18h9" />
      </Svg>
    ),
  },
  {
    href: "/next",
    label: "Next Up",
    icon: (
      <Svg>
        <polygon points="13 2 4 14 11 14 9 22 20 9 13 9" />
      </Svg>
    ),
  },
  {
    href: "/progress",
    label: "Tiến độ",
    icon: (
      <Svg>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </Svg>
    ),
  },
];

const SETTINGS_ICON = (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);

const ROW = 56; // h-12 (48px) + gap-2 (8px)

export default function Sidebar() {
  const pathname = usePathname();
  const index = NAV.findIndex((i) => pathname.startsWith(i.href));
  const settingsActive = pathname.startsWith("/settings");

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] md:block">
      <nav aria-label="Điều hướng chính" className="flex h-full flex-col p-5">
        <Link href="/library" className="font-wordmark text-5xl leading-none text-white" aria-label="Lumo, về Thư viện">
          LUMO
        </Link>

        <div className="relative mt-10">
          <span
            aria-hidden
            className={`absolute inset-x-0 top-0 h-12 rounded-full border-2 border-ink bg-white shadow-[3px_3px_0_var(--color-ink)] transition-[transform,opacity] duration-300 ease-out ${
              index < 0 ? "opacity-0" : "opacity-100"
            }`}
            style={{ transform: `translateY(${Math.max(index, 0) * ROW}px)` }}
          />
          <ul className="relative flex flex-col gap-2">
            {NAV.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={i === index ? "page" : undefined}
                  className={`flex h-12 items-center gap-3 rounded-full px-4 font-display text-base uppercase tracking-wide transition-colors ${
                    i === index ? "text-cobalt" : "text-white hover:bg-white/15"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={openPalette}
          className="mt-6 flex w-full items-center justify-between rounded-full border-2 border-white/40 px-4 py-2 text-sm text-white/90 transition-colors hover:bg-white/15"
        >
          <span>Tìm nhanh</span>
          <kbd className="rounded border border-white/50 px-1.5 text-xs">Ctrl K</kbd>
        </button>

        <div className="mt-auto">
          <Link
            href="/settings"
            aria-current={settingsActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl border-2 border-ink px-4 py-3 text-cobalt transition-all duration-150 ${
              settingsActive
                ? "translate-x-[2px] translate-y-[2px] bg-sky shadow-[1px_1px_0_var(--color-ink)]"
                : "bg-white shadow-[3px_3px_0_var(--color-ink)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)]"
            }`}
          >
            {SETTINGS_ICON}
            <span className="min-w-0">
              <span className="block font-display text-base uppercase leading-tight tracking-wide">Cài đặt</span>
              <span className="block truncate text-xs opacity-80">Tùy chỉnh Lumo</span>
            </span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}