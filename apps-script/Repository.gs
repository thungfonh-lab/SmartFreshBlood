/**
 * Repository Layer — อ่าน/เขียน Google Sheets แบบ batch
 * เปลี่ยน database ในอนาคต: แก้เฉพาะไฟล์นี้
 */

var SHEET_UNITS = "BloodUnits";
var SHEET_ISSUE = "IssueLog";
var SHEET_AUDIT = "AuditLog";
var SHEET_CONFIG = "Config";
var SHEET_PATIENTS = "Patients";
var SHEET_APPTS = "Appointments";
var SHEET_REQUESTS = "Requests";
var SHEET_DESTROY = "DestroyLog";
var SHEET_NOTIFY_LOG = "NotificationLog";
var SHEET_SNAPSHOT = "StockSnapshot";

var UNIT_HEADERS = ["unitId", "bloodGroup", "component", "volumeCc", "collectDate", "expiryDate", "status", "receivedAt", "receivedBy"];
var ISSUE_HEADERS = ["issueId", "unitId", "bloodGroup", "volumeCc", "issueType", "issuedTo", "issuedAt", "issuedBy"];
var AUDIT_HEADERS = ["timestamp", "action", "detail", "user"];
var PATIENT_HEADERS = ["patientId", "hn", "name", "bloodGroup", "unitsPerVisit", "frequencyDays", "note", "createdAt"];
var APPT_HEADERS = ["apptId", "patientId", "apptDate", "unitsNeeded", "status", "createdAt"];
var REQUEST_HEADERS = ["requestId", "requestNo", "requestDate", "requestedTo", "requestedBy", "note", "itemsJson", "status", "createdAt", "fulfilledUnits"];
var DESTROY_HEADERS = ["logId", "unitId", "bloodGroup", "volumeCc", "action", "reason", "at", "by"];
var NOTIFY_LOG_HEADERS = ["timestamp", "channel", "recipient", "summary", "success"];
var SNAPSHOT_HEADERS = ["timestamp", "bloodGroup", "unitCount", "totalVolumeCc", "avgFreshScore"];

function getSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("ไม่พบชีท " + name + " — กรุณารัน setupSheets() ก่อน");
  return sheet;
}

/** อ่านทั้งชีทเป็น array ของ object (1 call) */
function readAll(sheetName, headers) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, i) {
    var obj = { _row: i + 2 }; // แถวจริงในชีท ไว้ใช้ตอน update
    headers.forEach(function (h, j) {
      obj[h] = row[j];
    });
    return obj;
  });
}

/** เขียนหลายแถวต่อท้าย (1 call) */
function appendRows(sheetName, rows) {
  if (!rows.length) return;
  var sheet = getSheet(sheetName);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/** อัปเดต status ของหลายถุงในครั้งเดียว */
function updateUnitStatuses(rowToStatus) {
  var sheet = getSheet(SHEET_UNITS);
  var statusCol = UNIT_HEADERS.indexOf("status") + 1;
  Object.keys(rowToStatus).forEach(function (row) {
    sheet.getRange(Number(row), statusCol).setValue(rowToStatus[row]);
  });
}

/** เขียนทับข้อมูลทั้งแถวตาม headers */
function updateRow(sheetName, row, headers, obj) {
  var sheet = getSheet(sheetName);
  var values = headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : "";
  });
  sheet.getRange(Number(row), 1, 1, headers.length).setValues([values]);
}

function readConfig() {
  var config = {
    shelfLifeDays: 35,
    criticalThreshold: 3,
    freshThreshold: 70,
    hospitalName: "",
    hospitalAddress: "",
    lineChannelToken: "",
    lineTargetId: "",
    notifyEmail: "",
    notifyNearExpiry: "true",
    notifyLowStock: "true",
    notifyCritical: "true",
    notifyApptReminder: "true",
    notifyDailySummary: "true",
    apptReminderDays: 3,
  };
  try {
    readAll(SHEET_CONFIG, ["key", "value"]).forEach(function (r) {
      if (!r.key) return;
      var raw = String(r.value === undefined || r.value === null ? "" : r.value).trim();
      // Number("") === 0 ทำให้ค่าว่างถูกแปลงเป็น 0 โดยไม่ตั้งใจ ต้องกันไว้
      config[r.key] = raw !== "" && !isNaN(Number(raw)) ? Number(raw) : raw;
    });
  } catch (ignored) {}
  return config;
}

/** อ่านค่า config แบบ boolean ปลอดภัย (string "false" ต้องไม่กลาย true เพราะเป็น non-empty string) */
function configBool(config, key, defaultVal) {
  var v = config[key];
  if (v === undefined || v === null || v === "") return defaultVal;
  return String(v) === "true" || v === true;
}

function audit(action, detail, user) {
  appendRows(SHEET_AUDIT, [[new Date().toISOString(), action, detail, user || ""]]);
}

/** แปลงค่าวันที่จากชีท (Date object หรือ string) เป็น ISO date string */
function toIsoDateString(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v).slice(0, 10);
}

/** unit จากชีท → JSON ที่ frontend ใช้ (ตัด _row, แปลงวันที่) */
function toUnitJson(u) {
  return {
    unitId: String(u.unitId),
    bloodGroup: String(u.bloodGroup),
    component: String(u.component),
    volumeCc: Number(u.volumeCc),
    collectDate: toIsoDateString(u.collectDate),
    expiryDate: toIsoDateString(u.expiryDate),
    status: String(u.status),
    receivedAt: String(u.receivedAt),
    receivedBy: String(u.receivedBy),
  };
}
