"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRepository } from "@/lib/repository";
import { formatThaiDate, toIsoDate } from "@/lib/freshScore";
import type { Appointment, BloodGroup, Patient, RiskLevel } from "@/lib/types";
import { BLOOD_GROUPS } from "@/lib/types";
import { BloodGroupBadge, Card, EmptyState, ErrorBox, PageTitle, Spinner, SuccessBox } from "@/components/ui";

const RISK_LABEL: Record<RiskLevel, { text: string; cls: string }> = {
  READY: { text: "พร้อม", cls: "bg-emerald-100 text-emerald-700" },
  RISK: { text: "เสี่ยง", cls: "bg-amber-100 text-amber-700" },
  CRITICAL: { text: "วิกฤต", cls: "bg-red-100 text-red-700" },
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

export default function ThalassemiaPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ThalassemiaPageInner />
    </Suspense>
  );
}

function ThalassemiaPageInner() {
  const searchParams = useSearchParams();
  const [hnFilter, setHnFilter] = useState(() => searchParams.get("hn") ?? "");
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ฟอร์มเพิ่มนัด
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptPatientId, setApptPatientId] = useState("");
  const [apptDate, setApptDate] = useState(toIsoDate(new Date()));
  const [unitsNeeded, setUnitsNeeded] = useState(2);

  // ฟอร์มเพิ่มผู้ป่วย
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [hn, setHn] = useState("");
  const [name, setName] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [unitsPerVisit, setUnitsPerVisit] = useState(2);
  const [frequencyDays, setFrequencyDays] = useState(28);

  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError("");
    Promise.all([getRepository().getAppointments(), getRepository().getPatients()])
      .then(([appts, pts]) => {
        setAppointments(appts);
        setPatients(pts);
        if (pts.length && !apptPatientId) setApptPatientId(pts[0].patientId);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(load, [load]);

  async function addAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!apptPatientId) {
      setError("กรุณาเลือกผู้ป่วย");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await getRepository().saveAppointment({ patientId: apptPatientId, apptDate, unitsNeeded });
      setSuccess("บันทึกวันนัดเรียบร้อย");
      setShowApptForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function addPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!hn.trim() || !name.trim()) {
      setError("กรุณากรอก HN และชื่อผู้ป่วย");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await getRepository().savePatient({ hn: hn.trim(), name: name.trim(), bloodGroup, unitsPerVisit, frequencyDays });
      setSuccess(`เพิ่มผู้ป่วย ${name.trim()} เรียบร้อย`);
      setShowPatientForm(false);
      setHn("");
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(apptId: string, status: "COMPLETED" | "CANCELLED") {
    const label = status === "COMPLETED" ? "รับเลือดเสร็จสิ้น" : "ยกเลิกนัด";
    if (!window.confirm(`ยืนยัน${label}?`)) return;
    try {
      await getRepository().setAppointmentStatus(apptId, status);
      setSuccess(`บันทึก "${label}" เรียบร้อย`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  if (!appointments && !error) return <Spinner />;

  const filteredAppointments = hnFilter ? (appointments ?? []).filter((a) => a.hn.includes(hnFilter)) : appointments;
  const filteredPatients = hnFilter ? patients.filter((p) => p.hn.includes(hnFilter)) : patients;

  return (
    <div className="space-y-4">
      <PageTitle title="วางแผนธาลัสซีเมีย" subtitle="วันนัดรับเลือดและความพร้อมของเลือดสด" />

      {hnFilter && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
          <span>กำลังกรองตาม HN: {hnFilter}</span>
          <button onClick={() => setHnFilter("")} className="font-semibold underline">
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setShowApptForm(!showApptForm);
            setShowPatientForm(false);
          }}
          className="rounded-2xl bg-red-600 py-3 text-sm font-bold text-white shadow-sm"
        >
          + เพิ่มวันนัด
        </button>
        <button
          onClick={() => {
            setShowPatientForm(!showPatientForm);
            setShowApptForm(false);
          }}
          className="rounded-2xl border border-red-600 bg-white py-3 text-sm font-bold text-red-600 shadow-sm"
        >
          + ลงทะเบียนผู้ป่วย
        </button>
      </div>

      {showApptForm && (
        <Card>
          <form onSubmit={addAppointment} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">ผู้ป่วย</label>
              <select value={apptPatientId} onChange={(e) => setApptPatientId(e.target.value)} className={inputClass}>
                {patients.length === 0 && <option value="">— ยังไม่มีผู้ป่วยในทะเบียน —</option>}
                {patients.map((p) => (
                  <option key={p.patientId} value={p.patientId}>
                    {p.name} (HN {p.hn} · {p.bloodGroup})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">วันนัด</label>
                <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">จำนวนถุงที่ต้องใช้</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={unitsNeeded}
                  onChange={(e) => setUnitsNeeded(Number(e.target.value))}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึกวันนัด"}
            </button>
          </form>
        </Card>
      )}

      {showPatientForm && (
        <Card>
          <form onSubmit={addPatient} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">HN</label>
                <input value={hn} onChange={(e) => setHn(e.target.value)} className={inputClass} placeholder="เช่น 12345" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">ชื่อ-สกุล</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="ชื่อผู้ป่วย" />
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
                    className={`rounded-xl border py-2 text-sm font-bold ${
                      bloodGroup === g ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">ถุง/ครั้ง</label>
                <input type="number" min={1} max={10} value={unitsPerVisit} onChange={(e) => setUnitsPerVisit(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">ความถี่ (วัน)</label>
                <input type="number" min={7} max={120} value={frequencyDays} onChange={(e) => setFrequencyDays(Number(e.target.value))} className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "ลงทะเบียนผู้ป่วย"}
            </button>
          </form>
        </Card>
      )}

      <h2 className="pt-1 text-sm font-bold text-slate-700">วันนัดที่กำลังจะถึง ({filteredAppointments?.length ?? 0})</h2>
      {filteredAppointments && filteredAppointments.length === 0 && (
        <EmptyState message={hnFilter ? `ไม่พบวันนัดของ HN ${hnFilter}` : "ยังไม่มีวันนัด กด “+ เพิ่มวันนัด” เพื่อเริ่มวางแผน"} />
      )}
      <div className="space-y-2">
        {filteredAppointments?.map((a) => {
          const risk = RISK_LABEL[a.riskLevel];
          return (
            <Card key={a.apptId}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  {a.bloodGroup && <BloodGroupBadge group={a.bloodGroup} />}
                  <div>
                    <p className="text-sm font-bold">{a.patientName}</p>
                    <p className="text-xs text-slate-500">
                      HN {a.hn} · นัด {formatThaiDate(a.apptDate)} · ต้องใช้ {a.unitsNeeded} ถุง
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${risk.cls}`}>{risk.text}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${a.riskLevel === "READY" ? "bg-emerald-500" : a.riskLevel === "RISK" ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${a.readiness}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  เลือดสด {a.freshAvailable}/{a.unitsNeeded} ถุง ({a.readiness}%)
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateStatus(a.apptId, "COMPLETED")}
                  className="rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white"
                >
                  ✓ รับเลือดแล้ว
                </button>
                <button
                  onClick={() => updateStatus(a.apptId, "CANCELLED")}
                  className="rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-600"
                >
                  ยกเลิกนัด
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="pt-1 text-sm font-bold text-slate-700">ทะเบียนผู้ป่วย ({filteredPatients.length})</h2>
      {filteredPatients.length === 0 && (
        <EmptyState message={hnFilter ? `ไม่พบผู้ป่วย HN ${hnFilter}` : "ยังไม่มีผู้ป่วยในทะเบียน"} />
      )}
      <div className="space-y-2">
        {filteredPatients.map((p) => (
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
    </div>
  );
}
