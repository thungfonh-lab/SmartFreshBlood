/**
 * Business Logic — dashboard / inventory / receive / issue / expiring / destroy
 */

var BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

function availableUnits() {
  return readAll(SHEET_UNITS, UNIT_HEADERS).filter(function (u) {
    return u.status === "AVAILABLE";
  });
}

// ---------- Dashboard ----------

function getDashboard() {
  var config = readConfig();
  var avail = availableUnits();

  var groups = BLOOD_GROUPS.map(function (g) {
    var list = avail.filter(function (u) {
      return u.bloodGroup === g;
    });
    var scores = list.map(function (u) {
      return computeFreshScore(toIsoDateString(u.collectDate), toIsoDateString(u.expiryDate), new Date());
    });
    var sum = scores.reduce(function (a, b) {
      return a + b;
    }, 0);
    return {
      bloodGroup: g,
      units: list.length,
      volumeCc: list.reduce(function (s, u) {
        return s + Number(u.volumeCc);
      }, 0),
      avgFreshScore: scores.length ? Math.round(sum / scores.length) : 0,
      nearExpiry: list.filter(function (u) {
        return daysUntilExpiry(toIsoDateString(u.expiryDate), new Date()) <= 7;
      }).length,
    };
  });

  var allScores = avail.map(function (u) {
    return computeFreshScore(toIsoDateString(u.collectDate), toIsoDateString(u.expiryDate), new Date());
  });
  var totalScore = allScores.reduce(function (a, b) {
    return a + b;
  }, 0);

  function countExpiring(maxDays) {
    return avail.filter(function (u) {
      return daysUntilExpiry(toIsoDateString(u.expiryDate), new Date()) <= maxDays;
    }).length;
  }

  return {
    totalUnits: avail.length,
    totalVolumeCc: avail.reduce(function (s, u) {
      return s + Number(u.volumeCc);
    }, 0),
    avgFreshScore: allScores.length ? Math.round(totalScore / allScores.length) : 0,
    expiringToday: countExpiring(0),
    expiring3Days: countExpiring(3),
    expiring7Days: countExpiring(7),
    criticalGroups: groups
      .filter(function (g) {
        return g.units < config.criticalThreshold;
      })
      .map(function (g) {
        return g.bloodGroup;
      }),
    groups: groups,
  };
}

// ---------- Inventory ----------

function getInventory(bloodGroup) {
  return availableUnits()
    .filter(function (u) {
      return !bloodGroup || u.bloodGroup === bloodGroup;
    })
    .map(toUnitJson)
    .sort(function (a, b) {
      return a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0;
    });
}

// ---------- Receive ----------

function receiveBlood(input) {
  if (!input.bloodGroup || BLOOD_GROUPS.indexOf(input.bloodGroup) < 0) throw new Error("กรุ๊ปเลือดไม่ถูกต้อง");
  if (!input.unitIds || !input.unitIds.length) throw new Error("ไม่มีหมายเลขถุง");
  if (!input.collectDate) throw new Error("ไม่มีวันที่เจาะเก็บ");
  if (!(Number(input.volumeCc) > 0)) throw new Error("ปริมาณ (cc) ไม่ถูกต้อง");

  var config = readConfig();
  var existing = {};
  readAll(SHEET_UNITS, UNIT_HEADERS).forEach(function (u) {
    existing[String(u.unitId)] = true;
  });

  var expiryDate = addDaysIso(input.collectDate, config.shelfLifeDays);
  var now = new Date().toISOString();
  var created = [];
  var rows = input.unitIds.map(function (unitId) {
    var id = String(unitId).trim();
    if (!id) throw new Error("หมายเลขถุงว่าง");
    if (existing[id]) throw new Error("หมายเลขถุง " + id + " มีอยู่ในระบบแล้ว");
    existing[id] = true;
    var unit = {
      unitId: id,
      bloodGroup: input.bloodGroup,
      component: input.component || "PRC",
      volumeCc: Number(input.volumeCc),
      collectDate: input.collectDate,
      expiryDate: expiryDate,
      status: "AVAILABLE",
      receivedAt: now,
      receivedBy: input.receivedBy || "",
    };
    created.push(unit);
    return UNIT_HEADERS.map(function (h) {
      return unit[h];
    });
  });

  appendRows(SHEET_UNITS, rows);
  audit("RECEIVE", "รับเลือด " + rows.length + " ถุง กรุ๊ป " + input.bloodGroup, input.receivedBy);
  return created;
}

// ---------- Issue ----------

