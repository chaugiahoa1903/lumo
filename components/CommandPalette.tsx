"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadDemos } from "@/lib/materials";
import { fold } from "@/lib/text";
import { useSettings } from "@/lib/settings";
import { useToast } from "@/components/Toast";

const OPEN_EVENT = "lumo-open-palette";

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

export default function CommandPalette() {
  const router = useRouter();
  const toast = useToast();
  const [settings, update] = useSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setIndex(0);
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => {
      setQuery("");
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      { id: "go-library", label: "Đi tới Thư viện", hint: "Điều hướng", run: () => router.push("/library") },
      { id: "go-plan", label: "Đi tới Lộ trình", hint: "Điều hướng", run: () => router.push("/plan") },
      { id: "go-next", label: "Đi tới Next Up", hint: "Điều hướng", run: () => router.push("/next") },
      { id: "go-review", label: "Đi tới Ôn tập", hint: "Điều hướng", run: () => router.push("/review") },
      { id: "go-progress", label: "Đi tới Tiến độ", hint: "Điều hướng", run: () => router.push("/progress") },
      { id: "go-settings", label: "Mở Cài đặt", hint: "Điều hướng", run: () => router.push("/settings") },
      {
        id: "demo",
        label: "Nạp tài liệu mẫu",
        hint: "Thư viện",
        run: async () => {
          try {
            const n = await loadDemos();
            toast(n > 0 ? `Đã nạp ${n} tài liệu mẫu.` : "Tài liệu mẫu đã có sẵn.");
          } catch {
            toast("Không nạp được tài liệu mẫu.");
          }
        },
      },
      {
        id: "motion",
        label: settings.reduceMotion ? "Bật lại chuyển động" : "Giảm chuyển động",
        hint: "Cài đặt",
        run: () => update({ reduceMotion: !settings.reduceMotion }),
      },
    ],
    [router, toast, settings.reduceMotion, update]
  );

  const q = fold(query.trim());
  const list = q ? commands.filter((c) => fold(`${c.label} ${c.hint ?? ""}`).includes(q)) : commands;
  const active = Math.min(index, Math.max(0, list.length - 1));

  function run(c: Command) {
    setOpen(false);
    void c.run();
  }

  if (!open) return null;

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-start justify-center bg-ink/60 px-4 pt-[15vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tìm nhanh"
        className="palette-in relative w-full max-w-lg overflow-hidden rounded-xl border-2 border-ink bg-white shadow-[6px_6px_0_var(--color-ink)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute left-4 top-[0.9rem] h-5 w-5 text-cobalt" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex(Math.min(list.length - 1, active + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex(Math.max(0, active - 1));
            } else if (e.key === "Enter" && list[active]) {
              e.preventDefault();
              run(list[active]);
            }
          }}
          placeholder="Gõ lệnh hoặc tên màn hình..."
          aria-label="Tìm lệnh"
          className="w-full border-b-2 border-ink py-3 pl-12 pr-4 text-base outline-none"
        />
        <ul role="listbox" className="max-h-72 overflow-auto p-2">
          {list.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-neutral-500">Không có lệnh phù hợp.</li>
          )}
          {list.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(c)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  i === active ? "bg-cobalt text-white" : "text-ink"
                }`}
              >
                <span>{c.label}</span>
                {c.hint && <span className={`text-xs ${i === active ? "text-white/80" : "text-neutral-500"}`}>{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t-2 border-ink px-4 py-2 text-xs text-neutral-600">↑ ↓ chọn · Enter chạy · Esc đóng</p>
      </div>
    </div>
  );
}