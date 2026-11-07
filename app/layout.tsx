import type { Metadata } from "next";
import { Anton, Bowlby_One, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import Shell from "@/components/Shell";
import Chrome from "@/components/Chrome";
import GlassBackdrop from "@/components/GlassBackdrop";
import PageNav from "@/components/PageNav";
import SettingsApplier from "@/components/SettingsApplier";
import CommandPalette from "@/components/CommandPalette";
import BadgeWatcher from "@/components/BadgeWatcher";
import MiniPlayer from "@/components/MiniPlayer";
import { ToastProvider } from "@/components/Toast";
import { DialogProvider } from "@/components/Dialog";
import PageDots from "@/components/PageDots";

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
      <body className="text-ink antialiased">
        <ToastProvider>
        <DialogProvider>
          <SettingsApplier />
          <Chrome>
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
              <GlassBackdrop />
            </div>
          </Chrome>
          <Chrome>
            <TopNav />
          </Chrome>
          <Chrome>
            <div className="relative z-20 md:hidden">
              <AppHeader />
            </div>
          </Chrome>
          <Shell>{children}</Shell>
          <Chrome>
            <PageNav />
          </Chrome>
          <Chrome>
            <div className="md:hidden">
              <BottomNav />
            </div>
          </Chrome>
          <CommandPalette />
          <BadgeWatcher />
          <MiniPlayer />
          <PageDots />
        </DialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}