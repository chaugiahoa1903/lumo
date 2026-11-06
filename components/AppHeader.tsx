import Link from "next/link";

export default function AppHeader() {
  return (
    <header className="bg-cobalt">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Link href="/library" className="font-wordmark text-4xl leading-none text-white" aria-label="Lumo, về Thư viện">
          LUMO
        </Link>
        <Link href="/settings" aria-label="Cài đặt" className="rounded-full border-2 border-white p-2 text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </Link>
      </div>
    </header>
  );
}