function issueBlood(input) {
  if (!(Number(input.unitCount) > 0) && !(input.manualUnitIds && input.manualUnitIds.length))
    throw new Error("จำนวนถุงไม่ถูกต้อง");

  var avail = availableUnits();
  var picked;

  if (input.manualUnitIds && input.manualUnitIds.length) {
    picked = avail.filter(function (u) {
      return input.manualUnitIds.indexOf(String(u.unitId)) >= 0;
    });
    if (picked.length !== input.manualUnitIds.length) throw new Error("บางถุงไม่พร้อมจ่าย");
  } else {
    var candidates = avail
      .filter(function (u) {
        return u.bloodGroup === input.bloodGroup && daysUntilExpiry(toIsoDateString(u.expiryDate), new Date()) >= 0;
      })
      .sort(function (a, b) {
        var ea = toIsoDateString(a.expiryDate);
        var eb = toIsoDateString(b.expiryDate);
        // THALASSEMIA → เลือดสดที่สุดก่อน, GENERAL → FEFO
        if (input.issueType === "THALASSEMIA") return ea < eb ? 1 : ea > eb ? -1 : 0;
        return ea < eb ? -1 : ea > eb ? 1 : 0;
      });
    if (candidates.length < input.unitCount)
      throw new Error("เลือดกรุ๊ป " + input.bloodGroup + " มีเพียง " + candidates.length + " ถุง ไม่พอจ่าย " + input.unitCount + " ถุง");
    picked = candidates.slice(0, input.unitCount);
  }

  var now = new Date().toISOString();
  var rowToStatus = {};
  var issueRows = [];
  var records = picked.map(function (u, i) {
    rowToStatus[u._row] = "ISSUED";
    var record = {
      issueId: "I" + Date.now() + i,
      unitId: String(u.unitId),
      bloodGroup: String(u.bloodGroup),
      volumeCc: Number(u.volumeCc),
      issueType: input.issueType || "GENERAL",
      issuedTo: input.issuedTo || "",
      issuedAt: now,
      issuedBy: input.issuedBy || "",
    };
    issueRows.push(
      ISSUE_HEADERS.map(function (h) {
        return record[h];
      })
    );
    return record;
  });

  updateUnitStatuses(rowToStatus);
  appendRows(SHEET_ISSUE, issueRows);
  audit(
    "ISSUE",
    "จ่ายเลือด " + records.length + " ถุง (" + (input.issueType || "GENERAL") + ") ให้ " + (input.issuedTo || "-"),
    input.issuedBy
  );
  return records;
}

// ---------- Expiring ----------

function getExpiring() {
  var buckets = { today: [], in3Days: [], in7Days: [] };
  availableUnits().forEach(function (u) {
    var d = daysUntilExpiry(toIsoDateString(u.expiryDate), new Date());
    if (d <= 0) buckets.today.push(toUnitJson(u));
    else if (d <= 3) buckets.in3Days.push(toUnitJson(u));
    else if (d <= 7) buckets.in7Days.push(toUnitJson(u));
  });
  var byExpiry = function (a, b) {
    return a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0;
  };
  buckets.today.sort(byExpiry);
  buckets.in3Days.sort(byExpiry);
  buckets.in7Days.sort(byExpiry);
  return buckets;
}

// ---------- Destroy ----------

function destroyUnits(input) {
  return changeUnitStatusWithLog(input, "DESTROYED", "DESTROY", "ทำลาย");
}

// ---------- Return ----------

function returnUnits(input) {
  return changeUnitStatusWithLog(input, "RETURNED", "RETURN", "คืน");
}

/** เปลี่ยนสถานะถุง + บันทึก DestroyLog รายถุง (ใช้ร่วมกันระหว่างทำลาย/คืน) */
function changeUnitStatusWithLog(input, newStatus, auditAction, actionThai) {
  if (!input.unitIds || !input.unitIds.length) throw new Error("ไม่มีหมายเลขถุง");
  var now = new Date().toISOString();
  var rowToStatus = {};
  var logRows = [];
  availableUnits().forEach(function (u, i) {
    if (input.unitIds.indexOf(String(u.unitId)) >= 0) {
      rowToStatus[u._row] = newStatus;
      logRows.push([
        "DL" + Date.now() + i,
        String(u.unitId),
        String(u.bloodGroup),
        Number(u.volumeCc),
        auditAction,
        String(input.reason || ""),
        now,
        String(input.by || ""),
      ]);
    }
  });
  if (!Object.keys(rowToStatus).length) throw new Error("ไม่พบถุงที่ดำเนินการได้");
  updateUnitStatuses(rowToStatus);
  appendRows(SHEET_DESTROY, logRows);
  audit(auditAction, actionThai + "ถุง " + input.unitIds.join(", ") + " เหตุผล: " + (input.reason || "-"), input.by);
  return null;
}
