"use client";

import { useEffect, useState } from "react";
import { getRepository, isMockMode } from "@/lib/repository";
import type { SystemConfig } from "@/lib/types";
import { Card, ErrorBox, PageTitle, Spinner, SuccessBox } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "number" | "secret";
}

const SECTIONS: { title: string; icon: string; desc: string; fields: FieldDef[] }[] = [
  {
    title: "ข้อมูลหน่วยงาน",
    icon: "🏥",
    desc: "แสดงบนหัวเอกสารรายงานและใบขอเลือดทุกฉบับ",
    fields: [
      { key: "hospitalName", label: "ชื่อหน่วยงาน / โรงพยาบาล" },
      { key: "hospitalAddress", label: "ที่อยู่ (ถ้ามี)" },
    ],
  },
  {
    title: "เกณฑ์คลังเลือด",
    icon: "🩸",
    desc: "มีผลต่อการคำนวณวันหมดอายุ Fresh Score และการแจ้งเตือนสต็อกวิกฤต",
    fields: [
      { key: "shelfLifeDays", label: "อายุเก็บเลือด (วัน)", type: "number", hint: "PRC มาตรฐาน 35 วัน" },
      { key: "criticalThreshold", label: "เกณฑ์สต็อกวิกฤต (ถุง)", type: "number", hint: "ต่ำกว่านี้จะแจ้ง Critical" },
      { key: "freshThreshold", label: "เกณฑ์เลือดสด (Fresh Score)", type: "number", hint: "ใช้คำนวณความพร้อมธาลัสซีเมีย" },
    ],
  },
  {
    title: "การแจ้งเตือน (LINE / Email)",
    icon: "🔔",
    desc: "สรุปคลังเลือดอัตโนมัติทุกวัน 07:00 น. — เว้นว่างหากยังไม่ใช้",
    fields: [
      { key: "lineChannelToken", label: "LINE Channel Access Token", type: "secret", hint: "จาก LINE Developers Console (ค่าเดิมแสดงเป็น •••• เพื่อความปลอดภัย)" },
      { key: "lineTargetId", label: "LINE User ID / Group ID ปลายทาง" },
      { key: "notifyEmail", label: "อีเมลรับสรุปประจำวัน", hint: "หลายคนคั่นด้วยเครื่องหมายจุลภาค (,)" },
    ],
  },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getRepository()
      .getAllConfig()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  function setField(key: string, value: string) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await getRepository().saveConfig(config, "หน้าตั้งค่าระบบ");
      setConfig(updated);
      setSuccess("บันทึกค่าตั้งเรียบร้อย — มีผลทันทีทั้งระบบ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!config && !error) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle title="ตั้งค่าระบบ" subtitle="แก้ไขค่าตั้งทั้งหมดได้ที่นี่ ไม่ต้องเข้า Google Sheets" />

      {isMockMode() && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-xs text-amber-700">
          โหมดข้อมูลตัวอย่าง — ค่าที่บันทึกจะเก็บในเครื่องนี้เท่านั้น
        </div>
      )}

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {config && (
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
            {SECTIONS.map((section) => (
              <Card key={section.title} className={section.title.startsWith("การแจ้งเตือน") ? "lg:col-span-2" : ""}>
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <span>{section.icon}</span> {section.title}
                </h2>
                <p className="mb-3 mt-0.5 text-xs text-slate-500">{section.desc}</p>
                <div className={`space-y-3 ${section.title.startsWith("การแจ้งเตือน") ? "lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0" : ""}`}>
                  {section.fields.map((f) => (
                    <div key={f.key}>
                      <label className="mb-1.5 block text-sm font-semibold">{f.label}</label>
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        value={config[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className={inputClass}
                      />
                      {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-red-600 py-3.5 text-base font-bold text-white shadow-sm disabled:opacity-50 lg:max-w-xs"
          >
            {saving ? "กำลังบันทึก..." : "💾 บันทึกค่าตั้งทั้งหมด"}
          </button>
        </form>
      )}
    </div>
  );
}
