import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Sarabun } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// ฟอนต์ราชการสำหรับเอกสาร/รายงานทางการ
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Smart Fresh Blood",
  description: "ระบบบริหารคลังเลือดสดและวางแผนผู้ป่วยธาลัสซีเมีย",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Smart Fresh Blood",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} ${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900 print:bg-white">
        <Sidebar />
        <div className="lg:pl-64 print:pl-0">
          <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pt-4 pb-24 lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-10 print:max-w-none print:p-0">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
