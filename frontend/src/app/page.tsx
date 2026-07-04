"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { getRepository, isMockMode } from "@/lib/repository";
import type { DashboardData } from "@/lib/types";
import { BloodGroupBadge, Card, ErrorBox, PageTitle, Spinner, StatCard } from "@/components/ui";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getRepository()
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;

  const groupLabels = data.groups.map((g) => g.bloodGroup);

  return (
    <div className="space-y-4">
      <PageTitle title="Smart Fresh Blood" subtitle="ภาพรวมคลังเลือดวันนี้" />

      {isMockMode() && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-xs text-amber-700">
          โหมดข้อมูลตัวอย่าง — ยังไม่ได้เชื่อมต่อ Google Sheets
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="เลือดในคลัง" value={data.totalUnits} unit="ถุง" />
        <StatCard label="ปริมาณรวม" value={data.totalVolumeCc.toLocaleString()} unit="cc" />
        <StatCard
          label="Fresh Score เฉลี่ย"
          value={data.avgFreshScore}
          tone={data.avgFreshScore >= 70 ? "success" : data.avgFreshScore >= 40 ? "warning" : "danger"}
        />
        <StatCard label="หมดอายุใน 7 วัน" value={data.expiring7Days} unit="ถุง" tone={data.expiring7Days > 0 ? "warning" : "default"} />
      </div>

      {(data.expiringToday > 0 || data.criticalGroups.length > 0) && (
        <Card className="border-red-200 bg-red-50">
          <h2 className="mb-2 text-sm font-bold text-red-700">⚠️ ต้องดำเนินการ</h2>
          <ul className="space-y-1 text-sm text-red-700">
            {data.expiringToday > 0 && <li>• เลือดหมดอายุวันนี้ {data.expiringToday} ถุง — ไปที่หน้า “หมดอายุ”</li>}
            {data.criticalGroups.length > 0 && (
              <li className="flex flex-wrap items-center gap-1">
                • สต็อกวิกฤต (Critical):
                {data.criticalGroups.map((g) => (
                  <BloodGroupBadge key={g} group={g} />
                ))}
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-bold">จำนวนถุงต่อกรุ๊ปเลือด</h2>
        <Bar
          data={{
            labels: groupLabels,
            datasets: [
              {
                label: "ถุง",
                data: data.groups.map((g) => g.units),
                backgroundColor: "#dc2626",
                borderRadius: 6,
              },
            ],
          }}
          options={{
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          }}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold">Fresh Score เฉลี่ยต่อกรุ๊ป</h2>
        <div className="mx-auto max-w-60">
          <Doughnut
            data={{
              labels: groupLabels,
              datasets: [
                {
                  data: data.groups.map((g) => g.avgFreshScore),
                  backgroundColor: ["#dc2626", "#b91c1c", "#3b82f6", "#1d4ed8", "#10b981", "#047857", "#a855f7", "#7e22ce"],
                },
              ],
            }}
            options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold">สรุปรายกรุ๊ป</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">กรุ๊ป</th>
              <th className="py-2 text-right">ถุง</th>
              <th className="py-2 text-right">cc</th>
              <th className="py-2 text-right">Fresh Score</th>
              <th className="py-2 text-right">ใกล้หมดอายุ</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map((g) => (
              <tr key={g.bloodGroup} className="border-b border-slate-100 last:border-0">
                <td className="py-2">
                  <BloodGroupBadge group={g.bloodGroup} />
                </td>
                <td className={`py-2 text-right font-semibold ${g.units < 3 ? "text-red-600" : ""}`}>{g.units}</td>
                <td className="py-2 text-right text-slate-500">{g.volumeCc.toLocaleString()}</td>
                <td className="py-2 text-right">{g.units ? g.avgFreshScore : "-"}</td>
                <td className={`py-2 text-right ${g.nearExpiry > 0 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                  {g.nearExpiry || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
