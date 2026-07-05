/**
 * Notification Center — แจ้งเตือน LINE Messaging API และ Gmail
 *
 * การตั้งค่า (ชีท Config หรือหน้า "การแจ้งเตือน" ในเว็บ):
 *   lineChannelToken     = Channel access token ของ LINE Official Account
 *   lineTargetId         = userId หรือ groupId ปลายทาง
 *   notifyEmail          = อีเมลรับสรุปประจำวัน (คั่นหลายคนด้วย ,)
 *   notifyDailySummary   = ส่งสรุปยอดคลังรายวันหรือไม่
 *   notifyCritical       = แจ้งกรุ๊ปสต็อกวิกฤต (< เกณฑ์) หรือไม่
 *   notifyLowStock       = แจ้งกรุ๊ปสต็อกเฝ้าระวัง (เกณฑ์ ถึง เกณฑ์×2) หรือไม่
 *   notifyNearExpiry     = แจ้งเลือดใกล้หมดอายุหรือไม่
 *   notifyApptReminder   = แจ้งนัดธาลัสซีเมียใกล้ถึงหรือไม่
 *   apptReminderDays     = แจ้งล่วงหน้ากี่วันก่อนวันนัด
 *
 * เปิดใช้แจ้งเตือนอัตโนมัติ: เลือกฟังก์ชัน setupNotificationTriggers แล้วกด Run หนึ่งครั้ง
 * (สร้าง Trigger รายวันเวลา ~07:00 น. — trigger เดียวนี้ทำทั้งส่งสรุป + snapshot สต็อก)
 */

function sendLine(text) {
  var c = readConfig();
  if (!c.lineChannelToken || !c.lineTargetId) return false;
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + c.lineChannelToken },
    payload: JSON.stringify({
      to: c.lineTargetId,
      messages: [{ type: "text", text: text }],
    }),
    muteHttpExceptions: true,
  });
  return true;
}

function sendEmail(subject, body) {
  var c = readConfig();
  if (!c.notifyEmail) return false;
  MailApp.sendEmail({ to: String(c.notifyEmail), subject: subject, body: body });
  return true;
}

/** ข้อความสรุปสถานะคลังเลือด — แต่ละ section เปิด/ปิดได้ตามค่าตั้ง */
function buildSummaryText() {
  var config = readConfig();
  var d = getDashboard();
  var lines = [];
  var hasUrgent = false;

  if (configBool(config, "notifyDailySummary", true)) {
    lines.push("🩸 Smart Fresh Blood — สรุปคลังเลือดประจำวัน");
    lines.push(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + " น.");
    lines.push("");
    lines.push("รวม " + d.totalUnits + " ถุง (" + d.totalVolumeCc.toLocaleString() + " cc) | Fresh Score เฉลี่ย " + d.avgFreshScore);
    lines.push("");
    d.groups.forEach(function (g) {
      if (g.units > 0) lines.push(g.bloodGroup + ": " + g.units + " ถุง (Fresh " + g.avgFreshScore + ")");
    });
  }

  var criticalThreshold = Number(config.criticalThreshold) || 3;
  if (configBool(config, "notifyCritical", true) && d.criticalGroups.length) {
    lines.push("");
    lines.push("⚠️ สต็อกวิกฤต (< " + criticalThreshold + " ถุง): " + d.criticalGroups.join(", "));
    hasUrgent = true;
  }
  if (configBool(config, "notifyLowStock", true)) {
    var lowStockGroups = d.groups
      .filter(function (g) {
        return g.units >= criticalThreshold && g.units < criticalThreshold * 2;
      })
      .map(function (g) {
        return g.bloodGroup;
      });
    if (lowStockGroups.length) {
      lines.push("🟡 สต็อกเฝ้าระวัง (" + criticalThreshold + "-" + (criticalThreshold * 2 - 1) + " ถุง): " + lowStockGroups.join(", "));
      hasUrgent = true;
    }
  }

  if (configBool(config, "notifyNearExpiry", true)) {
    if (d.expiringToday > 0) {
      lines.push("🔴 หมดอายุวันนี้ " + d.expiringToday + " ถุง");
      hasUrgent = true;
    }
    if (d.expiring3Days > 0) {
      lines.push("🟠 หมดใน 3 วัน " + d.expiring3Days + " ถุง");
      hasUrgent = true;
    }
  }

  if (configBool(config, "notifyApptReminder", true)) {
    var reminderDays = Number(config.apptReminderDays) || 3;
    var upcoming = getAppointments().filter(function (a) {
      var days = daysUntilExpiry(a.apptDate, new Date());
      return days >= 0 && days <= reminderDays;
    });
    if (upcoming.length) {
      lines.push("");
      lines.push("🗓️ นัดธาลัสซีเมียใกล้ถึงใน " + reminderDays + " วัน:");
      upcoming.forEach(function (a) {
        lines.push("- " + a.patientName + " (HN " + a.hn + ") " + a.bloodGroup + " วันนัด " + a.apptDate + " ต้องใช้ " + a.unitsNeeded + " ถุง");
      });
      hasUrgent = true;
    }
  }

  return { text: lines.join("\n"), hasUrgent: hasUrgent };
}

