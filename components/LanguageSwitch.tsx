"use client";

// Nút đổi ngôn ngữ: cấu trúc và chuyển động menu lấy từ "Language switch with text swap"
// (Lucian UX/UI Prompt #267, MIT, (c) 2026 Seokwoooo).
import { useEffect, useRef, useState } from "react";
import { LANGS, changeLang, useLang, useT } from "@/lib/i18n";

export default function LanguageSwitch() {
  const lang = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("lang.pick")}: ${cur.name}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-ink bg-white px-4 text-sm font-bold text-ink hover:bg-sky/40"
      >
        <svg viewBox="0 0 14 14" className="h-4 w-4" aria-hidden>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M1.5 7h11M7 1.5c1.8 1.6 1.8 9.4 0 11M7 1.5c-1.8 1.6-1.8 9.4 0 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
        <span>{cur.short}</span>
      </button>
      <div
        role="listbox"
        aria-label={t("lang.pick")}
        className={`absolute right-0 top-full z-20 mt-2 w-44 origin-top-right rounded-xl border-2 border-ink bg-white p-1 shadow-[4px_4px_0_var(--color-ink)] motion-reduce:transition-none ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-90 opacity-0"
        }`}
        style={{ transition: "transform .25s cubic-bezier(.3,1.5,.5,1), opacity .15s" }}
      >
        {LANGS.map((l) => {
          const on = l.code === lang;
          return (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={on}
              lang={l.code}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                setOpen(false);
                changeLang(l.code);
              }}
              className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-ink hover:bg-sky/40 ${
                on ? "bg-sky/30" : ""
              }`}
            >
              <span className="w-6 text-xs font-bold text-neutral-500">{l.short}</span>
              <span>{l.name}</span>
              <svg viewBox="0 0 14 14" className={`ml-auto h-3.5 w-3.5 ${on ? "opacity-100" : "opacity-0"}`} aria-hidden>
                <path
                  d="M2.5 7.5l3 3 6-6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}