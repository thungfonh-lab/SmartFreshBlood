/**
 * Reports — ข้อมูลสำหรับรายงานทางการ (สรุปคลัง/รับ/จ่าย/ทำลาย-คืน)
 */

/** ค่าตั้งสาธารณะสำหรับหัวเอกสาร */
function getPublicConfig() {
  var c = readConfig();
  return {
    hospitalName: String(c.hospitalName || ""),
    hospitalAddress: String(c.hospitalAddress || ""),
  };
}

// ---------- System Config (ตั้งค่าผ่านหน้าระบบ) ----------

var CONFIG_KEYS = [
  "hospitalName",
  "hospitalAddress",
  "shelfLifeDays",
  "criticalThreshold",
  "freshThreshold",
  "lineChannelToken",
  "lineTargetId",
  "notifyEmail",
  "notifyNearExpiry",
  "notifyLowStock",
  "notifyCritical",
  "notifyApptReminder",
  "notifyDailySummary",
  "apptReminderDays",
];
var SECRET_KEYS = ["lineChannelToken"];
var MASK_PREFIX = "••••";

/** ค่าตั้งทั้งหมด — ค่าลับถูก mask ไม่ส่งตัวจริงออกไป */
function getAllConfigMasked() {
  var c = readConfig();
  var out = {};
  CONFIG_KEYS.forEach(function (key) {
    var value = String(c[key] !== undefined ? c[key] : "");
    if (SECRET_KEYS.indexOf(key) >= 0 && value) {
      out[key] = MASK_PREFIX + value.slice(-4);
    } else {
      out[key] = value;
    }
  });
  return out;
}

