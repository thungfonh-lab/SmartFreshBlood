"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import { daysUntilExpiry, formatThaiDate, freshScore } from "@/lib/freshScore";
import type { BloodGroup, BloodUnit, IssueType } from "@/lib/types";
import { BLOOD_GROUPS } from "@/lib/types";
import { BloodGroupBadge, Card, ErrorBox, FreshScoreBar, PageTitle, SuccessBox } from "@/components/ui";

export default function IssuePage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [issueType, setIssueType] = useState<IssueType>("GENERAL");
  const [unitCount, setUnitCount] = useState(1);
  const [issuedTo, setIssuedTo] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [candidates, setCandidates] = useState<BloodUnit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // โหลดถุงที่จ่ายได้ของกรุ๊ปที่เลือก เพื่อพรีวิวว่าระบบจะหยิบถุงไหน
  useEffect(() => {
    let cancelled = false;
    getRepository()
      .getInventory(bloodGroup)
      .then((list) => {
        if (!cancelled) setCandidates(list.filter((u) => daysUntilExpiry(u.expiryDate) >= 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bloodGroup, success]);

  // FEFO สำหรับทั่วไป / เลือดสดที่สุดสำหรับธาลัสซีเมีย
  const sorted = [...candidates].sort((a, b) =>
    issueType === "THALASSEMIA" ? b.expiryDate.localeCompare(a.expiryDate) : a.expiryDate.localeCompare(b.expiryDate)
  );
  const willPick = sorted.slice(0, unitCount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!issuedTo.trim() || !issuedBy.trim()) {
      setError("กรุณากรอกผู้รับเลือด/หอผู้ป่วย และชื่อผู้จ่าย");
      return;
    }
    setSaving(true);
    try {
      const records = await getRepository().issue({
        bloodGroup,
        unitCount,
        issueType,
        issuedTo: issuedTo.trim(),
        issuedBy: issuedBy.trim(),
      });
      setSuccess(`จ่ายเลือดสำเร็จ ${records.length} ถุง: ${records.map((r) => r.unitId).join(", ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "จ่ายเลือดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

  return (
    <div className="space-y-4">
      <PageTitle title="จ่ายเลือด" subtitle="ระบบเลือกถุงอัตโนมัติตามหลัก FEFO / Fresh Score" />

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">ประเภทการจ่าย</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIssueType("GENERAL")}
                className={`rounded-xl border px-3 py-3 text-left ${
                  issueType === "GENERAL" ? "border-red-600 bg-red-50" : "border-slate-300 bg-white"
                }`}
              >
                <p className="text-sm font-bold">ทั่วไป</p>
                <p className="text-xs text-slate-500">จ่ายถุงใกล้หมดอายุก่อน (FEFO)</p>
              </button>
              <button
                type="button"
                onClick={() => setIssueType("THALASSEMIA")}
                className={`rounded-xl border px-3 py-3 text-left ${
                  issueType === "THALASSEMIA" ? "border-red-600 bg-red-50" : "border-slate-300 bg-white"
                }`}
              >
                <p className="text-sm font-bold">ธาลัสซีเมีย</p>
                <p className="text-xs text-slate-500">จ่ายเลือดสดที่สุดก่อน (Fresh Score สูง)</p>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">กรุ๊ปเลือด</label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setBloodGroup(g)}
                  className={`rounded-xl border py-2.5 text-sm font-bold ${
                    bloodGroup === g ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">จำนวนถุง</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUnitCount(Math.max(1, unitCount - 1))}
                className="h-9 w-9 rounded-full border border-slate-300 text-lg font-bold text-slate-600"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold">{unitCount}</span>
              <button
                type="button"
                onClick={() => setUnitCount(Math.min(10, unitCount + 1))}
                className="h-9 w-9 rounded-full border border-slate-300 text-lg font-bold text-slate-600"
              >
                +
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-bold">
            ถุงที่ระบบจะจ่าย ({willPick.length}/{unitCount}) · คงเหลือ {candidates.length} ถุง
          </h2>
          {willPick.length === 0 ? (
            <p className="py-4 text-center text-sm text-red-600">ไม่มีเลือดกรุ๊ป {bloodGroup} พร้อมจ่าย</p>
          ) : (
            <div className="space-y-2">
              {willPick.map((u) => (
                <div key={u.unitId} className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
                  <div className="flex items-center gap-2">
                    <BloodGroupBadge group={u.bloodGroup} />
                    <div>
                      <p className="text-sm font-semibold">{u.unitId}</p>
                      <p className="text-xs text-slate-500">หมดอายุ {formatThaiDate(u.expiryDate)}</p>
                    </div>
                  </div>
                  <FreshScoreBar score={freshScore(u)} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">จ่ายให้ (ผู้ป่วย/หอผู้ป่วย)</label>
            <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="เช่น ตึกอายุรกรรมชาย / HN 12345" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">ผู้จ่ายเลือด</label>
            <input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="ชื่อเจ้าหน้าที่" className={inputClass} />
          </div>
        </Card>

        {error && <ErrorBox message={error} />}
        {success && <SuccessBox message={success} />}

        <button
          type="submit"
          disabled={saving || willPick.length < unitCount}
          className="w-full rounded-2xl bg-red-600 py-3.5 text-base font-bold text-white shadow-sm disabled:opacity-50"
        >
          {saving ? "กำลังจ่าย..." : `ยืนยันจ่ายเลือด ${unitCount} ถุง`}
        </button>
      </form>
    </div>
  );
}
