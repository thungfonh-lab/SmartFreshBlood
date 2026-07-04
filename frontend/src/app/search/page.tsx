"use client";

import { useEffect, useRef, useState } from "react";
import { getRepository } from "@/lib/repository";
import { daysUntilExpiry, formatThaiDate, freshScore } from "@/lib/freshScore";
import type { SearchResult, UnitStatus } from "@/lib/types";
import { BloodGroupBadge, Card, EmptyState, ErrorBox, FreshScoreBar, PageTitle, Spinner } from "@/components/ui";

const STATUS_BADGE: Record<UnitStatus, { text: string; cls: string }> = {
  AVAILABLE: { text: "พร้อมจ่าย", cls: "bg-emerald-100 text-emerald-700" },
  ISSUED: { text: "จ่ายแล้ว", cls: "bg-blue-100 text-blue-700" },
  EXPIRED: { text: "หมดอายุ", cls: "bg-red-100 text-red-700" },
  DESTROYED: { text: "ทำลายแล้ว", cls: "bg-slate-200 text-slate-600" },
  RETURNED: { text: "คืนแล้ว", cls: "bg-amber-100 text-amber-700" },
};

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ค้นหาอัตโนมัติหลังหยุดพิมพ์ 400ms
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        setError("");
        const r = await getRepository().search(query);
        setResult(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="space-y-4">
      <PageTitle title="ค้นหา" subtitle="ค้นหาด้วยหมายเลขถุงเลือด ชื่อผู้ป่วย หรือ HN" />

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="เช่น U00012, สมชาย, 12345"
          className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-base shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}
      {!loading && q.trim().length >= 2 && result && result.units.length === 0 && result.patients.length === 0 && (
        <EmptyState message={`ไม่พบข้อมูลที่ตรงกับ "${q.trim()}"`} />
      )}

      {!loading && result && result.units.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-slate-700">ถุงเลือด ({result.units.length})</h2>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {result.units.map((u) => {
              const badge = STATUS_BADGE[u.status];
              const days = daysUntilExpiry(u.expiryDate);
              return (
                <Card key={u.unitId}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <BloodGroupBadge group={u.bloodGroup} />
                      <div>
                        <p className="text-sm font-bold">{u.unitId}</p>
                        <p className="text-xs text-slate-500">
                          {u.component} · {u.volumeCc} cc · หมดอายุ {formatThaiDate(u.expiryDate)}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>{badge.text}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {u.status === "AVAILABLE" && (
                      <div className="flex items-center justify-between">
                        <FreshScoreBar score={freshScore(u)} />
                        <span>{days <= 0 ? "หมดอายุแล้ว" : `เหลือ ${days} วัน`}</span>
                      </div>
                    )}
                    {u.status === "ISSUED" && u.issuedTo && (
                      <p>
                        จ่ายให้: <span className="font-semibold text-slate-700">{u.issuedTo}</span> · {formatDateTime(u.issuedAt)}
                      </p>
                    )}
                    <p className="mt-1">รับเข้าโดย {u.receivedBy || "-"} · เจาะเก็บ {formatThaiDate(u.collectDate)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!loading && result && result.patients.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-slate-700">ผู้ป่วยธาลัสซีเมีย ({result.patients.length})</h2>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {result.patients.map((p) => (
              <Card key={p.patientId} className="flex items-center gap-3">
                <BloodGroupBadge group={p.bloodGroup} />
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    HN {p.hn} · {p.unitsPerVisit} ถุง/ครั้ง · ทุก {p.frequencyDays} วัน
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
