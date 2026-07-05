"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import type { BloodGroup, BloodRequestDoc, HospitalConfig, RequestItem, RequestStatus } from "@/lib/types";
import { BLOOD_GROUPS } from "@/lib/types";
import { Card, EmptyState, ErrorBox, PageTitle, Spinner } from "@/components/ui";
import { DocFooter, DocHeader, DocTable, PrintButton, SignatureBlock } from "@/components/FormalDoc";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const STATUS_BADGE: Record<RequestStatus, { text: string; cls: string }> = {
  PENDING: { text: "รอดำเนินการ", cls: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  PARTIAL: { text: "ได้รับบางส่วน", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  FULFILLED: { text: "ได้รับครบ", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  CANCELLED: { text: "ยกเลิก", cls: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
};

function RequestRow({ r, onView, onUpdated }: { r: BloodRequestDoc; onView: () => void; onUpdated: () => void }) {
  const totalRequested = r.items.reduce((s, it) => s + it.units, 0);
  const [editing, setEditing] = useState(false);
  const [fulfilledUnits, setFulfilledUnits] = useState(r.fulfilledUnits);
  const [saving, setSaving] = useState(false);
  const status = STATUS_BADGE[(r.status as RequestStatus) ?? "PENDING"] ?? STATUS_BADGE.PENDING;

  async function save() {
    setSaving(true);
    try {
      await getRepository().updateRequestFulfillment({ requestId: r.requestId, fulfilledUnits, by: "หน้าใบขอเลือด" });
      setEditing(false);
      onUpdated();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onView} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold">{r.requestNo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {r.items.map((it) => `${it.bloodGroup} ${it.component}×${it.units}`).join(", ")} · ผู้ขอ {r.requestedBy}
          </p>
        </button>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${status.cls}`}>{status.text}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs dark:border-slate-700">
        <span className="text-slate-500 dark:text-slate-400">
          ได้รับแล้ว {r.fulfilledUnits}/{totalRequested} ยูนิต
        </span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={totalRequested}
              value={fulfilledUnits}
              onChange={(e) => setFulfilledUnits(Number(e.target.value))}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center dark:border-slate-600 dark:bg-slate-800"
            />
            <button onClick={save} disabled={saving} className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">
              บันทึก
            </button>
            <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-2.5 py-1 dark:border-slate-600">
              ยกเลิก
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="font-semibold text-red-600 dark:text-red-400">
            อัปเดตสถานะ
          </button>
        )}
      </div>
    </Card>
  );
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<BloodRequestDoc[] | null>(null);
  const [config, setConfig] = useState<HospitalConfig>({ hospitalName: "", hospitalAddress: "" });
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<BloodRequestDoc | null>(null);

  // ฟอร์มสร้างใบขอเลือด
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([{ bloodGroup: "O+", component: "PRC", units: 2 }]);
  const [requestedTo, setRequestedTo] = useState("ภาคบริการโลหิตแห่งชาติ");
  const [requestedBy, setRequestedBy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([getRepository().getRequests(), getRepository().getConfig()])
      .then(([reqs, cfg]) => {
        setRequests(reqs);
        setConfig(cfg);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  function setItem(i: number, patch: Partial<RequestItem>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requestedBy.trim()) {
      setError("กรุณาระบุชื่อผู้ขอ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const doc = await getRepository().createRequest({
        items,
        requestedTo: requestedTo.trim(),
        requestedBy: requestedBy.trim(),
        note: note.trim(),
      });
      setShowForm(false);
      setViewing(doc); // เปิดเอกสารทันทีเพื่อพิมพ์
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างใบขอเลือดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ---------- มุมมองเอกสารทางการ ----------
  if (viewing) {
    const totalUnits = viewing.items.reduce((s, it) => s + it.units, 0);
    return (
      <div className="space-y-4">
        <button onClick={() => setViewing(null)} className="no-print text-sm font-semibold text-red-600">
          ‹ กลับรายการใบขอเลือด
        </button>
        <div className="formal-doc rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <DocHeader
            hospitalName={config.hospitalName}
            hospitalAddress={config.hospitalAddress}
            title="ใบขอสนับสนุนโลหิต (Blood Request Form)"
            docNo={viewing.requestNo}
            docDate={viewing.requestDate}
          />
          <p className="mb-1 text-sm">เรียน {viewing.requestedTo || "-"}</p>
          <p className="mb-4 indent-8 text-sm">
            ด้วยหน่วยงานมีความประสงค์ขอรับการสนับสนุนโลหิตเพื่อใช้ในการรักษาพยาบาลผู้ป่วย โดยมีรายการดังต่อไปนี้
          </p>
          <DocTable
            headers={["ลำดับ", "หมู่โลหิต", "ชนิดส่วนประกอบ", "จำนวน (ยูนิต)"]}
            rows={viewing.items.map((it, i) => [i + 1, it.bloodGroup, it.component, it.units])}
          />
          <p className="mt-2 text-right text-sm font-semibold">รวมทั้งสิ้น {totalUnits} ยูนิต</p>
          {viewing.note && <p className="mt-3 text-sm">หมายเหตุ: {viewing.note}</p>}
          <p className="mt-4 indent-8 text-sm">จึงเรียนมาเพื่อโปรดพิจารณาให้การสนับสนุน จักขอบคุณยิ่ง</p>
          <SignatureBlock roles={["ผู้ขอสนับสนุนโลหิต", "หัวหน้าหน่วยงาน"]} />
          <DocFooter generatedAt={viewing.createdAt} />
        </div>
        <PrintButton />
      </div>
    );
  }

  // ---------- รายการ + ฟอร์ม ----------
  return (
    <div className="space-y-4">
      <PageTitle title="ใบขอเลือด" subtitle="สร้างใบขอสนับสนุนโลหิตรูปแบบทางการ พิมพ์/บันทึก PDF ได้" />

      {error && <ErrorBox message={error} />}

      <button onClick={() => setShowForm(!showForm)} className="w-full rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-sm">
        + สร้างใบขอเลือดใหม่
      </button>

      {showForm && (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">ขอไปยัง (หน่วยงาน)</label>
              <input value={requestedTo} onChange={(e) => setRequestedTo(e.target.value)} className={inputClass} />
            </div>

            <label className="block text-sm font-semibold">รายการโลหิต</label>
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={it.bloodGroup}
                  onChange={(e) => setItem(i, { bloodGroup: e.target.value as BloodGroup })}
                  className={`${inputClass} w-24`}
                >
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <select value={it.component} onChange={(e) => setItem(i, { component: e.target.value })} className={inputClass}>
                  <option value="PRC">PRC</option>
                  <option value="LPRC">LPRC</option>
                  <option value="FFP">FFP</option>
                  <option value="PC">PC</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={it.units}
                  onChange={(e) => setItem(i, { units: Number(e.target.value) })}
                  className={`${inputClass} w-20 text-center`}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="text-red-500">
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { bloodGroup: "O+", component: "PRC", units: 1 }])}
              className="text-sm font-semibold text-red-600"
            >
              + เพิ่มรายการ
            </button>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">ผู้ขอ</label>
              <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="ชื่อเจ้าหน้าที่" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">หมายเหตุ (ถ้ามี)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกและเปิดเอกสาร"}
            </button>
          </form>
        </Card>
      )}

      {!requests && !error && <Spinner />}
      {requests && requests.length === 0 && <EmptyState message="ยังไม่มีใบขอเลือด" />}
      <div className="space-y-2">
        {requests?.map((r) => (
          <RequestRow key={r.requestId} r={r} onView={() => setViewing(r)} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}
