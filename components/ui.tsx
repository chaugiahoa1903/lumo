import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "amber" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-cobalt text-white",
  amber: "bg-amber-retro text-ink",
  ghost: "bg-white text-ink",
};

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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-neutral-600">{subtitle}</p>}
      </div>
      {action}
    </div>
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