/** บันทึกค่าตั้ง (upsert ลงชีท Config) — ค่าที่ยังเป็น mask จะไม่ถูกเขียนทับ */
function saveConfigEntries(input) {
  if (!input.entries) throw new Error("ไม่มีข้อมูลค่าตั้ง");
  var sheet = getSheet(SHEET_CONFIG);
  var rows = readAll(SHEET_CONFIG, ["key", "value"]);
  var rowByKey = {};
  rows.forEach(function (r) {
    rowByKey[String(r.key)] = r._row;
  });

  var changed = [];
  CONFIG_KEYS.forEach(function (key) {
    if (input.entries[key] === undefined) return;
    var value = String(input.entries[key]);
    if (SECRET_KEYS.indexOf(key) >= 0 && value.indexOf(MASK_PREFIX) === 0) return; // ไม่ได้แก้ค่าลับ
    if (rowByKey[key]) {
      sheet.getRange(rowByKey[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
    changed.push(key);
  });

  audit("CONFIG_SAVE", "แก้ไขค่าตั้ง: " + (changed.join(", ") || "-"), input.by || "");
  return getAllConfigMasked();
}

function inDateRange(isoDateTime, from, to) {
  var d = String(isoDateTime).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** รวมยอดรับเข้า/จ่ายออก/ทำลาย รายเดือน ย้อนหลัง 6 เดือนนับถึงเดือนของวันที่ "to" (หรือวันนี้) */
function monthlyRollup(from, to) {
  var end = to ? parseIsoDate(to) : new Date();
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    months.push(Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM"));
  }

  var received = readAll(SHEET_UNITS, UNIT_HEADERS);
  var issued = readAll(SHEET_ISSUE, ISSUE_HEADERS);
  var destroyed = readAll(SHEET_DESTROY, DESTROY_HEADERS).filter(function (r) {
    return r.action === "DESTROY";
  });

  return months.map(function (m) {
    var recvCount = received.filter(function (u) {
      return String(u.receivedAt).slice(0, 7) === m;
    }).length;
    var issCount = issued.filter(function (r) {
      return String(r.issuedAt).slice(0, 7) === m;
    }).length;
    var destCount = destroyed.filter(function (r) {
      return String(r.at).slice(0, 7) === m;
    }).length;
    var wastagePct = destCount + issCount > 0 ? Math.round((destCount / (destCount + issCount)) * 1000) / 10 : 0;
    return { month: m, received: recvCount, issued: issCount, destroyed: destCount, wastagePct: wastagePct };
  });
}

/**
 * type: stock | receive | issue | destroy
 * from/to: ISO date (yyyy-MM-dd) — ใช้กับ receive/issue/destroy
 */
function getReport(type, from, to) {
  switch (type) {
    case "stock":
      return { type: "stock", generatedAt: new Date().toISOString(), dashboard: getDashboard() };

    case "receive": {
      var rows = readAll(SHEET_UNITS, UNIT_HEADERS)
        .filter(function (u) {
          return inDateRange(u.receivedAt, from, to);
        })
        .map(toUnitJson)
        .sort(function (a, b) {
          return a.receivedAt < b.receivedAt ? -1 : 1;
        });
      return { type: "receive", from: from, to: to, generatedAt: new Date().toISOString(), rows: rows };
    }

    case "issue": {
      var issues = readAll(SHEET_ISSUE, ISSUE_HEADERS)
        .filter(function (r) {
          return inDateRange(r.issuedAt, from, to);
        })
        .map(function (r) {
          return {
            issueId: String(r.issueId),
            unitId: String(r.unitId),
            bloodGroup: String(r.bloodGroup),
            volumeCc: Number(r.volumeCc),
            issueType: String(r.issueType),
            issuedTo: String(r.issuedTo),
            issuedAt: String(r.issuedAt),
            issuedBy: String(r.issuedBy),
          };
        })
        .sort(function (a, b) {
          return a.issuedAt < b.issuedAt ? -1 : 1;
        });
      return { type: "issue", from: from, to: to, generatedAt: new Date().toISOString(), rows: issues };
    }

    case "destroy": {
      var logs = readAll(SHEET_DESTROY, DESTROY_HEADERS)
        .filter(function (r) {
          return inDateRange(r.at, from, to);
        })
        .map(function (r) {
          return {
            logId: String(r.logId),
            unitId: String(r.unitId),
            bloodGroup: String(r.bloodGroup),
            volumeCc: Number(r.volumeCc),
            action: String(r.action),
            reason: String(r.reason),
            at: String(r.at),
            by: String(r.by),
          };
        })
        .sort(function (a, b) {
          return a.at < b.at ? -1 : 1;
        });
      return { type: "destroy", from: from, to: to, generatedAt: new Date().toISOString(), rows: logs };
    }

    case "movement": {
      var mReceived = readAll(SHEET_UNITS, UNIT_HEADERS).filter(function (u) {
        return inDateRange(u.receivedAt, from, to);
      });
      var mIssued = readAll(SHEET_ISSUE, ISSUE_HEADERS).filter(function (r) {
        return inDateRange(r.issuedAt, from, to);
      });
      var mDestroyed = readAll(SHEET_DESTROY, DESTROY_HEADERS).filter(function (r) {
        return r.action === "DESTROY" && inDateRange(r.at, from, to);
      });
      var transactions = mIssued
        .map(function (r) {
          return {
            issueId: String(r.issueId),
            unitId: String(r.unitId),
            bloodGroup: String(r.bloodGroup),
            volumeCc: Number(r.volumeCc),
            issueType: String(r.issueType),
            issuedTo: String(r.issuedTo),
            issuedAt: String(r.issuedAt),
            issuedBy: String(r.issuedBy),
          };
        })
        .sort(function (a, b) {
          return a.issuedAt < b.issuedAt ? 1 : -1;
        });

      return {
        type: "movement",
        from: from,
        to: to,
        generatedAt: new Date().toISOString(),
        movementKpi: { received: mReceived.length, issued: mIssued.length, expired: mDestroyed.length, remaining: availableUnits().length },
        monthly: monthlyRollup(from, to),
        transactions: transactions,
      };
    }

    case "freshscore": {
      var fsIssued = readAll(SHEET_ISSUE, ISSUE_HEADERS).filter(function (r) {
        return inDateRange(r.issuedAt, from, to);
      });
      var unitsById = {};
      readAll(SHEET_UNITS, UNIT_HEADERS).forEach(function (u) {
        unitsById[String(u.unitId)] = u;
      });

      var scored = fsIssued
        .map(function (r) {
          var u = unitsById[String(r.unitId)];
          if (!u) return null;
          var score = computeFreshScore(toIsoDateString(u.collectDate), toIsoDateString(u.expiryDate), new Date(r.issuedAt));
          return { bloodGroup: String(r.bloodGroup), score: score };
        })
        .filter(function (x) {
          return !!x;
        });

      var buckets = [
        { bucket: "0-20", min: 0, max: 20 },
        { bucket: "21-40", min: 21, max: 40 },
        { bucket: "41-60", min: 41, max: 60 },
        { bucket: "61-80", min: 61, max: 80 },
        { bucket: "81-100", min: 81, max: 100 },
      ];
      var histogram = buckets.map(function (b) {
        return {
          bucket: b.bucket,
          count: scored.filter(function (s) {
            return s.score >= b.min && s.score <= b.max;
          }).length,
        };
      });

      var byGroupMap = {};
      scored.forEach(function (s) {
        if (!byGroupMap[s.bloodGroup]) byGroupMap[s.bloodGroup] = [];
        byGroupMap[s.bloodGroup].push(s.score);
      });
      var byGroup = BLOOD_GROUPS.map(function (g) {
        var arr = byGroupMap[g] || [];
        var avg = arr.length ? Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length) : 0;
        return { bloodGroup: g, avgScore: avg };
      });

      var avgAtIssueTime = scored.length
        ? Math.round(
            scored.reduce(function (a, s) {
              return a + s.score;
            }, 0) / scored.length
          )
        : 0;

      return {
        type: "freshscore",
        from: from,
        to: to,
        generatedAt: new Date().toISOString(),
        avgCurrentStock: getDashboard().avgFreshScore,
        avgAtIssueTime: avgAtIssueTime,
        histogram: histogram,
        byGroup: byGroup,
      };
    }

    case "executive": {
      var exReceived = readAll(SHEET_UNITS, UNIT_HEADERS).filter(function (u) {
        return inDateRange(u.receivedAt, from, to);
      }).length;
      var exIssued = readAll(SHEET_ISSUE, ISSUE_HEADERS).filter(function (r) {
        return inDateRange(r.issuedAt, from, to);
      }).length;
      var exDestroyed = readAll(SHEET_DESTROY, DESTROY_HEADERS).filter(function (r) {
        return r.action === "DESTROY" && inDateRange(r.at, from, to);
      }).length;
      var exRequests = readAll(SHEET_REQUESTS, REQUEST_HEADERS).filter(function (r) {
        return inDateRange(r.requestDate, from, to);
      });
      var requestedTotal = 0;
      var fulfilledTotal = 0;
      exRequests.forEach(function (r) {
        var items = [];
        try {
          items = JSON.parse(String(r.itemsJson || "[]"));
        } catch (ignored) {}
        requestedTotal += items.reduce(function (s, it) {
          return s + (Number(it.units) || 0);
        }, 0);
        fulfilledTotal += Number(r.fulfilledUnits) || 0;
      });

      var utilizationRate = exReceived > 0 ? Math.round((exIssued / exReceived) * 1000) / 10 : 0;
      var wastageRate = exDestroyed + exIssued > 0 ? Math.round((exDestroyed / (exDestroyed + exIssued)) * 1000) / 10 : 0;
      var fulfillmentRate = requestedTotal > 0 ? Math.round((fulfilledTotal / requestedTotal) * 1000) / 10 : 0;

      var roll = monthlyRollup(from, to);
      var trendUtilization = roll.map(function (m) {
        return { month: m.month, value: m.received > 0 ? Math.round((m.issued / m.received) * 1000) / 10 : 0 };
      });
      var trendWastage = roll.map(function (m) {
        return { month: m.month, value: m.wastagePct };
      });

      var thisM = roll[roll.length - 1];
      var lastM = roll[roll.length - 2] || { received: 0, issued: 0, wastagePct: 0 };
      var thisUtil = thisM.received > 0 ? Math.round((thisM.issued / thisM.received) * 1000) / 10 : 0;
      var lastUtil = lastM.received > 0 ? Math.round((lastM.issued / lastM.received) * 1000) / 10 : 0;

      function cmpRow(metric, thisVal, lastVal, higherIsBetter) {
        var delta = Math.round((thisVal - lastVal) * 10) / 10;
        var improved = higherIsBetter ? delta >= 0 : delta <= 0;
        return { metric: metric, thisMonth: thisVal, lastMonth: lastVal, delta: delta, status: improved ? "ดีขึ้น" : "ต้องแก้ไข" };
      }

      return {
        type: "executive",
        from: from,
        to: to,
        generatedAt: new Date().toISOString(),
        execKpi: { totalStock: getDashboard().totalUnits, utilizationRate: utilizationRate, wastageRate: wastageRate, fulfillmentRate: fulfillmentRate },
        trend: { utilization: trendUtilization, wastage: trendWastage },
        comparison: [
          cmpRow("Utilization Rate (%)", thisUtil, lastUtil, true),
          cmpRow("Wastage Rate (%)", thisM.wastagePct, lastM.wastagePct, false),
        ],
      };
    }

    default:
      throw new Error("ไม่รู้จักประเภทรายงาน: " + type);
  }
}
