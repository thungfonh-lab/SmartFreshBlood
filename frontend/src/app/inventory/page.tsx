"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/repository";
import { daysUntilExpiry, formatThaiDate, freshLevel, freshScore } from "@/lib/freshScore";
import type { BloodGroup, BloodUnit, StockSnapshotPoint } from "@/lib/types";
import { BLOOD_GROUPS } from "@/lib/types";
import { BloodGroupBadge, Card, EmptyState, ErrorBox, FreshScoreBar, PageTitle, Spinner } from "@/components/ui";

type SortKey = "unitId" | "bloodGroup" | "expiryDate" | "freshScore" | "daysLeft";
type StatusTier = "ALL" | "normal" | "warning" | "critical";
type FreshTier = "ALL" | "fresh" | "medium" | "low";

const STATUS_LABEL: Record<Exclude<StatusTier, "ALL">, string> = { normal: "ปกติ", warning: "เฝ้าระวัง", critical: "วิกฤติ" };
const FRESH_LABEL: Record<Exclude<FreshTier, "ALL">, string> = { fresh: "สดมาก", medium: "ปานกลาง", low: "ใกล้หมดอายุ" };

function Sparkline({ points }: { points: StockSnapshotPoint[] }) {
  if (points.length < 2) {
    return <span className="text-[11px] text-slate-400 dark:text-slate-500">ยังไม่มีข้อมูลย้อนหลังเพียงพอ</span>;
  }
  const max = Math.max(...points.map((p) => p.unitCount), 1);
  return (
    <div className="flex h-8 items-end gap-0.5" title={`${points.length} วันย้อนหลัง`}>
      {points.map((p, i) => (
        <div
          key={i}
          className="w-1.5 rounded-t bg-red-400 dark:bg-red-600"
          style={{ height: `${Math.max(8, (p.unitCount / max) * 100)}%` }}
          title={`${p.date}: ${p.unitCount} ถุง`}
        />
      ))}
    </div>
  );
}

