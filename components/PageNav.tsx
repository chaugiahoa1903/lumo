"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ORDER = [
  { href: "/library", label: "Thư viện" },
  { href: "/plan", label: "Lộ trình" },
  { href: "/next", label: "Next Up" },
  { href: "/progress", label: "Tiến độ" },
];

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
        dir === "left" ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

function ToStart() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:-translate-x-1"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 17l-5-5 5-5M11 17l-5-5 5-5" />
    </svg>
  );
}

export default function PageNav() {
  const pathname = usePathname();
  const i = ORDER.findIndex((s) => pathname.startsWith(s.href));
  if (i < 0) return null;
  const first = ORDER[0];
  const prev = ORDER[i - 1];
  const next = ORDER[i + 1];

  return (
    <nav aria-label="Chuyển giữa các phần" className="fixed bottom-7 right-9 z-30 hidden items-center gap-3 md:flex">
      {i >= 2 && (
        <Link
          href={first.href}
          aria-label={`Về trang đầu: ${first.label}`}
          title={`Về trang đầu: ${first.label}`}
          className="btn-press group flex items-center gap-2 rounded-full bg-amber-retro px-4 py-2 font-display text-sm uppercase tracking-wide text-ink"
        >
          <ToStart />
          Về đầu
        </Link>
      )}
      {prev && (
        <Link
          href={prev.href}
          className="btn-press group flex items-center gap-2 rounded-full bg-white px-4 py-2 font-display text-sm uppercase tracking-wide text-ink"
        >
          <Arrow dir="left" />
          {prev.label}
        </Link>
      )}
      <span className="rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-semibold">
        {i + 1}/{ORDER.length}
      </span>
      {next && (
        <Link
          href={next.href}
          className="btn-press group flex items-center gap-2 rounded-full bg-cobalt px-4 py-2 font-display text-sm uppercase tracking-wide text-white"
        >
          {next.label}
          <Arrow dir="right" />
        </Link>
      )}
    </nav>
  );
}