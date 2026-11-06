"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { resetProgress } from "@/lib/learning";
import { resetSettings, useSettings } from "@/lib/settings";
import { Button, PageHeader, Panel, Toggle } from "@/components/ui";

const MINUTES = [10, 15, 20, 25, 30, 45];
const TASKS = [4, 6, 8, 10, 12];
const select = "rounded-lg border-2 border-ink bg-white px-2 py-1.5 text-sm";

export default function SettingsPage() {
  const [s, update] = useSettings();
  const [msg, setMsg] = useState("");

  async function onResetProgress() {
    if (!confirm("Đặt lại tiến độ học? Tài liệu và khóa học vẫn còn, chỉ xóa kết quả làm task, phiên và nhịp học.")) return;
    await resetProgress();
    setMsg("Đã đặt lại tiến độ học.");
  }

  async function wipe() {
    if (window.prompt("Gõ XOA để xác nhận xóa toàn bộ dữ liệu trên máy này. Không thể hoàn tác.") !== "XOA") return;
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
    resetSettings();
    setMsg("Đã xóa toàn bộ dữ liệu trên máy này.");
  }

  return (
    <div>
      <PageHeader title="Cài đặt" subtitle="Mọi quy tắc của Lumo đều xem và chỉnh được ở đây." />

      <div className="stagger grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Chuyển động">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Giảm chuyển động</p>
              <p className="text-sm text-neutral-600">
                Tắt hiệu ứng trượt, trồi, chạy đầy và pháo giấy. Lumo cũng tự theo cài đặt giảm chuyển động của Windows.
              </p>
            </div>
            <Toggle checked={s.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Giảm chuyển động" />
          </div>
        </Panel>

        <Panel title="Phiên học">
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm">
              Thời gian tối đa mỗi phiên
              <select
                className={select}
                value={s.sessionMinutes}
                onChange={(e) => update({ sessionMinutes: Number(e.target.value) })}
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} phút
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              Số task tối đa mỗi phiên
              <select
                className={select}
                value={s.sessionTasks}
                onChange={(e) => update({ sessionTasks: Number(e.target.value) })}
              >
                {TASKS.map((n) => (
                  <option key={n} value={n}>
                    {n} task
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Chạm một trong hai giới hạn, Next Up sẽ hiện màn &quot;Điểm dừng thắng lợi&quot;. Đây là giới hạn mềm: bạn vẫn
            chọn học thêm được.
          </p>
        </Panel>

        <Panel title="Dữ liệu và quyền riêng tư">
          <p className="text-sm text-neutral-700">
            Tài liệu, khóa học và tiến độ chỉ nằm trong trình duyệt này. Lumo không có máy chủ, không đăng nhập, không gửi
            dữ liệu đi đâu. Xóa dữ liệu trình duyệt cũng sẽ làm mất dữ liệu Lumo.
          </p>
          <p className="mt-2 text-xs text-neutral-500">Xuất/nhập JSON để sao lưu: chưa có, dự kiến ở bước M6.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="ghost" onClick={onResetProgress}>
              Đặt lại tiến độ học
            </Button>
            <Button variant="ghost" className="text-red-700" onClick={wipe}>
              Xóa toàn bộ dữ liệu
            </Button>
          </div>
          {msg && <p className="mt-2 text-sm text-neutral-600">{msg}</p>}
        </Panel>

        <Panel title="Về Lumo" tone="amber">
          <p className="text-sm">
            Luna, bộ máy chia việc, dùng NLP cổ điển (TF-IDF, TextRank) chạy ngay trong trình duyệt. Luna không phải mô
            hình ngôn ngữ lớn, không gọi API bên ngoài và không học từ bạn.
          </p>
        </Panel>
      </div>
    </div>
  );
}