export default function InventoryPage() {
  const [filter, setFilter] = useState<BloodGroup | "ALL">("ALL");
  const [units, setUnits] = useState<BloodUnit[] | null>(null);
  const [error, setError] = useState("");
  const [criticalThreshold, setCriticalThreshold] = useState(3);
  const [statusTier, setStatusTier] = useState<StatusTier>("ALL");
  const [freshTier, setFreshTier] = useState<FreshTier>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("expiryDate");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [snapshots, setSnapshots] = useState<Partial<Record<BloodGroup, StockSnapshotPoint[]>>>({});

  const load = useCallback(() => {
    setUnits(null);
    getRepository()
      .getInventory(filter === "ALL" ? undefined : filter)
      .then(setUnits)
      .catch((e) => setError(e.message));
  }, [filter]);

  useEffect(load, [load]);

  useEffect(() => {
    getRepository()
      .getAllConfig()
      .then((c) => setCriticalThreshold(Number(c.criticalThreshold) || 3))
      .catch(() => {});
  }, []);

  // นับจำนวนถุงต่อกรุ๊ป (จากรายการที่โหลดมา) ไว้จัดระดับสถานะ 3 ชั้น
  const countByGroup = useMemo(() => {
    const map = new Map<BloodGroup, number>();
    (units ?? []).forEach((u) => map.set(u.bloodGroup, (map.get(u.bloodGroup) ?? 0) + 1));
    return map;
  }, [units]);

  function tierOf(group: BloodGroup): Exclude<StatusTier, "ALL"> {
    const count = countByGroup.get(group) ?? 0;
    if (count < criticalThreshold) return "critical";
    if (count < criticalThreshold * 2) return "warning";
    return "normal";
  }

  // โหลด sparkline เฉพาะกรุ๊ปที่ปรากฏในรายการ (ไม่โหลดซ้ำ)
  useEffect(() => {
    const groups = Array.from(new Set((units ?? []).map((u) => u.bloodGroup)));
    groups.forEach((g) => {
      if (snapshots[g]) return;
      getRepository()
        .getStockSnapshot(g, 7)
        .then((pts) => setSnapshots((prev) => ({ ...prev, [g]: pts })))
        .catch(() => setSnapshots((prev) => ({ ...prev, [g]: [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  const filtered = (units ?? []).filter((u) => {
    if (statusTier !== "ALL" && tierOf(u.bloodGroup) !== statusTier) return false;
    if (freshTier !== "ALL" && freshLevel(freshScore(u)) !== freshTier) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "unitId") cmp = a.unitId.localeCompare(b.unitId);
    else if (sortKey === "bloodGroup") cmp = a.bloodGroup.localeCompare(b.bloodGroup);
    else if (sortKey === "expiryDate") cmp = a.expiryDate.localeCompare(b.expiryDate);
    else if (sortKey === "freshScore") cmp = freshScore(a) - freshScore(b);
    else if (sortKey === "daysLeft") cmp = daysUntilExpiry(a.expiryDate) - daysUntilExpiry(b.expiryDate);
    return cmp * sortDir;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function SortHeader({ sk, label }: { sk: SortKey; label: string }) {
    return (
      <th onClick={() => toggleSort(sk)} className="cursor-pointer select-none px-3 py-2 text-left hover:text-red-600">
        {label} {sortKey === sk ? (sortDir === 1 ? "↑" : "↓") : ""}
      </th>
    );
  }

  const selectClass =
    "rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-4">
      <PageTitle title="คลังเลือด" subtitle="เรียงตามวันหมดอายุ (FEFO) · กดหัวคอลัมน์เพื่อจัดเรียง" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", ...BLOOD_GROUPS] as const).map((g) => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
              filter === g
                ? "border-red-600 bg-red-600 text-white"
                : "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {g === "ALL" ? "ทั้งหมด" : g}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={statusTier} onChange={(e) => setStatusTier(e.target.value as StatusTier)} className={selectClass}>
          <option value="ALL">สถานะ: ทั้งหมด</option>
          <option value="normal">ปกติ</option>
          <option value="warning">เฝ้าระวัง</option>
          <option value="critical">วิกฤติ</option>
        </select>
        <select value={freshTier} onChange={(e) => setFreshTier(e.target.value as FreshTier)} className={selectClass}>
          <option value="ALL">Fresh Score: ทั้งหมด</option>
          <option value="fresh">สดมาก (≥70)</option>
          <option value="medium">ปานกลาง (40-69)</option>
          <option value="low">ใกล้หมดอายุ (&lt;40)</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && !units && <Spinner />}
      {units && sorted.length === 0 && <EmptyState message="ไม่มีเลือดในคลังตามเงื่อนไขที่เลือก" />}

      {units && sorted.length > 0 && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {sorted.length} ถุง · รวม {sorted.reduce((s, u) => s + u.volumeCc, 0).toLocaleString()} cc
          </p>

          {/* ตาราง sort ได้ — จอกว้าง */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <SortHeader sk="unitId" label="หมายเลขถุง" />
                  <SortHeader sk="bloodGroup" label="กรุ๊ป" />
                  <th className="px-3 py-2 text-left">สถานะกรุ๊ป</th>
                  <SortHeader sk="expiryDate" label="วันหมดอายุ" />
                  <SortHeader sk="daysLeft" label="เหลือ (วัน)" />
                  <SortHeader sk="freshScore" label="Fresh Score" />
                  <th className="px-3 py-2 text-left">ประวัติ 7 วัน (กรุ๊ป)</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => {
                  const days = daysUntilExpiry(u.expiryDate);
                  const tier = tierOf(u.bloodGroup);
                  return (
                    <tr key={u.unitId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-2 font-semibold">{u.unitId}</td>
                      <td className="px-3 py-2">
                        <BloodGroupBadge group={u.bloodGroup} />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            tier === "critical"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                              : tier === "warning"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          }`}
                        >
                          {STATUS_LABEL[tier]}
                        </span>
                      </td>
                      <td className="px-3 py-2">{formatThaiDate(u.expiryDate)}</td>
                      <td className={`px-3 py-2 ${days <= 3 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                        {days <= 0 ? "หมดอายุแล้ว" : days}
                      </td>
                      <td className="px-3 py-2">
                        <FreshScoreBar score={freshScore(u)} />
                      </td>
                      <td className="px-3 py-2">
                        <Sparkline points={snapshots[u.bloodGroup] ?? []} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* การ์ด — มือถือ */}
          <div className="space-y-2 lg:hidden">
            {sorted.map((u) => {
              const days = daysUntilExpiry(u.expiryDate);
              return (
                <Card key={u.unitId} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BloodGroupBadge group={u.bloodGroup} />
                    <div>
                      <p className="text-sm font-semibold">{u.unitId}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {u.component} · {u.volumeCc} cc · หมดอายุ {formatThaiDate(u.expiryDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <FreshScoreBar score={freshScore(u)} />
                    <p className={`mt-1 text-xs ${days <= 3 ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}`}>
                      {days <= 0 ? "หมดอายุวันนี้" : `เหลือ ${days} วัน`}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 lg:hidden">{FRESH_LABEL.fresh} ≥70 · {FRESH_LABEL.medium} 40-69 · {FRESH_LABEL.low} &lt;40</p>
        </>
      )}
    </div>
  );
}
