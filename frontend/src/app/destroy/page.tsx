"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import { daysUntilExpiry, formatThaiDate } from "@/lib/freshScore";
import type { BloodUnit } from "@/lib/types";
import { BloodGroupBadge, Card, EmptyState, ErrorBox, PageTitle, Spinner, SuccessBox } from "@/components/ui";

type Mode = "DESTROY" | "RETURN";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

export default function DestroyPage() {
  const [mode, setMode] = useState<Mode>("DESTROY");
  const [units, setUnits] = useState<BloodUnit[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setUnits(null);
    setSelected(new Set());
    getRepository()
      .getInventory()
      .then(setUnits)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  // ทำลาย: แสดงเฉพาะหมดอายุแล้ว | คืน: แสดงทุกถุงที่พร้อมจ่าย
  const candidates = (units ?? []).filter((u) => (mode === "DESTROY" ? daysUntilExpiry(u.expiryDate) <= 0 : true));

  function toggle(unitId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      setError("กรุณาเลือกถุงอย่างน้อย 1 ถุง");
      return;
    }
    if (!reason.trim() || !by.trim()) {
      setError("กรุณาระบุเหตุผลและชื่อผู้ดำเนินการ");
      return;
    }
    const actionThai = mode === "DESTROY" ? "ทำลาย" : "คืน";
    if (!window.confirm(`ยืนยัน${actionThai}เลือด ${selected.size} ถุง? การดำเนินการนี้จะบันทึกลงทะเบียนถาวร`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const ids = [...selected];
      if (mode === "DESTROY") await getRepository().destroy(ids, reason.trim(), by.trim());
      else await getRepository().returnUnits(ids, reason.trim(), by.trim());
      setSuccess(`${actionThai}เลือด ${ids.length} ถุงเรียบร้อย บันทึกลงทะเบียนแล้ว`);
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="ทำลาย / คืนเลือด" subtitle="บันทึกการทำลายเลือดหมดอายุ หรือคืนเลือดไปยังหน่วยงานต้นทาง" />

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["DESTROY", "🗑️ ทำลายเลือด", "เฉพาะถุงที่หมดอายุแล้ว"],
            ["RETURN", "↩️ คืนเลือด", "ถุงที่พร้อมจ่ายทั้งหมด"],
          ] as [Mode, string, string][]
        ).map(([m, label, desc]) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setSelected(new Set());
            }}
            className={`rounded-xl border px-3 py-3 text-left ${mode === m ? "border-red-600 bg-red-50" : "border-slate-300 bg-white"}`}
          >
            <p className="text-sm font-bold">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}
      {!units && !error && <Spinner />}

      {units && candidates.length === 0 && (
        <EmptyState message={mode === "DESTROY" ? "ไม่มีถุงที่หมดอายุค้างในคลัง 🎉" : "ไม่มีถุงพร้อมจ่ายในคลัง"} />
      )}

      {candidates.length > 0 && (
        <>
          <p className="text-sm text-slate-500">
            เลือกแล้ว {selected.size}/{candidates.length} ถุง
          </p>
          <div className="space-y-2">
            {candidates.map((u) => {
              const days = daysUntilExpiry(u.expiryDate);
              const checked = selected.has(u.unitId);
              return (
                <button key={u.unitId} onClick={() => toggle(u.unitId)} className="block w-full text-left">
                  <Card className={`flex items-center gap-3 ${checked ? "border-red-500 bg-red-50" : ""}`}>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md border text-sm font-bold ${
                        checked ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <BloodGroupBadge group={u.bloodGroup} />
                    <div>
                      <p className="text-sm font-semibold">{u.unitId}</p>
                      <p className="text-xs text-slate-500">
                        {u.volumeCc} cc · หมดอายุ {formatThaiDate(u.expiryDate)}
                        {days <= 0 ? " (หมดอายุแล้ว)" : ` (เหลือ ${days} วัน)`}
                      </p>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>

          <Card className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">เหตุผล</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={mode === "DESTROY" ? "เช่น หมดอายุ" : "เช่น คืนภาคบริการโลหิตฯ"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">ผู้ดำเนินการ</label>
              <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="ชื่อเจ้าหน้าที่" className={inputClass} />
            </div>
          </Card>

          <button
            onClick={submit}
            disabled={saving || selected.size === 0}
            className="w-full rounded-2xl bg-red-600 py-3.5 text-base font-bold text-white shadow-sm disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : `ยืนยัน${mode === "DESTROY" ? "ทำลาย" : "คืน"}เลือด ${selected.size} ถุง`}
          </button>
        </>
      )}
    </div>
  );
}
