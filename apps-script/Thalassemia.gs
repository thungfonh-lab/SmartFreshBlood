/**
 * Thalassemia Planning — ทะเบียนผู้ป่วย วันนัด และความพร้อมของเลือด (Readiness)
 */

function toPatientJson(p) {
  return {
    patientId: String(p.patientId),
    hn: String(p.hn),
    name: String(p.name),
    bloodGroup: String(p.bloodGroup),
    unitsPerVisit: Number(p.unitsPerVisit) || 1,
    frequencyDays: Number(p.frequencyDays) || 28,
    note: String(p.note || ""),
    createdAt: String(p.createdAt || ""),
  };
}

function getPatients() {
  return readAll(SHEET_PATIENTS, PATIENT_HEADERS).map(toPatientJson);
}

function savePatient(input) {
  if (!input.hn || !input.name) throw new Error("กรุณาระบุ HN และชื่อผู้ป่วย");
  if (BLOOD_GROUPS.indexOf(input.bloodGroup) < 0) throw new Error("กรุ๊ปเลือดไม่ถูกต้อง");

  var patients = readAll(SHEET_PATIENTS, PATIENT_HEADERS);

  if (input.patientId) {
    var existing = patients.filter(function (p) {
      return String(p.patientId) === String(input.patientId);
    })[0];
    if (!existing) throw new Error("ไม่พบผู้ป่วยรหัส " + input.patientId);
    var updated = {
      patientId: String(input.patientId),
      hn: String(input.hn),
      name: String(input.name),
      bloodGroup: input.bloodGroup,
      unitsPerVisit: Number(input.unitsPerVisit) || 1,
      frequencyDays: Number(input.frequencyDays) || 28,
      note: String(input.note || ""),
      createdAt: existing.createdAt,
    };
    updateRow(SHEET_PATIENTS, existing._row, PATIENT_HEADERS, updated);
    audit("PATIENT_UPDATE", "แก้ไขผู้ป่วย HN " + input.hn, input.by || "");
    return toPatientJson(updated);
  }

  var dupHn = patients.filter(function (p) {
    return String(p.hn) === String(input.hn);
  })[0];
  if (dupHn) throw new Error("HN " + input.hn + " มีในทะเบียนแล้ว");

  var created = {
    patientId: "P" + Date.now(),
    hn: String(input.hn),
    name: String(input.name),
    bloodGroup: input.bloodGroup,
    unitsPerVisit: Number(input.unitsPerVisit) || 1,
    frequencyDays: Number(input.frequencyDays) || 28,
    note: String(input.note || ""),
    createdAt: new Date().toISOString(),
  };
  appendRows(SHEET_PATIENTS, [
    PATIENT_HEADERS.map(function (h) {
      return created[h];
    }),
  ]);
  audit("PATIENT_ADD", "เพิ่มผู้ป่วย HN " + input.hn + " กรุ๊ป " + input.bloodGroup, input.by || "");
  return toPatientJson(created);
}

/** วันนัดที่ยังไม่เสร็จสิ้น พร้อมคะแนนความพร้อมของเลือด */
function getAppointments() {
  var config = readConfig();
  var patients = {};
  getPatients().forEach(function (p) {
    patients[p.patientId] = p;
  });

  // นับถุงพร้อมจ่ายตามกรุ๊ป แยกเป็น "สด" (freshScore >= threshold) และทั้งหมด
  var avail = availableUnits();
  var freshCount = {};
  var totalCount = {};
  avail.forEach(function (u) {
    var g = String(u.bloodGroup);
    var score = computeFreshScore(toIsoDateString(u.collectDate), toIsoDateString(u.expiryDate), new Date());
    totalCount[g] = (totalCount[g] || 0) + 1;
    if (score >= config.freshThreshold) freshCount[g] = (freshCount[g] || 0) + 1;
  });

  return readAll(SHEET_APPTS, APPT_HEADERS)
    .filter(function (a) {
      return a.status === "PLANNED";
    })
    .map(function (a) {
      var p = patients[String(a.patientId)] || null;
      var group = p ? p.bloodGroup : "";
      var needed = Number(a.unitsNeeded) || 1;
      var fresh = freshCount[group] || 0;
      var readiness = Math.min(100, Math.round((fresh / needed) * 100));
      return {
        apptId: String(a.apptId),
        patientId: String(a.patientId),
        patientName: p ? p.name : "(ไม่พบผู้ป่วย)",
        hn: p ? p.hn : "-",
        bloodGroup: group,
        apptDate: toIsoDateString(a.apptDate),
        unitsNeeded: needed,
        status: String(a.status),
        freshAvailable: fresh,
        totalAvailable: totalCount[group] || 0,
        readiness: readiness,
        riskLevel: readiness >= 100 ? "READY" : readiness >= 50 ? "RISK" : "CRITICAL",
      };
    })
    .sort(function (x, y) {
      return x.apptDate < y.apptDate ? -1 : x.apptDate > y.apptDate ? 1 : 0;
    });
}

function saveAppointment(input) {
  if (!input.patientId) throw new Error("กรุณาเลือกผู้ป่วย");
  if (!input.apptDate) throw new Error("กรุณาระบุวันนัด");
  var created = {
    apptId: "AP" + Date.now(),
    patientId: String(input.patientId),
    apptDate: String(input.apptDate),
    unitsNeeded: Number(input.unitsNeeded) || 1,
    status: "PLANNED",
    createdAt: new Date().toISOString(),
  };
  appendRows(SHEET_APPTS, [
    APPT_HEADERS.map(function (h) {
      return created[h];
    }),
  ]);
  audit("APPT_ADD", "เพิ่มนัดผู้ป่วย " + input.patientId + " วันที่ " + input.apptDate, input.by || "");
  return created;
}

function setAppointmentStatus(input) {
  var valid = ["PLANNED", "COMPLETED", "CANCELLED"];
  if (valid.indexOf(input.status) < 0) throw new Error("สถานะไม่ถูกต้อง");
  var appt = readAll(SHEET_APPTS, APPT_HEADERS).filter(function (a) {
    return String(a.apptId) === String(input.apptId);
  })[0];
  if (!appt) throw new Error("ไม่พบนัดหมาย " + input.apptId);
  appt.status = input.status;
  appt.apptDate = toIsoDateString(appt.apptDate);
  updateRow(SHEET_APPTS, appt._row, APPT_HEADERS, appt);
  audit("APPT_STATUS", "นัด " + input.apptId + " → " + input.status, input.by || "");
  return null;
}
