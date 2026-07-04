"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/receive", label: "รับเลือด", icon: "🩸" },
  { href: "/inventory", label: "คลังเลือด", icon: "📦" },
  { href: "/issue", label: "จ่ายเลือด", icon: "🏥" },
  { href: "/expiry", label: "หมดอายุ", icon: "⏰" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-xs ${
                active ? "font-semibold text-red-600" : "text-slate-500"
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
