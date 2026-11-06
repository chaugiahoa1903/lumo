"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export default function LibraryPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const materials = useLiveQuery(
    () => db.materials.orderBy("createdAt").reverse().toArray(),
    []
  );

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await db.materials.add({
      type: "note",
      title: title.trim(),
      content: content.trim(),
      tags: [],
      isDemo: false,
      createdAt: Date.now(),
    });
    setTitle("");
    setContent("");
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Thư viện</h1>

      <form onSubmit={addNote} className="mb-6 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề ghi chú"
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung"
          rows={4}
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
        <button className="rounded bg-indigo-600 px-4 py-2 text-white">Thêm ghi chú</button>
      </form>

      {materials === undefined ? (
        <p className="text-neutral-500">Đang tải...</p>
      ) : materials.length === 0 ? (
        <p className="text-neutral-500">Chưa có tài liệu nào.</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="rounded border border-neutral-200 bg-white p-3">
              <p className="font-medium">{m.title}</p>
              <p className="text-xs text-neutral-500">
                {m.type}
                {m.isDemo ? " · Tài liệu mẫu" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}