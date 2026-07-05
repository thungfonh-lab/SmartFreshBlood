/**
 * Audit Log — หน้าเว็บสำหรับไล่ดูประวัติการใช้งานระบบทั้งหมด
 */

var AUDIT_PAGE_SIZE_DEFAULT = 50;
var AUDIT_PAGE_SIZE_MAX = 200;

/** ระบุช่องทางจากรูปแบบ action/user ที่มีอยู่จริง — ไม่สร้าง taxonomy ปลอมที่ระบบแยกไม่ได้จริง */
function deriveAuditChannel(row) {
  var user = String(row.user || "").trim().toLowerCase();
  var action = String(row.action || "");
  if (!user || user === "system" || action.indexOf("NOTIFY_") === 0 || action === "SETUP" || action === "SNAPSHOT") {
    return "SYSTEM";
  }
  return "WEB";
}

function getAuditLog(from, to, userFilter, channelFilter, page, pageSize) {
  page = Number(page) > 0 ? Number(page) : 1;
  pageSize = Math.min(Number(pageSize) > 0 ? Number(pageSize) : AUDIT_PAGE_SIZE_DEFAULT, AUDIT_PAGE_SIZE_MAX);

  var all = readAll(SHEET_AUDIT, AUDIT_HEADERS).map(function (r) {
    return {
      timestamp: String(r.timestamp),
      action: String(r.action),
      detail: String(r.detail),
      user: String(r.user || ""),
      channel: deriveAuditChannel(r),
    };
  });

  var users = {};
  all.forEach(function (r) {
    if (r.user) users[r.user] = true;
  });

  var filtered = all.filter(function (r) {
    if (from || to) {
      if (!inDateRange(r.timestamp, from, to)) return false;
    }
    if (userFilter && r.user !== userFilter) return false;
    if (channelFilter && r.channel !== channelFilter) return false;
    return true;
  });

  filtered.sort(function (a, b) {
    return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0;
  });

  var total = filtered.length;
  var start = (page - 1) * pageSize;
  var rows = filtered.slice(start, start + pageSize);

  return {
    rows: rows,
    total: total,
    page: page,
    pageSize: pageSize,
    users: Object.keys(users).sort(),
  };
}
