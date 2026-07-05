/**
 * Stock Snapshot — บันทึกภาพรวมสต็อกรายวัน (สะสมไว้สำหรับ sparkline / forecast ในอนาคต)
 */

/** เรียกจาก dailySummaryJob ทุกวัน — บันทึก 1 แถวต่อกรุ๊ปเลือด */
function snapshotStock() {
  var avail = availableUnits();
  var now = new Date();
  var timestamp = now.toISOString();

  var rows = BLOOD_GROUPS.map(function (g) {
    var list = avail.filter(function (u) {
      return u.bloodGroup === g;
    });
    var scores = list.map(function (u) {
      return computeFreshScore(toIsoDateString(u.collectDate), toIsoDateString(u.expiryDate), now);
    });
    var avgScore = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    var totalCc = list.reduce(function (s, u) { return s + Number(u.volumeCc); }, 0);
    return [timestamp, g, list.length, totalCc, avgScore];
  });

  appendRows(SHEET_SNAPSHOT, rows);
  audit("SNAPSHOT", "บันทึกภาพรวมสต็อกประจำวัน 8 กรุ๊ป", "system");
}

/** ดึงประวัติสต็อกของกรุ๊ปเลือดหนึ่ง ย้อนหลัง N วัน (เรียงเก่า→ใหม่) — ใช้กับ sparkline หน้า Inventory */
function getStockSnapshotRows(bloodGroup, days) {
  days = Number(days) > 0 ? Number(days) : 7;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  var cutoffIso = cutoff.toISOString();

  return readAll(SHEET_SNAPSHOT, SNAPSHOT_HEADERS)
    .filter(function (r) {
      return String(r.bloodGroup) === String(bloodGroup) && String(r.timestamp) >= cutoffIso;
    })
    .map(function (r) {
      return {
        date: String(r.timestamp).slice(0, 10),
        unitCount: Number(r.unitCount),
        totalVolumeCc: Number(r.totalVolumeCc),
        avgFreshScore: Number(r.avgFreshScore),
      };
    })
    .sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
}
