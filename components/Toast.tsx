"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  ms?: number;
}

type Push = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<Push | null>(null);

export function useToast(): Push {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast phải nằm trong ToastProvider");
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((s) => s.filter((t) => t.id !== id)), []);

  const push = useCallback<Push>(
    (message, options = {}) => {
      const id = nextId.current++;
      setItems((s) => [...s.slice(-2), { id, message, actionLabel: options.actionLabel, onAction: options.onAction }]);
      window.setTimeout(() => dismiss(id), options.ms ?? 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 md:inset-x-auto md:bottom-24 md:right-9"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="toast-in pointer-events-auto flex max-w-md items-center gap-4 rounded-lg border-2 border-white bg-ink px-4 py-3 text-sm text-white"
          >
            <span>{t.message}</span>
            {t.onAction && (
              <button
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 font-display uppercase tracking-wide text-sky underline"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}