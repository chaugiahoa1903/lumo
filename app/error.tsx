"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-xl px-4">
      <div className="relative z-50 rounded-xl border-2 border-ink bg-white p-5 text-ink">
        <p className="font-display text-2xl uppercase">Trang này gặp lỗi</p>
        <p className="mt-2 break-words rounded-lg border-2 border-dashed border-ink p-3 font-mono text-sm">
          {error.message || "Lỗi không rõ"}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-press rounded-full bg-cobalt px-5 py-2.5 text-sm font-semibold text-white"
          >
            Thử lại
          </button>
          <a href="/next" className="btn-press rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink">
            Về trang chuẩn bị
          </a>
        </div>
        <p className="mt-3 text-xs text-neutral-600">Chụp màn hình khung này gửi cho Claude để sửa đúng chỗ.</p>
      </div>
    </div>
  );
}