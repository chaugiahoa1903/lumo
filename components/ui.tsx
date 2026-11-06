import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "amber" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-cobalt text-white",
  amber: "bg-amber-retro text-ink",
  ghost: "bg-white text-ink",
};

export const inputCls =
  "w-full rounded-lg border-2 border-ink bg-white px-3 py-2 placeholder:text-neutral-500 focus:outline-none focus:ring-4 focus:ring-sky";

export function btnCls(variant: Variant = "primary") {
  return `btn-press inline-block rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${btnCls(variant)} ${className}`} {...props} />;
}

const TONE = {
  white: "bg-white text-ink",
  amber: "bg-amber-retro text-ink",
  navy: "bg-navy text-white",
} as const;

export function Card({
  tone = "white",
  className = "",
  children,
}: {
  tone?: keyof typeof TONE;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-lg border-2 border-ink p-4 ${TONE[tone]} ${className}`}>{children}</div>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Tiến độ"}
        className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white"
      >
        <div className="h-full bg-cobalt transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
      {label && <p className="mt-1 text-sm text-neutral-600">{label}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-neutral-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {step !== undefined && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sky font-display text-base">
          {step}
        </span>
      )}
      <h2>{children}</h2>
    </div>
  );
}

const PANEL_TONE = {
  white: { head: "bg-sky/30 text-ink", body: "bg-white text-ink" },
  amber: { head: "bg-sky/30 text-ink", body: "bg-amber-retro text-ink" },
  navy: { head: "bg-navy text-white", body: "bg-navy text-white" },
} as const;

// Khung dùng chung: thanh đề mục + thân khung. flush = thân không có lề (để chứa danh sách có đường kẻ).
export function Panel({
  title,
  hint,
  action,
  tone = "white",
  flush = false,
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  tone?: keyof typeof PANEL_TONE;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = PANEL_TONE[tone];
  return (
    <section className={`overflow-hidden rounded-xl border-2 border-ink ${className}`}>
      <header className={`flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-3 ${t.head}`}>
        <div className="min-w-0">
          <h2>{title}</h2>
          {hint && <p className="mt-0.5 truncate text-xs opacity-80">{hint}</p>}
        </div>
        {action}
      </header>
      <div className={`${flush ? "" : "p-4"} ${t.body}`}>{children}</div>
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full border-2 border-ink transition-colors ${
        checked ? "bg-cobalt" : "bg-white"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full border-2 border-ink bg-white transition-transform duration-200 ${
          checked ? "translate-x-6" : ""
        }`}
      />
    </button>
  );
}