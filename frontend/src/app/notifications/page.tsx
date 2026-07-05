"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import type { NotificationLogRow, SystemConfig } from "@/lib/types";
import { Card, ErrorBox, PageTitle, Spinner, SuccessBox } from "@/components/ui";

interface RuleDef {
  key: string;
  title: string;
  desc: string;
}

const RULES: RuleDef[] = [
  { key: "notifyDailySummary", title: "สรุปคลังเลือดประจำวัน", desc: "ยอดรวมและ Fresh Score เฉลี่ยทุกกรุ๊ป · ส่งทุกวัน 07:00 น." },
  { key: "notifyCritical", title: "สต็อกวิกฤต", desc: "แจ้งเมื่อกรุ๊ปใดต่ำกว่าเกณฑ์วิกฤต · ส่งทุกวัน 07:00 น." },
  { key: "notifyLowStock", title: "สต็อกเฝ้าระวัง", desc: "แจ้งเมื่อกรุ๊ปใดอยู่ในช่วงเฝ้าระวัง (เกณฑ์ถึงเกณฑ์×2) · ส่งทุกวัน 07:00 น." },
  { key: "notifyNearExpiry", title: "เลือดใกล้หมดอายุ", desc: "แจ้งจำนวนถุงที่หมดอายุวันนี้/ใน 3 วัน · ส่งทุกวัน 07:00 น." },
  { key: "notifyApptReminder", title: "นัดธาลัสซีเมียใกล้ถึง", desc: "แจ้งรายชื่อผู้ป่วยที่มีนัดใกล้ถึง · ส่งทุกวัน 07:00 น." },
];

const inputClass =
  "w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-center focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function formatDateTime(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CHANNEL_ICON: Record<string, string> = { LINE: "💬", EMAIL: "📧" };

export default function NotificationsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [history, setHistory] = useState<NotificationLogRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getRepository()
      .getAllConfig()
      .then(setConfig)
      .catch((e) => setError(e.message));
    getRepository()
      .getNotificationLog({ pageSize: 20 })
      .then((r) => setHistory(r.rows))
      .catch(() => setHistory([]));
  }, []);

  function toggleRule(key: string) {
    if (!config) return;
    const current = config[key] === "true";
    setConfig({ ...config, [key]: current ? "false" : "true" });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await getRepository().saveConfig(config, "หน้าการแจ้งเตือน");
      setConfig(updated);
      setSuccess("บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!config && !error) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle title="การแจ้งเตือน" subtitle="เปิด/ปิดกฎแจ้งเตือนรายข้อ และดูประวัติการส่ง" />

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {config && (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-bold">กฎการแจ้งเตือน</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {RULES.map((rule) => {
                const enabled = config[rule.key] !== "false";
                return (
                  <div key={rule.key} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{rule.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{rule.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleRule(rule.key)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-red-600" : "bg-slate-300 dark:bg-slate-600"}`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">แจ้งล่วงหน้ากี่วัน (นัดธาลัสซีเมีย)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ใช้ร่วมกับกฎ &quot;นัดธาลัสซีเมียใกล้ถึง&quot;</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={config.apptReminderDays ?? "3"}
                  onChange={(e) => setConfig({ ...config, apptReminderDays: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="mt-4 w-full rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 lg:max-w-xs"
            >
              {saving ? "กำลังบันทึก..." : "💾 บันทึกกฎการแจ้งเตือน"}
            </button>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold">ประวัติการแจ้งเตือนล่าสุด</h2>
            {!history && <Spinner />}
            {history && history.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีประวัติการส่ง</p>}
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {history?.map((h, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <span className="text-lg leading-none">{CHANNEL_ICON[h.channel] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.summary}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(h.timestamp)} · {h.channel} · {h.success ? "สำเร็จ" : "ไม่สำเร็จ"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
