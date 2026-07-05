/**
 * Fresh Score & Expiry — ตรรกะเดียวกับ frontend/src/lib/freshScore.ts
 */

var MS_PER_DAY = 24 * 60 * 60 * 1000;

function atMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseIsoDate(iso) {
  var p = String(iso).slice(0, 10).split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function addDaysIso(iso, days) {
  var d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/** วันคงเหลือก่อนหมดอายุ (0 = วันนี้, ติดลบ = เลยแล้ว) — asOfDate ใช้คำนวณย้อนหลัง เช่น ณ เวลาที่จ่ายเลือด */
function daysUntilExpiry(expiryIso, asOfDate) {
  return Math.round((atMidnight(parseIsoDate(expiryIso)).getTime() - atMidnight(asOfDate || new Date()).getTime()) / MS_PER_DAY);
}

/** Fresh Score 0–100 — asOfDate ใช้คำนวณย้อนหลัง (เช่น รายงาน Fresh Score ณ เวลาที่จ่ายเลือดจริง) */
function computeFreshScore(collectIso, expiryIso, asOfDate) {
  var total = Math.max(
    1,
    Math.round((atMidnight(parseIsoDate(expiryIso)).getTime() - atMidnight(parseIsoDate(collectIso)).getTime()) / MS_PER_DAY)
  );
  var remaining = daysUntilExpiry(expiryIso, asOfDate);
  return Math.min(100, Math.max(0, Math.round((remaining / total) * 100)));
}
