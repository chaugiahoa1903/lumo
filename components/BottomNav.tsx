"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/library", label: "Thư viện" },
  { href: "/plan", label: "Lộ trình" },
  { href: "/next", label: "Next Up" },
  { href: "/review", label: "Ôn tập" },
  { href: "/progress", label: "Tiến độ" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const index = tabs.findIndex((t) => pathname.startsWith(t.href));

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto max-w-md">
        {index >= 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-0 w-1/5 px-1 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${index * 100}%)` }}
          >
            <span className="block h-full rounded-full border-2 border-ink bg-cobalt" />
          </div>
        )}
        <ul className="relative z-10 grid grid-cols-5">
          {tabs.map((t, i) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={i === index ? "page" : undefined}
                className={`block py-3 text-center font-display text-xs uppercase tracking-wide transition-colors ${
                  i === index ? "text-white" : "text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}