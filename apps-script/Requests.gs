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
    fulfilledUnits: Number(r.fulfilledUnits) || 0,
  };
}

var REQUEST_STATUSES = ["PENDING", "PARTIAL", "FULFILLED", "CANCELLED"];

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
    fulfilledUnits: 0,
  };
  appendRows(SHEET_REQUESTS, [
    REQUEST_HEADERS.map(function (h) {
      return created[h];
    }),
  ]);
  audit("REQUEST_CREATE", "สร้างใบขอเลือด " + requestNo + " (" + input.items.length + " รายการ)", input.requestedBy);
  return toRequestJson(created);
}

/** อัปเดตความคืบหน้าใบขอเลือด (จำนวนที่ได้รับจริง + สถานะ) */
function updateRequestFulfillment(input) {
  if (!input.requestId) throw new Error("ไม่พบเลขที่ใบขอเลือด");
  var rows = readAll(SHEET_REQUESTS, REQUEST_HEADERS);
  var target = rows.filter(function (r) {
    return String(r.requestId) === String(input.requestId);
  })[0];
  if (!target) throw new Error("ไม่พบใบขอเลือด " + input.requestId);

  var items = [];
  try {
    items = JSON.parse(String(target.itemsJson || "[]"));
  } catch (ignored) {}
  var totalRequested = items.reduce(function (s, it) {
    return s + (Number(it.units) || 0);
  }, 0);

  var fulfilledUnits = Math.max(0, Number(input.fulfilledUnits) || 0);
  var status = input.status;
  if (!status || REQUEST_STATUSES.indexOf(status) < 0) {
    status = fulfilledUnits <= 0 ? "PENDING" : fulfilledUnits >= totalRequested ? "FULFILLED" : "PARTIAL";
  }

  var updated = {
    requestId: String(target.requestId),
    requestNo: String(target.requestNo),
    requestDate: toIsoDateString(target.requestDate),
    requestedTo: String(target.requestedTo || ""),
    requestedBy: String(target.requestedBy || ""),
    note: String(target.note || ""),
    itemsJson: String(target.itemsJson || "[]"),
    status: status,
    createdAt: String(target.createdAt || ""),
    fulfilledUnits: fulfilledUnits,
  };
  updateRow(SHEET_REQUESTS, target._row, REQUEST_HEADERS, updated);
  audit(
    "REQUEST_FULFILL",
    "ใบขอเลือด " + target.requestNo + " → " + status + " (" + fulfilledUnits + "/" + totalRequested + " ยูนิต)",
    input.by || ""
  );
  return toRequestJson(updated);
}
