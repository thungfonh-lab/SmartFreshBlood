/**
 * รันครั้งเดียวหลังวางโค้ด: สร้างชีททั้งหมดพร้อม header และค่า config เริ่มต้น
 * (เลือกฟังก์ชัน setupSheets ใน editor แล้วกด Run)
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheets = [
    { name: SHEET_UNITS, headers: UNIT_HEADERS },
    { name: SHEET_ISSUE, headers: ISSUE_HEADERS },
    { name: SHEET_AUDIT, headers: AUDIT_HEADERS },
    { name: SHEET_CONFIG, headers: ["key", "value"] },
    { name: SHEET_PATIENTS, headers: PATIENT_HEADERS },
    { name: SHEET_APPTS, headers: APPT_HEADERS },
    { name: SHEET_REQUESTS, headers: REQUEST_HEADERS },
    { name: SHEET_DESTROY, headers: DESTROY_HEADERS },
    { name: SHEET_NOTIFY_LOG, headers: NOTIFY_LOG_HEADERS },
    { name: SHEET_SNAPSHOT, headers: SNAPSHOT_HEADERS },
  ];

  sheets.forEach(function (def) {
    var sheet = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  });

  // ค่า config เริ่มต้น (เติมเฉพาะ key ที่ยังไม่มี)
  var configSheet = ss.getSheetByName(SHEET_CONFIG);
  var existingKeys = {};
  readAll(SHEET_CONFIG, ["key", "value"]).forEach(function (r) {
    existingKeys[String(r.key)] = true;
  });
  var defaults = [
    ["shelfLifeDays", 35],
    ["criticalThreshold", 3],
    ["freshThreshold", 70],
    ["hospitalName", "โรงพยาบาลทุ่งฝน"],
    ["hospitalAddress", ""],
    ["lineChannelToken", ""],
    ["lineTargetId", ""],
    ["notifyEmail", ""],
    ["notifyNearExpiry", "true"],
    ["notifyLowStock", "true"],
    ["notifyCritical", "true"],
    ["notifyApptReminder", "true"],
    ["notifyDailySummary", "true"],
    ["apptReminderDays", 3],
  ];
  var missing = defaults.filter(function (d) {
    return !existingKeys[d[0]];
  });
  if (missing.length) {
    configSheet.getRange(configSheet.getLastRow() + 1, 1, missing.length, 2).setValues(missing);
  }

  // บังคับให้คอลัมน์วันที่ใน BloodUnits เป็นข้อความ ISO เพื่อกัน format เพี้ยน
  var unitSheet = ss.getSheetByName(SHEET_UNITS);
  var collectCol = UNIT_HEADERS.indexOf("collectDate") + 1;
  var expiryCol = UNIT_HEADERS.indexOf("expiryDate") + 1;
  unitSheet.getRange(2, collectCol, unitSheet.getMaxRows() - 1, 1).setNumberFormat("@");
  unitSheet.getRange(2, expiryCol, unitSheet.getMaxRows() - 1, 1).setNumberFormat("@");

  audit("SETUP", "สร้างโครงสร้างชีทเรียบร้อย", Session.getActiveUser().getEmail());
}
