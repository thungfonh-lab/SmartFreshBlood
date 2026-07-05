"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import type { AuditChannel, AuditLogResult } from "@/lib/types";
import { Card, EmptyState, ErrorBox, PageTitle, Spinner } from "@/components/ui";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function formatDateTime(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CHANNEL_BADGE: Record<AuditChannel, string> = {
  WEB: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  SYSTEM: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export default function AuditPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [user, setUser] = useState("");
  const [channel, setChannel] = useState<"" | AuditChannel>("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditLogResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    getRepository()
      .getAuditLog({ from: from || undefined, to: to || undefined, user: user || undefined, channel: channel || undefined, page, pageSize: 20 })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, user, channel, page]);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <PageTitle title="ประวัติการใช้งาน" subtitle="Audit Log — ทุกการกระทำในระบบ" />

      <Card className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">ผู้ใช้</label>
          <select value={user} onChange={(e) => resetPage(setUser)(e.target.value)} className={inputClass}>
            <option value="">ทุกคน</option>
            {result?.users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">ช่องทาง</label>
          <select value={channel} onChange={(e) => resetPage(setChannel)(e.target.value as "" | AuditChannel)} className={inputClass}>
            <option value="">ทั้งหมด</option>
            <option value="WEB">WEB</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">ตั้งแต่วันที่</label>
          <input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">ถึงวันที่</label>
          <input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={inputClass} />
        </div>
      </Card>

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      {!loading && result && result.rows.length === 0 && <EmptyState message="ไม่พบประวัติตามเงื่อนไขที่เลือก" />}

      {!loading && result && result.rows.length > 0 && (
        <>
          <div className="space-y-2">
            {result.rows.map((r, i) => (
              <Card key={i} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.action}</p>
                    <p className="text-slate-600 dark:text-slate-300">{r.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${CHANNEL_BADGE[r.channel]}`}>{r.channel}</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {formatDateTime(r.timestamp)} · {r.user || "ระบบ"}
                </p>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              หน้า {result.page} จาก {totalPages} ({result.total} รายการ)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={result.page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={result.page >= totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
