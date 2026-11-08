import type { Key } from "./i18n";

// Danh sách tab điều hướng chính, dùng chung cho TopNav, BottomNav và PageNav.
export const NAV: { href: string; key: Key }[] = [
  { href: "/overview", key: "nav.overview" },
  { href: "/library", key: "nav.library" },
  { href: "/plan", key: "nav.plan" },
  { href: "/next", key: "nav.next" },
  { href: "/review", key: "nav.review" },
  { href: "/progress", key: "nav.progress" },
];