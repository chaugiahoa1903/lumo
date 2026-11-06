"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

const SETTINGS_ITEM: Item = {
  href: "/settings",
  label: "Cài đặt",
  icon: (
    <Svg>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Svg>
  ),
};

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-full border-2 px-4 py-2.5 font-display text-base uppercase tracking-wide transition-all duration-150 ${
        active
          ? "border-ink bg-white text-cobalt shadow-[3px_3px_0_var(--color-ink)]"
          : "border-transparent text-white hover:bg-white/15"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] md:block">
      <nav aria-label="Điều hướng chính" className="flex h-full flex-col p-5">
        <Link href="/library" className="font-wordmark text-5xl leading-none text-white" aria-label="Lumo, về Thư viện">
          LUMO
        </Link>

        <div className="mt-10 flex flex-col gap-2">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </div>

        <div className="mt-auto">
          <NavLink item={SETTINGS_ITEM} active={pathname.startsWith("/settings")} />
        </div>
      </nav>
    </aside>
  );
}