"use client";

import Link from "next/link";
import BadgeGrid from "@/components/BadgeGrid";
import { PageHeader } from "@/components/ui";

export default function BadgesPage() {
  return (
    <div>
      <Link href="/progress" className="mb-4 inline-block text-sm font-semibold text-cobalt underline">
        ← Tiến độ
      </Link>
      <PageHeader title="Huy hiệu" subtitle="Toàn bộ huy hiệu và điều kiện mở khóa. Điều kiện cố định, không ngẫu nhiên." />
      <BadgeGrid />
    </div>
  );
}
