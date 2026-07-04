"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import { daysUntilExpiry, formatThaiDate, freshScore } from "@/lib/freshScore";
import type { BloodGroup, BloodUnit } from "@/lib/types";
import { BLOOD_GROUPS } from "@/lib/types";
import { BloodGroupBadge, Card, EmptyState, ErrorBox, FreshScoreBar, PageTitle, Spinner } from "@/components/ui";

export default function InventoryPage() {
  const [filter, setFilter] = useState<BloodGroup | "ALL">("ALL");
  const [units, setUnits] = useState<BloodUnit[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setUnits(null);
    getRepository()
      .getInventory(filter === "ALL" ? undefined : filter)
      .then(setUnits)
      .catch((e) => setError(e.message));
  }, [filter]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <PageTitle title="คลังเลือด" subtitle="เรียงตามวันหมดอายุ (FEFO)" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", ...BLOOD_GROUPS] as const).map((g) => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
              filter === g ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {g === "ALL" ? "ทั้งหมด" : g}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {!error && !units && <Spinner />}
      {units && units.length === 0 && <EmptyState message="ไม่มีเลือดในคลังตามเงื่อนไขที่เลือก" />}

      {units && units.length > 0 && (
        <>
          <p className="text-sm text-slate-500">
            {units.length} ถุง · รวม {units.reduce((s, u) => s + u.volumeCc, 0).toLocaleString()} cc
          </p>
          <div className="space-y-2">
            {units.map((u) => {
              const days = daysUntilExpiry(u.expiryDate);
              return (
                <Card key={u.unitId} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BloodGroupBadge group={u.bloodGroup} />
                    <div>
                      <p className="text-sm font-semibold">{u.unitId}</p>
                      <p className="text-xs text-slate-500">
                        {u.component} · {u.volumeCc} cc · หมดอายุ {formatThaiDate(u.expiryDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <FreshScoreBar score={freshScore(u)} />
                    <p className={`mt-1 text-xs ${days <= 3 ? "font-semibold text-red-600" : "text-slate-400"}`}>
                      {days <= 0 ? "หมดอายุวันนี้" : `เหลือ ${days} วัน`}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
