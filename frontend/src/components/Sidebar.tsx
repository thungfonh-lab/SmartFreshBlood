"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isMockMode } from "@/lib/repository";

const SECTIONS: { label: string; items: { href: string; icon: string; label: string }[] }[] = [
  {
    label: "งานประจำวัน",
    items: [
      { href: "/", icon: "📊", label: "ภาพรวม" },
      { href: "/receive", icon: "🩸", label: "รับเลือด" },
      { href: "/issue", icon: "🏥", label: "จ่ายเลือด" },
      { href: "/inventory", icon: "📦", label: "คลังเลือด" },
      { href: "/expiry", icon: "⏰", label: "จัดการวันหมดอายุ" },
    ],
  },
  {
    label: "วางแผนและเอกสาร",
    items: [
      { href: "/thalassemia", icon: "🗓️", label: "วางแผนธาลัสซีเมีย" },
      { href: "/requests", icon: "📄", label: "ใบขอเลือด" },
      { href: "/reports", icon: "📑", label: "รายงาน" },
      { href: "/destroy", icon: "🗑️", label: "ทำลาย / คืนเลือด" },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { href: "/search", icon: "🔍", label: "ค้นหา" },
      { href: "/audit", icon: "📜", label: "ประวัติการใช้งาน" },
      { href: "/notifications", icon: "🔔", label: "การแจ้งเตือน" },
      { href: "/settings", icon: "⚙️", label: "ตั้งค่าระบบ" },
    ],
  },
];

const COLLAPSE_KEY = "sfb-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY) === "1";
    setCollapsed(stored);
    document.documentElement.style.setProperty("--sidebar-w", stored ? "4.5rem" : "16rem");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    document.documentElement.style.setProperty("--sidebar-w", next ? "4.5rem" : "16rem");
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden ${collapsed ? "w-[4.5rem]" : "w-64"} flex-col bg-gradient-to-b from-rose-950 to-[#2b0a12] text-rose-100 transition-[width] duration-150 lg:flex print:hidden`}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-xl">🩸</span>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-bold leading-tight text-white">Smart Fresh Blood</p>
            <p className="truncate text-[11px] text-rose-300">ระบบบริหารคลังเลือดสด</p>
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-rose-300 hover:bg-white/10 hover:text-white ${collapsed ? "mx-auto" : "ml-auto"}`}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-400/80">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${active ? "bg-red-600 font-semibold text-white shadow-sm" : "text-rose-200/85 hover:bg-white/10 hover:text-white"}`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/10 px-5 py-3 text-[11px] text-rose-300">
          <p>Smart Fresh Blood v2.0</p>
          <p>{isMockMode() ? "โหมดข้อมูลตัวอย่าง" : "เชื่อมต่อ Google Sheets"}</p>
        </div>
      )}
    </aside>
  );
}
