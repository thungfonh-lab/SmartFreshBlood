/**
 * Search — ค้นหาถุงเลือด (ทุกสถานะ พร้อมข้อมูลการจ่าย) และผู้ป่วยธาลัสซีเมีย
 */

var SEARCH_LIMIT = 30;

function searchAll(q) {
  q = String(q || "").trim().toLowerCase();
  if (q.length < 2) return { units: [], patients: [] };

  // ประวัติการจ่ายล่าสุดของแต่ละถุง (ไว้แสดงว่าถุงที่จ่ายไปแล้วไปที่ไหน)
  var lastIssue = {};
  readAll(SHEET_ISSUE, ISSUE_HEADERS).forEach(function (r) {
    lastIssue[String(r.unitId)] = { issuedTo: String(r.issuedTo), issuedAt: String(r.issuedAt) };
  });

  var units = readAll(SHEET_UNITS, UNIT_HEADERS)
    .filter(function (u) {
      return String(u.unitId).toLowerCase().indexOf(q) >= 0;
    })
    .slice(0, SEARCH_LIMIT)
    .map(function (u) {
      var json = toUnitJson(u);
      var issue = lastIssue[json.unitId];
      if (issue) {
        json.issuedTo = issue.issuedTo;
        json.issuedAt = issue.issuedAt;
      }
      return json;
    });

  var patients = readAll(SHEET_PATIENTS, PATIENT_HEADERS)
    .filter(function (p) {
      return String(p.hn).toLowerCase().indexOf(q) >= 0 || String(p.name).toLowerCase().indexOf(q) >= 0;
    })
    .slice(0, SEARCH_LIMIT)
    .map(toPatientJson);

  return { units: units, patients: patients };
}
