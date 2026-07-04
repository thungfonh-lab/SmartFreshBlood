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

// ---------- System Config (ตั้งค่าผ่านหน้าระบบ) ----------

var CONFIG_KEYS = [
  "hospitalName",
  "hospitalAddress",
  "shelfLifeDays",
  "criticalThreshold",
  "freshThreshold",
  "lineChannelToken",
  "lineTargetId",
  "notifyEmail",
];
var SECRET_KEYS = ["lineChannelToken"];
var MASK_PREFIX = "••••";

/** ค่าตั้งทั้งหมด — ค่าลับถูก mask ไม่ส่งตัวจริงออกไป */
function getAllConfigMasked() {
  var c = readConfig();
  var out = {};
  CONFIG_KEYS.forEach(function (key) {
    var value = String(c[key] !== undefined ? c[key] : "");
    if (SECRET_KEYS.indexOf(key) >= 0 && value) {
      out[key] = MASK_PREFIX + value.slice(-4);
    } else {
      out[key] = value;
    }
  });
  return out;
}

/** บันทึกค่าตั้ง (upsert ลงชีท Config) — ค่าที่ยังเป็น mask จะไม่ถูกเขียนทับ */
function saveConfigEntries(input) {
  if (!input.entries) throw new Error("ไม่มีข้อมูลค่าตั้ง");
  var sheet = getSheet(SHEET_CONFIG);
  var rows = readAll(SHEET_CONFIG, ["key", "value"]);
  var rowByKey = {};
  rows.forEach(function (r) {
    rowByKey[String(r.key)] = r._row;
  });

  var changed = [];
  CONFIG_KEYS.forEach(function (key) {
    if (input.entries[key] === undefined) return;
    var value = String(input.entries[key]);
    if (SECRET_KEYS.indexOf(key) >= 0 && value.indexOf(MASK_PREFIX) === 0) return; // ไม่ได้แก้ค่าลับ
    if (rowByKey[key]) {
      sheet.getRange(rowByKey[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
    changed.push(key);
  });

  audit("CONFIG_SAVE", "แก้ไขค่าตั้ง: " + (changed.join(", ") || "-"), input.by || "");
  return getAllConfigMasked();
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
