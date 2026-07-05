"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/receive", label: "รับเลือด", icon: "🩸" },
  { href: "/issue", label: "จ่ายเลือด", icon: "🏥" },
  { href: "/thalassemia", label: "ธาลัสฯ", icon: "🗓️" },
  { href: "/menu", label: "เมนู", icon: "☰" },
];

// หน้าที่อยู่ใต้เมนู — ให้แท็บเมนู active ด้วย
const MENU_PAGES = ["/menu", "/inventory", "/expiry", "/requests", "/reports", "/destroy", "/audit", "/notifications"];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden print:hidden dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const active =
            tab.href === "/menu" ? MENU_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")) : pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-xs ${
                active ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
