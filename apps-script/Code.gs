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
      // ---------- GET (ผ่าน CacheService) ----------
      case "dashboard":
        return jsonResponse({ success: true, data: cachedJson("dashboard", getDashboard) });
      case "inventory": {
        var group = e.parameter.bloodGroup || null;
        return jsonResponse({
          success: true,
          data: cachedJson("inventory:" + (group || "ALL"), function () {
            return getInventory(group);
          }),
        });
      }
      case "expiring":
        return jsonResponse({ success: true, data: cachedJson("expiring", getExpiring) });
      case "patients":
        return jsonResponse({ success: true, data: cachedJson("patients", getPatients) });
      case "appointments":
        return jsonResponse({ success: true, data: cachedJson("appointments", getAppointments) });
      case "requests":
        return jsonResponse({ success: true, data: cachedJson("requests", getRequests) });
      case "report": {
        var rType = e.parameter.type || "";
        var rFrom = e.parameter.from || "";
        var rTo = e.parameter.to || "";
        return jsonResponse({
          success: true,
          data: cachedJson("report:" + rType + ":" + rFrom + ":" + rTo, function () {
            return getReport(rType, rFrom, rTo);
          }),
        });
      }
      case "config":
        return jsonResponse({ success: true, data: cachedJson("config", getPublicConfig) });

      // ---------- POST (เขียนข้อมูล + bump cache version) ----------
      case "receive":
        return writeAction(body, receiveBlood);
      case "issue":
        return writeAction(body, issueBlood);
      case "destroy":
        return writeAction(body, destroyUnits);
      case "return":
        return writeAction(body, returnUnits);
      case "patientSave":
        return writeAction(body, savePatient);
      case "appointmentSave":
        return writeAction(body, saveAppointment);
      case "appointmentStatus":
        return writeAction(body, setAppointmentStatus);
      case "requestCreate":
        return writeAction(body, createRequest);

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

/** รัน write operation ภายใต้ Lock แล้ว bump cache version */
function writeAction(body, fn) {
  requireBody(body);
  return withLock(function () {
    var data = fn(body);
    bumpDataVersion();
    return jsonResponse({ success: true, data: data });
  });
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
