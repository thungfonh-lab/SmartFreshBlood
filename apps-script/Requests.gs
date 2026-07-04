/**
 * Blood Request — ใบขอเลือด (หลายกรุ๊ป/หลายรายการ) พร้อมเลขที่เอกสารอัตโนมัติ
 */

function toRequestJson(r) {
  var items = [];
  try {
    items = JSON.parse(String(r.itemsJson || "[]"));
  } catch (ignored) {}
  return {
    requestId: String(r.requestId),
    requestNo: String(r.requestNo),
    requestDate: toIsoDateString(r.requestDate),
    requestedTo: String(r.requestedTo || ""),
    requestedBy: String(r.requestedBy || ""),
    note: String(r.note || ""),
    items: items,
    status: String(r.status),
    createdAt: String(r.createdAt || ""),
  };
}

function getRequests() {
  return readAll(SHEET_REQUESTS, REQUEST_HEADERS)
    .map(toRequestJson)
    .sort(function (a, b) {
      return a.createdAt < b.createdAt ? 1 : -1;
    });
}

function createRequest(input) {
  if (!input.items || !input.items.length) throw new Error("กรุณาระบุรายการเลือดอย่างน้อย 1 รายการ");
  if (!input.requestedBy) throw new Error("กรุณาระบุชื่อผู้ขอ");
  input.items.forEach(function (it) {
    if (BLOOD_GROUPS.indexOf(it.bloodGroup) < 0) throw new Error("กรุ๊ปเลือดไม่ถูกต้อง: " + it.bloodGroup);
    if (!(Number(it.units) > 0)) throw new Error("จำนวนถุงไม่ถูกต้อง");
  });

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var dateKey = today.replace(/-/g, "");
  var todayCount = readAll(SHEET_REQUESTS, REQUEST_HEADERS).filter(function (r) {
    return String(r.requestNo).indexOf("SFB-" + dateKey) === 0;
  }).length;
  var requestNo = "SFB-" + dateKey + "-" + ("00" + (todayCount + 1)).slice(-3);

  var created = {
    requestId: "RQ" + Date.now(),
    requestNo: requestNo,
    requestDate: today,
    requestedTo: String(input.requestedTo || ""),
    requestedBy: String(input.requestedBy),
    note: String(input.note || ""),
    itemsJson: JSON.stringify(input.items),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  appendRows(SHEET_REQUESTS, [
    REQUEST_HEADERS.map(function (h) {
      return created[h];
    }),
  ]);
  audit("REQUEST_CREATE", "สร้างใบขอเลือด " + requestNo + " (" + input.items.length + " รายการ)", input.requestedBy);
  return toRequestJson(created);
}
