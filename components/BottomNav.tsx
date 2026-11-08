"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/navItems";
import { useT } from "@/lib/i18n";

export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const index = NAV.findIndex((x) => pathname.startsWith(x.href));

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto max-w-md">
        {index >= 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-0 w-1/6 px-0.5 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${index * 100}%)` }}
          >
            <span className="block h-full rounded-full border-2 border-ink bg-cobalt" />
          </div>
        )}
        <ul className="relative z-10 grid grid-cols-6">
          {NAV.map((x, i) => (
            <li key={x.href}>
              <Link
                href={x.href}
                aria-current={i === index ? "page" : undefined}
                className={`block truncate px-0.5 py-3 text-center font-display text-[10px] uppercase tracking-wide transition-colors ${
                  i === index ? "text-white" : "text-ink"
                }`}
              >
                {t(x.key)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}