/** งานประจำวัน — ผูกกับ Trigger 07:00 น. */
function dailySummaryJob() {
  snapshotStock();

  var built = buildSummaryText();
  var config = readConfig();
  // ไม่มีเนื้อหาอะไรเลย (ปิดสรุปรายวัน + ไม่มีเรื่องด่วน) → ไม่ต้องส่ง
  if (!built.text.trim()) {
    audit("NOTIFY_DAILY", "ข้ามการส่ง (ไม่มีเนื้อหาตามค่าตั้ง)", "system");
    return;
  }

  var now = new Date().toISOString();
  var logRows = [];

  if (config.lineChannelToken && config.lineTargetId) {
    var sentLine = sendLine(built.text);
    logRows.push([now, "LINE", String(config.lineTargetId), built.text.slice(0, 200), sentLine]);
  }
  if (config.notifyEmail) {
    var sentMail = sendEmail("[Smart Fresh Blood] สรุปคลังเลือดประจำวัน", built.text);
    logRows.push([now, "EMAIL", String(config.notifyEmail), built.text.slice(0, 200), sentMail]);
  }
  if (logRows.length) appendRows(SHEET_NOTIFY_LOG, logRows);

  audit("NOTIFY_DAILY", "ส่งสรุปประจำวัน (LINE=" + !!config.lineChannelToken + " Email=" + !!config.notifyEmail + ")", "system");
}

/** รันครั้งเดียวเพื่อสร้าง Trigger แจ้งเตือนรายวัน 07:00 น. (trigger เดียวทำทั้งส่งสรุป + snapshot สต็อก) */
function setupNotificationTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "dailySummaryJob") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("dailySummaryJob").timeBased().atHour(7).everyDays(1).create();
  audit("NOTIFY_SETUP", "สร้าง Trigger สรุปประจำวัน 07:00 น.", Session.getActiveUser().getEmail());
}

/** ประวัติการแจ้งเตือนที่ส่งจริง — ใช้กับหน้า "การแจ้งเตือน" */
function getNotificationLog(from, to, page, pageSize) {
  page = Number(page) > 0 ? Number(page) : 1;
  pageSize = Math.min(Number(pageSize) > 0 ? Number(pageSize) : 50, 200);

  var all = readAll(SHEET_NOTIFY_LOG, NOTIFY_LOG_HEADERS)
    .map(function (r) {
      return {
        timestamp: String(r.timestamp),
        channel: String(r.channel),
        recipient: String(r.recipient),
        summary: String(r.summary),
        success: r.success === true || String(r.success) === "true",
      };
    })
    .filter(function (r) {
      return !(from || to) || inDateRange(r.timestamp, from, to);
    });

  all.sort(function (a, b) {
    return a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0;
  });

  var total = all.length;
  var start = (page - 1) * pageSize;
  return { rows: all.slice(start, start + pageSize), total: total, page: page, pageSize: pageSize };
}
