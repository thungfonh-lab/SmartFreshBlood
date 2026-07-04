/**
 * Smart Fresh Blood — REST API Router
 * Deploy เป็น Web App: Execute as = Me, Who has access = Anyone
 *
 * GET  {url}?action=dashboard | inventory | expiring
 * POST {url}?action=receive | issue | destroy  (body = JSON, Content-Type: text/plain)
 */

function doGet(e) {
  return handleRequest(e, null);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
  } catch (err) {
    return jsonResponse({ success: false, error: "รูปแบบข้อมูลไม่ถูกต้อง (JSON)" });
  }
  return handleRequest(e, body);
}

function handleRequest(e, body) {
  var action = (e.parameter && e.parameter.action) || "";
  try {
    switch (action) {
      case "dashboard":
        return jsonResponse({ success: true, data: getDashboard() });
      case "inventory":
        return jsonResponse({ success: true, data: getInventory(e.parameter.bloodGroup || null) });
      case "expiring":
        return jsonResponse({ success: true, data: getExpiring() });
      case "receive":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: receiveBlood(body) });
        });
      case "issue":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: issueBlood(body) });
        });
      case "destroy":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: destroyUnits(body) });
        });
      case "return":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: returnUnits(body) });
        });
      case "patients":
        return jsonResponse({ success: true, data: getPatients() });
      case "patientSave":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: savePatient(body) });
        });
      case "appointments":
        return jsonResponse({ success: true, data: getAppointments() });
      case "appointmentSave":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: saveAppointment(body) });
        });
      case "appointmentStatus":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: setAppointmentStatus(body) });
        });
      case "requests":
        return jsonResponse({ success: true, data: getRequests() });
      case "requestCreate":
        requireBody(body);
        return withLock(function () {
          return jsonResponse({ success: true, data: createRequest(body) });
        });
      case "report":
        return jsonResponse({
          success: true,
          data: getReport(e.parameter.type || "", e.parameter.from || "", e.parameter.to || ""),
        });
      case "config":
        return jsonResponse({ success: true, data: getPublicConfig() });
      default:
        return jsonResponse({ success: false, error: "ไม่รู้จัก action: " + action });
    }
  } catch (err) {
    logError(action, err);
    return jsonResponse({ success: false, error: String(err.message || err) });
  }
}

function requireBody(body) {
  if (!body) throw new Error("action นี้ต้องเรียกแบบ POST พร้อม body");
}

/** ป้องกันเขียนชนกัน (Concurrency Control) */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error("ระบบกำลังประมวลผลรายการอื่น กรุณาลองใหม่");
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function logError(action, err) {
  try {
    appendRows(SHEET_AUDIT, [[new Date().toISOString(), "ERROR:" + action, String(err.stack || err), ""]]);
  } catch (ignored) {}
}
