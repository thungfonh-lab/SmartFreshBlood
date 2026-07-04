"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import { daysUntilExpiry, expiryAdvice, formatThaiDate } from "@/lib/freshScore";
import type { BloodUnit, ExpiringData } from "@/lib/types";
import { BloodGroupBadge, Card, EmptyState, ErrorBox, PageTitle, Spinner, SuccessBox } from "@/components/ui";

function UnitRow({ unit, onDestroy }: { unit: BloodUnit; onDestroy?: (u: BloodUnit) => void }) {
  const days = daysUntilExpiry(unit.expiryDate);
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
      <div className="flex items-center gap-2">
        <BloodGroupBadge group={unit.bloodGroup} />
        <div>
          <p className="text-sm font-semibold">{unit.unitId}</p>
          <p className="text-xs text-slate-500">
            {unit.volumeCc} cc · หมดอายุ {formatThaiDate(unit.expiryDate)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-slate-600">{expiryAdvice(days)}</p>
        {onDestroy && days <= 0 && (
          <button
            onClick={() => onDestroy(unit)}
            className="mt-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white"
          >
            ทำลาย
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, tone, units, onDestroy }: { title: string; tone: string; units: BloodUnit[]; onDestroy?: (u: BloodUnit) => void }) {
  return (
    <Card>
      <h2 className={`mb-2 text-sm font-bold ${tone}`}>
        {title} ({units.length} ถุง)
      </h2>
      {units.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">ไม่มี</p>
      ) : (
        <div className="space-y-2">
          {units.map((u) => (
            <UnitRow key={u.unitId} unit={u} onDestroy={onDestroy} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ExpiryPage() {
  const [data, setData] = useState<ExpiringData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    getRepository()
      .getExpiring()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function destroy(unit: BloodUnit) {
    if (!window.confirm(`ยืนยันทำลายถุง ${unit.unitId} (กรุ๊ป ${unit.bloodGroup}) เนื่องจากหมดอายุ?`)) return;
    setError("");
    setSuccess("");
    try {
      await getRepository().destroy([unit.unitId], "หมดอายุ", "เจ้าหน้าที่");
      setSuccess(`ทำลายถุง ${unit.unitId} เรียบร้อย บันทึกลง Audit Log แล้ว`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทำลายไม่สำเร็จ");
    }
  }

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;

  const total = data.today.length + data.in3Days.length + data.in7Days.length;

  return (
    <div className="space-y-4">
      <PageTitle title="จัดการวันหมดอายุ" subtitle={`เลือดที่ต้องเฝ้าระวังภายใน 7 วัน: ${total} ถุง`} />

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}
      {total === 0 && <EmptyState message="ไม่มีเลือดใกล้หมดอายุใน 7 วันข้างหน้า 🎉" />}

      <Section title="🔴 หมดอายุวันนี้" tone="text-red-600" units={data.today} onDestroy={destroy} />
      <Section title="🟠 หมดภายใน 3 วัน" tone="text-orange-600" units={data.in3Days} />
      <Section title="🟡 หมดภายใน 7 วัน" tone="text-amber-600" units={data.in7Days} />
    </div>
  );
}
