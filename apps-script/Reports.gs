/**
 * Reports — ข้อมูลสำหรับรายงานทางการ (สรุปคลัง/รับ/จ่าย/ทำลาย-คืน)
 */

/** ค่าตั้งสาธารณะสำหรับหัวเอกสาร */
function getPublicConfig() {
  var c = readConfig();
  return {
    hospitalName: String(c.hospitalName || ""),
    hospitalAddress: String(c.hospitalAddress || ""),
  };
}

function inDateRange(isoDateTime, from, to) {
  var d = String(isoDateTime).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/**
 * type: stock | receive | issue | destroy
 * from/to: ISO date (yyyy-MM-dd) — ใช้กับ receive/issue/destroy
 */
function getReport(type, from, to) {
  switch (type) {
    case "stock":
      return { type: "stock", generatedAt: new Date().toISOString(), dashboard: getDashboard() };

    case "receive": {
      var rows = readAll(SHEET_UNITS, UNIT_HEADERS)
        .filter(function (u) {
          return inDateRange(u.receivedAt, from, to);
        })
        .map(toUnitJson)
        .sort(function (a, b) {
          return a.receivedAt < b.receivedAt ? -1 : 1;
        });
      return { type: "receive", from: from, to: to, generatedAt: new Date().toISOString(), rows: rows };
    }

    case "issue": {
      var issues = readAll(SHEET_ISSUE, ISSUE_HEADERS)
        .filter(function (r) {
          return inDateRange(r.issuedAt, from, to);
        })
        .map(function (r) {
          return {
            issueId: String(r.issueId),
            unitId: String(r.unitId),
            bloodGroup: String(r.bloodGroup),
            volumeCc: Number(r.volumeCc),
            issueType: String(r.issueType),
            issuedTo: String(r.issuedTo),
            issuedAt: String(r.issuedAt),
            issuedBy: String(r.issuedBy),
          };
        })
        .sort(function (a, b) {
          return a.issuedAt < b.issuedAt ? -1 : 1;
        });
      return { type: "issue", from: from, to: to, generatedAt: new Date().toISOString(), rows: issues };
    }

    case "destroy": {
      var logs = readAll(SHEET_DESTROY, DESTROY_HEADERS)
        .filter(function (r) {
          return inDateRange(r.at, from, to);
        })
        .map(function (r) {
          return {
            logId: String(r.logId),
            unitId: String(r.unitId),
            bloodGroup: String(r.bloodGroup),
            volumeCc: Number(r.volumeCc),
            action: String(r.action),
            reason: String(r.reason),
            at: String(r.at),
            by: String(r.by),
          };
        })
        .sort(function (a, b) {
          return a.at < b.at ? -1 : 1;
        });
      return { type: "destroy", from: from, to: to, generatedAt: new Date().toISOString(), rows: logs };
    }

    default:
      throw new Error("ไม่รู้จักประเภทรายงาน: " + type);
  }
}
