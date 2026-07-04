import type { BloodUnit } from "./types";

export const DEFAULT_SHELF_LIFE_DAYS = 35; // PRC

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ตัดเวลาออก เหลือเที่ยงคืนตามเวลาท้องถิ่น */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function computeExpiryDate(collectDate: string, shelfLifeDays = DEFAULT_SHELF_LIFE_DAYS): string {
  return addDays(collectDate, shelfLifeDays);
}

/** จำนวนวันคงเหลือก่อนหมดอายุ (0 = หมดอายุวันนี้, ติดลบ = หมดอายุแล้ว) */
export function daysUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  return Math.round((atMidnight(parseDate(expiryDate)).getTime() - atMidnight(now).getTime()) / MS_PER_DAY);
}

/** Fresh Score 0–100 ตามสัดส่วนวันคงเหลือต่ออายุเก็บทั้งหมด */
export function freshScore(unit: Pick<BloodUnit, "collectDate" | "expiryDate">, now: Date = new Date()): number {
  const total = Math.max(
    1,
    Math.round((atMidnight(parseDate(unit.expiryDate)).getTime() - atMidnight(parseDate(unit.collectDate)).getTime()) / MS_PER_DAY)
  );
  const remaining = daysUntilExpiry(unit.expiryDate, now);
  return Math.min(100, Math.max(0, Math.round((remaining / total) * 100)));
}

export type FreshLevel = "fresh" | "medium" | "low";

export function freshLevel(score: number): FreshLevel {
  if (score >= 70) return "fresh";
  if (score >= 40) return "medium";
  return "low";
}

export const FRESH_LEVEL_LABEL: Record<FreshLevel, string> = {
  fresh: "สดมาก",
  medium: "ปานกลาง",
  low: "ใกล้หมดอายุ",
};

/** คำแนะนำการจัดการถุงใกล้หมดอายุ */
export function expiryAdvice(days: number): string {
  if (days <= 0) return "ทำลาย (Destroy)";
  if (days <= 3) return "จ่ายก่อน (Issue First)";
  return "พิจารณาโอนย้าย (Transfer)";
}

export function formatThaiDate(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
