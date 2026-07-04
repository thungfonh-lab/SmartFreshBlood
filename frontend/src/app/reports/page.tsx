"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/repository";
import { toIsoDate } from "@/lib/freshScore";
import type { BloodUnit, DestroyLogRow, HospitalConfig, IssueRecord, ReportData, ReportType } from "@/lib/types";
import { Card, ErrorBox, PageTitle, Spinner } from "@/components/ui";
import { DocFooter, DocHeader, DocTable, formatThaiFullDate, PrintButton, SignatureBlock } from "@/components/FormalDoc";

const REPORT_TYPES: { type: ReportType; title: string; docTitle: string; needRange: boolean }[] = [
  { type: "stock", title: "รายงานสรุปคลังเลือดประจำวัน", docTitle: "รายงานสรุปคลังโลหิตคงเหลือประจำวัน", needRange: false },
  { type: "receive", title: "รายงานการรับเลือด", docTitle: "รายงานการรับโลหิตเข้าคลัง", needRange: true },
  { type: "issue", title: "รายงานการจ่ายเลือด", docTitle: "รายงานการจ่ายโลหิต", needRange: true },
  { type: "destroy", title: "รายงานการทำลาย/คืนเลือด", docTitle: "รายงานการทำลายและคืนโลหิต", needRange: true },
];

function firstOfMonth(): string {
  const d = new Date();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function formatTime(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

export default function ReportsPage() {
  const [config, setConfig] = useState<HospitalConfig>({ hospitalName: "", hospitalAddress: "" });
  const [selected, setSelected] = useState<ReportType>("stock");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(toIsoDate(new Date()));
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRepository().getConfig().then(setConfig).catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const def = REPORT_TYPES.find((r) => r.type === selected)!;
      const data = await getRepository().getReport(selected, def.needRange ? from : undefined, def.needRange ? to : undefined);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  const def = REPORT_TYPES.find((r) => r.type === selected)!;

  return (
    <div className="space-y-4">
      <div className="no-print space-y-4">
        <PageTitle title="รายงาน" subtitle="รายงานรูปแบบทางการ พร้อมพิมพ์หรือบันทึกเป็น PDF" />

        <Card className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">ประเภทรายงาน</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value as ReportType)} className={inputClass}>
              {REPORT_TYPES.map((r) => (
                <option key={r.type} value={r.type}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          {def.needRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">ตั้งแต่วันที่</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">ถึงวันที่</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          <button onClick={generate} disabled={loading} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {loading ? "กำลังสร้างรายงาน..." : "สร้างรายงาน"}
          </button>
        </Card>

        {error && <ErrorBox message={error} />}
        {loading && <Spinner />}
      </div>

      {report && (
        <>
          <div className="formal-doc rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <DocHeader
              hospitalName={config.hospitalName}
              hospitalAddress={config.hospitalAddress}
              title={def.docTitle}
              docDate={toIsoDate(new Date())}
            />
            {def.needRange && (
              <p className="mb-3 text-center text-sm">
                ระหว่างวันที่ {formatThaiFullDate(report.from ?? "")} ถึงวันที่ {formatThaiFullDate(report.to ?? "")}
              </p>
            )}

            {report.type === "stock" && report.dashboard && (
              <>
                <DocTable
                  headers={["ลำดับ", "หมู่โลหิต", "จำนวน (ยูนิต)", "ปริมาณ (มล.)", "Fresh Score เฉลี่ย", "ใกล้หมดอายุ (7 วัน)"]}
                  rows={report.dashboard.groups.map((g, i) => [i + 1, g.bloodGroup, g.units, g.volumeCc, g.units ? g.avgFreshScore : "-", g.nearExpiry])}
                />
                <p className="mt-2 text-right text-sm font-semibold">
                  รวมทั้งสิ้น {report.dashboard.totalUnits} ยูนิต ({report.dashboard.totalVolumeCc.toLocaleString()} มล.)
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <p>สรุปสาระสำคัญ:</p>
                  <p className="indent-8">
                    ณ วันที่จัดทำรายงาน คลังโลหิตมีโลหิตคงเหลือรวม {report.dashboard.totalUnits} ยูนิต ค่าความสดเฉลี่ย (Fresh Score){" "}
                    {report.dashboard.avgFreshScore} คะแนน มีโลหิตที่จะหมดอายุภายใน 7 วัน จำนวน {report.dashboard.expiring7Days} ยูนิต
                    {report.dashboard.criticalGroups.length > 0
                      ? ` และมีหมู่โลหิตที่อยู่ในภาวะวิกฤต (ต่ำกว่าเกณฑ์ขั้นต่ำ) ได้แก่ ${report.dashboard.criticalGroups.join(", ")}`
                      : " โดยไม่มีหมู่โลหิตที่อยู่ในภาวะวิกฤต"}
                  </p>
                </div>
              </>
            )}

            {report.type === "receive" && (
              <>
                <DocTable
                  headers={["ลำดับ", "หมายเลขถุง", "หมู่โลหิต", "ชนิด", "ปริมาณ (มล.)", "วันเจาะเก็บ", "วันหมดอายุ", "ผู้รับ"]}
                  rows={(report.rows as BloodUnit[]).map((u, i) => [i + 1, u.unitId, u.bloodGroup, u.component, u.volumeCc, u.collectDate, u.expiryDate, u.receivedBy])}
                />
                <p className="mt-2 text-right text-sm font-semibold">รวมรับเข้า {(report.rows as BloodUnit[]).length} ยูนิต</p>
              </>
            )}

            {report.type === "issue" && (
              <>
                <DocTable
                  headers={["ลำดับ", "หมายเลขถุง", "หมู่โลหิต", "ปริมาณ (มล.)", "ประเภท", "จ่ายให้", "วัน-เวลา", "ผู้จ่าย"]}
                  rows={(report.rows as IssueRecord[]).map((r, i) => [
                    i + 1,
                    r.unitId,
                    r.bloodGroup,
                    r.volumeCc,
                    r.issueType === "THALASSEMIA" ? "ธาลัสซีเมีย" : "ทั่วไป",
                    r.issuedTo,
                    formatTime(r.issuedAt),
                    r.issuedBy,
                  ])}
                />
                <p className="mt-2 text-right text-sm font-semibold">รวมจ่ายออก {(report.rows as IssueRecord[]).length} ยูนิต</p>
              </>
            )}

            {report.type === "destroy" && (
              <>
                <DocTable
                  headers={["ลำดับ", "หมายเลขถุง", "หมู่โลหิต", "ปริมาณ (มล.)", "การดำเนินการ", "เหตุผล", "วัน-เวลา", "ผู้ดำเนินการ"]}
                  rows={(report.rows as DestroyLogRow[]).map((r, i) => [
                    i + 1,
                    r.unitId,
                    r.bloodGroup,
                    r.volumeCc,
                    r.action === "DESTROY" ? "ทำลาย" : "คืน",
                    r.reason || "-",
                    formatTime(r.at),
                    r.by,
                  ])}
                />
                <p className="mt-2 text-right text-sm font-semibold">รวม {(report.rows as DestroyLogRow[]).length} รายการ</p>
              </>
            )}

            <SignatureBlock roles={["ผู้จัดทำรายงาน", "ผู้ตรวจสอบ", "ผู้อนุมัติ"]} />
            <DocFooter generatedAt={report.generatedAt} />
          </div>
          <PrintButton />
        </>
      )}
    </div>
  );
}
