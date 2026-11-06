import type { Metadata } from "next";
import { Anton, Bowlby_One, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import SettingsApplier from "@/components/SettingsApplier";

const anton = Anton({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: "400",
  variable: "--font-anton",
});
const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bowlby",
});
const body = Be_Vietnam_Pro({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Lumo",
  description: "Web app học tập cá nhân hóa, dữ liệu nằm hoàn toàn trên máy bạn.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${anton.variable} ${bowlby.variable} ${body.variable}`}>
      <body className="bg-cobalt text-ink antialiased">
        <SettingsApplier />
        <Sidebar />
        <div className="md:pl-[240px]">
          <div className="md:hidden">
            <AppHeader />
          </div>
          <div className="md:py-4 md:pr-4">
            <div className="min-h-screen overflow-hidden bg-white md:min-h-[calc(100vh-2rem)] md:rounded-2xl md:border-2 md:border-ink">
              <div className="checker" aria-hidden />
              <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-10 md:pb-16 md:pt-8">{children}</main>
            </div>
          </div>
        </div>
        <div className="md:hidden">
          <BottomNav />
        </div>
      </body>
    </html>
  );
}