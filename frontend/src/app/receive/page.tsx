"use client";

import { useMemo, useState } from "react";
import { getRepository } from "@/lib/repository";
import { computeExpiryDate, formatThaiDate, freshScore, toIsoDate } from "@/lib/freshScore";
import type { BloodGroup } from "@/lib/types";
import { BLOOD_GROUPS } from "@/lib/types";
import { Card, ErrorBox, FreshScoreBar, PageTitle, SuccessBox } from "@/components/ui";

export default function ReceivePage() {
  const today = toIsoDate(new Date());
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [volumeCc, setVolumeCc] = useState(350);
  const [collectDate, setCollectDate] = useState(today);
  const [bagCount, setBagCount] = useState(1);
  const [unitIds, setUnitIds] = useState<string[]>([""]);
  const [receivedBy, setReceivedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const expiryDate = useMemo(() => computeExpiryDate(collectDate), [collectDate]);
  const previewScore = useMemo(() => freshScore({ collectDate, expiryDate }), [collectDate, expiryDate]);

  function setBags(n: number) {
    const count = Math.max(1, Math.min(20, n));
    setBagCount(count);
    setUnitIds((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ""));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const ids = unitIds.map((s) => s.trim());
    if (ids.some((s) => !s)) {
      setError("กรุณากรอกหมายเลขถุงให้ครบทุกถุง");
      return;
    }
    if (new Set(ids).size !== ids.length) {
      setError("หมายเลขถุงซ้ำกัน กรุณาตรวจสอบ");
      return;
    }
    if (!receivedBy.trim()) {
      setError("กรุณากรอกชื่อผู้รับเลือด");
      return;
    }
    setSaving(true);
    try {
      const created = await getRepository().receive({
        bloodGroup,
        component: "PRC",
        volumeCc,
        collectDate,
        bagCount,
        unitIds: ids,
        receivedBy: receivedBy.trim(),
      });
      setSuccess(`รับเลือดสำเร็จ ${created.length} ถุง (กรุ๊ป ${bloodGroup} หมดอายุ ${formatThaiDate(expiryDate)})`);
      setBags(1);
      setUnitIds([""]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

  return (
    <div className="space-y-4">
      <PageTitle title="รับเลือดเข้าคลัง" subtitle="รองรับถุงเดียวหรือหลายถุง (กรุ๊ป/วันเจาะเดียวกัน)" />

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">กรุ๊ปเลือด</label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setBloodGroup(g)}
                  className={`rounded-xl border py-2.5 text-sm font-bold ${
                    bloodGroup === g
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">ปริมาณต่อถุง (cc)</label>
              <input
                type="number"
                min={50}
                max={500}
                value={volumeCc}
                onChange={(e) => setVolumeCc(Number(e.target.value))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">วันที่เจาะเก็บ</label>
              <input
                type="date"
                value={collectDate}
                max={today}
                onChange={(e) => setCollectDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">วันหมดอายุ (35 วัน)</span>
              <span className="font-semibold">{formatThaiDate(expiryDate)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate-500">Fresh Score เริ่มต้น</span>
              <FreshScoreBar score={previewScore} />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">จำนวนถุง</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBags(bagCount - 1)}
                className="h-9 w-9 rounded-full border border-slate-300 text-lg font-bold text-slate-600"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold">{bagCount}</span>
              <button
                type="button"
                onClick={() => setBags(bagCount + 1)}
                className="h-9 w-9 rounded-full border border-slate-300 text-lg font-bold text-slate-600"
              >
                +
              </button>
            </div>
          </div>
          {unitIds.map((id, i) => (
            <input
              key={i}
              value={id}
              onChange={(e) =>
                setUnitIds((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
              placeholder={`หมายเลขถุงที่ ${i + 1} เช่น U12345`}
              className={inputClass}
            />
          ))}
        </Card>

        <Card>
          <label className="mb-1.5 block text-sm font-semibold">ผู้รับเลือด</label>
          <input
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            placeholder="ชื่อเจ้าหน้าที่"
            className={inputClass}
          />
        </Card>

        {error && <ErrorBox message={error} />}
        {success && <SuccessBox message={success} />}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-red-600 py-3.5 text-base font-bold text-white shadow-sm disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : `บันทึกรับเลือด ${bagCount} ถุง`}
        </button>
      </form>
    </div>
  );
}
