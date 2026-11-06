"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/library", label: "Thư viện" },
  { href: "/plan", label: "Lộ trình" },
  { href: "/next", label: "Next Up" },
  { href: "/progress", label: "Tiến độ" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`block py-3 text-center text-sm ${
                  active ? "font-semibold text-indigo-600" : "text-neutral-500"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}