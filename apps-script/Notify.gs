/**
 * Notification Center — แจ้งเตือน LINE Messaging API และ Gmail
 *
 * การตั้งค่า (ชีท Config):
 *   lineChannelToken  = Channel access token ของ LINE Official Account
 *   lineTargetId      = userId หรือ groupId ปลายทาง
 *   notifyEmail       = อีเมลรับสรุปประจำวัน (คั่นหลายคนด้วย ,)
 *
 * เปิดใช้แจ้งเตือนอัตโนมัติ: เลือกฟังก์ชัน setupNotificationTriggers แล้วกด Run หนึ่งครั้ง
 * (สร้าง Trigger รายวันเวลา ~07:00 น.)
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

/** ข้อความสรุปสถานะคลังเลือด */
function buildSummaryText() {
  var d = getDashboard();
  var lines = [];
  lines.push("🩸 Smart Fresh Blood — สรุปคลังเลือดประจำวัน");
  lines.push(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + " น.");
  lines.push("");
  lines.push("รวม " + d.totalUnits + " ถุง (" + d.totalVolumeCc.toLocaleString() + " cc) | Fresh Score เฉลี่ย " + d.avgFreshScore);
  lines.push("");
  d.groups.forEach(function (g) {
    if (g.units > 0) lines.push(g.bloodGroup + ": " + g.units + " ถุง (Fresh " + g.avgFreshScore + ")");
  });
  if (d.criticalGroups.length) {
    lines.push("");
    lines.push("⚠️ สต็อกวิกฤต: " + d.criticalGroups.join(", "));
  }
  if (d.expiringToday > 0) lines.push("🔴 หมดอายุวันนี้ " + d.expiringToday + " ถุง");
  if (d.expiring3Days > 0) lines.push("🟠 หมดใน 3 วัน " + d.expiring3Days + " ถุง");
  return lines.join("\n");
}

/** งานสรุปประจำวัน — ผูกกับ Trigger */
function dailySummaryJob() {
  var text = buildSummaryText();
  var sentLine = sendLine(text);
  var sentMail = sendEmail("[Smart Fresh Blood] สรุปคลังเลือดประจำวัน", text);
  audit("NOTIFY_DAILY", "LINE=" + sentLine + " Email=" + sentMail, "system");
}

/** รันครั้งเดียวเพื่อสร้าง Trigger แจ้งเตือนรายวัน 07:00 น. */
function setupNotificationTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "dailySummaryJob") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("dailySummaryJob").timeBased().atHour(7).everyDays(1).create();
  audit("NOTIFY_SETUP", "สร้าง Trigger สรุปประจำวัน 07:00 น.", Session.getActiveUser().getEmail());
}
