import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Lumo",
  description: "Web app học tập cá nhân hóa, dữ liệu nằm hoàn toàn trên máy bạn.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-6">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}