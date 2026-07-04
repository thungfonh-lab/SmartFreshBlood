"use client";

import Link from "next/link";
import { isMockMode } from "@/lib/repository";
import { Card, PageTitle } from "@/components/ui";

const MENU_ITEMS = [
  { href: "/search", icon: "🔍", title: "ค้นหา", desc: "ค้นหาถุงเลือด ผู้ป่วย หรือ HN" },
  { href: "/inventory", icon: "📦", title: "คลังเลือด", desc: "รายการถุงเลือดทั้งหมด (FEFO)" },
  { href: "/expiry", icon: "⏰", title: "จัดการวันหมดอายุ", desc: "เฝ้าระวังเลือดหมดอายุ 0/3/7 วัน" },
  { href: "/requests", icon: "📄", title: "ใบขอเลือด", desc: "สร้างและพิมพ์ใบขอเลือด (ทางการ)" },
  { href: "/reports", icon: "📑", title: "รายงาน", desc: "รายงานทางการ พิมพ์/บันทึก PDF" },
  { href: "/destroy", icon: "🗑️", title: "ทำลาย / คืนเลือด", desc: "บันทึกการทำลายและคืนเลือดพร้อมเหตุผล" },
  { href: "/settings", icon: "⚙️", title: "ตั้งค่าระบบ", desc: "ชื่อหน่วยงาน เกณฑ์คลัง และการแจ้งเตือน" },
];

export default function MenuPage() {
  return (
    <div className="space-y-4">
      <PageTitle title="เมนูเพิ่มเติม" subtitle="โมดูลจัดการคลังเลือดและเอกสาร" />
      <div className="space-y-3">
        {MENU_ITEMS.map((m) => (
          <Link key={m.href} href={m.href} className="block">
            <Card className="flex items-center gap-4">
              <span className="text-3xl">{m.icon}</span>
              <div>
                <p className="font-bold">{m.title}</p>
                <p className="text-sm text-slate-500">{m.desc}</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </Card>
          </Link>
        ))}
      </div>
      <p className="pt-2 text-center text-xs text-slate-400">
        Smart Fresh Blood v2.0 · {isMockMode() ? "โหมดข้อมูลตัวอย่าง" : "เชื่อมต่อ Google Sheets"}
      </p>
    </div>
  );
}
