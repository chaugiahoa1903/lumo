"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { btnCls, inputCls } from "@/components/ui";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = hành động phá huỷ (xoá...): nút xác nhận màu đỏ, mặc định focus vào Hủy. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Nếu có: chỉ cho xác nhận khi người dùng gõ đúng chuỗi này (ví dụ "XOA"). */
  expect?: string;
  danger?: boolean;
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
}

type Active =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog phải nằm trong DialogProvider");
  return api;
}

const DANGER = "!bg-[#dc2626] !text-white";

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;

  // Nếu có dialog đang mở mà mở cái mới: coi cái cũ là Hủy.
  const cancelCurrent = () => {
    const a = activeRef.current;
    if (!a) return;
    if (a.kind === "confirm") a.resolve(false);
    else a.resolve(null);
  };

  const confirm = useCallback((opts: ConfirmOptions) => {
    cancelCurrent();
    return new Promise<boolean>((resolve) => setActive({ kind: "confirm", opts, resolve }));
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    cancelCurrent();
    return new Promise<string | null>((resolve) => setActive({ kind: "prompt", opts, resolve }));
  }, []);

  const close = () => setActive(null);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {active && <DialogView key={active.opts.title + active.kind} active={active} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogView({ active, onClose }: { active: Active; onClose: () => void }) {
  const { opts } = active;
  const isPrompt = active.kind === "prompt";
  const promptOpts = isPrompt ? (opts as PromptOptions) : null;
  const [value, setValue] = useState(promptOpts?.defaultValue ?? "");
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const trimmed = value.trim();
  const expect = promptOpts?.expect;
  const canOk = isPrompt ? (expect ? trimmed === expect : trimmed.length > 0) : true;

  const cancel = () => {
    if (active.kind === "confirm") active.resolve(false);
    else active.resolve(null);
    onClose();
  };
  const ok = () => {
    if (!canOk) return;
    if (active.kind === "confirm") active.resolve(true);
    else active.resolve(trimmed);
    onClose();
  };

  // Khoá cuộn nền, nhớ lại focus cũ, focus vào đúng chỗ.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      if (isPrompt) {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (opts.danger) cancelRef.current?.focus();
      else okRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Tab") {
      const els = cardRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input");
      if (!els || els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const confirmLabel = opts.confirmLabel ?? (opts.danger ? "Xóa" : "Đồng ý");
  const cancelLabel = opts.cancelLabel ?? "Hủy";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        role={isPrompt ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby="lumo-dialog-title"
        aria-describedby={opts.message ? "lumo-dialog-msg" : undefined}
        className="toast-in w-full max-w-md overflow-hidden rounded-xl border-2 border-ink bg-white text-ink shadow-[8px_8px_0_0_#0e0e0e]"
      >
        <header className="border-b-2 border-ink bg-sky/30 px-5 py-3">
          <h2 id="lumo-dialog-title" className="font-display text-xl uppercase tracking-wide">
            {opts.title}
          </h2>
        </header>

        <div className="space-y-3 px-5 py-4">
          {opts.message && (
            <p id="lumo-dialog-msg" className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {opts.message}
            </p>
          )}
          {isPrompt && (
            <label className="block">
              {promptOpts?.label && <span className="mb-1 block text-sm font-semibold">{promptOpts.label}</span>}
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    ok();
                  }
                }}
                placeholder={promptOpts?.placeholder}
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t-2 border-ink bg-white px-5 py-3">
          <button ref={cancelRef} type="button" onClick={cancel} className={btnCls("ghost")}>
            {cancelLabel}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={ok}
            disabled={!canOk}
            className={`${btnCls("primary")} ${opts.danger ? DANGER : ""}`}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
