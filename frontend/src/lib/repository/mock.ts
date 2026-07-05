import { addDays, daysUntilExpiry, freshScore, toIsoDate } from "../freshScore";
import type {
  Appointment,
  ApptStatus,
  AuditLogParams,
  AuditLogResult,
  AuditLogRow,
  BloodGroup,
  BloodRequestDoc,
  BloodUnit,
  DashboardData,
  DestroyLogRow,
  ExecutiveComparisonRow,
  ExpiringData,
  FreshScoreByGroup,
  FreshScoreHistogramBucket,
  GroupSummary,
  HospitalConfig,
  IssueInput,
  IssueRecord,
  MonthlyRollup,
  NotificationLogResult,
  NotificationLogRow,
  Patient,
  ReceiveInput,
  ReportData,
  ReportType,
  RequestFulfillmentInput,
  RequestItem,
  SearchResult,
  StockSnapshotPoint,
  SystemConfig,
  TrendPoint,
} from "../types";
import { BLOOD_GROUPS } from "../types";
import type { BloodRepository } from "./types";

const STORAGE_KEY = "sfb-mock-units";
const CRITICAL_THRESHOLD = 3; // ต่ำกว่านี้ถือว่า Critical

function todayIso(): string {
  return toIsoDate(new Date());
}

/** สร้างข้อมูลตัวอย่างครบ 8 กรุ๊ป วันหมดอายุหลากหลาย */
function seedUnits(): BloodUnit[] {
  const today = todayIso();
  const specs: Array<[BloodGroup, number, number]> = [
    // [กรุ๊ป, จำนวนถุง, อายุที่เก็บมาแล้ว (วัน)]
    ["O+", 4, 3],
    ["O+", 3, 20],
    ["O+", 2, 34], // ใกล้หมดอายุมาก
    ["O-", 2, 10],
    ["A+", 3, 5],
    ["A+", 2, 30],
    ["A-", 1, 33], // หมดใน 2 วัน
    ["B+", 4, 15],
    ["B+", 1, 35], // หมดอายุวันนี้
    ["B-", 2, 25],
    ["AB+", 2, 8],
    ["AB-", 1, 28],
  ];
  const units: BloodUnit[] = [];
  let seq = 1;
  for (const [group, count, ageDays] of specs) {
    for (let i = 0; i < count; i++) {
      const collectDate = addDays(today, -ageDays);
      units.push({
        unitId: `U${String(seq++).padStart(5, "0")}`,
        bloodGroup: group,
        component: "PRC",
        volumeCc: 350,
        collectDate,
        expiryDate: addDays(collectDate, 35),
        status: "AVAILABLE",
        receivedAt: new Date().toISOString(),
        receivedBy: "ระบบตัวอย่าง",
      });
    }
  }
  return units;
}

function loadUnits(): BloodUnit[] {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as BloodUnit[];
      } catch {
        // ข้อมูลเสีย ใช้ seed ใหม่
      }
    }
  }
  return seedUnits();
}

function saveUnits(units: BloodUnit[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  }
}

export class MockRepository implements BloodRepository {
  private units: BloodUnit[] | null = null;

  private all(): BloodUnit[] {
    if (!this.units) this.units = loadUnits();
    return this.units;
  }

  private available(): BloodUnit[] {
    return this.all().filter((u) => u.status === "AVAILABLE");
  }

  private persist() {
    saveUnits(this.all());
  }

  async getDashboard(): Promise<DashboardData> {
    const avail = this.available();
    const groups: GroupSummary[] = BLOOD_GROUPS.map((g) => {
      const list = avail.filter((u) => u.bloodGroup === g);
      const scores = list.map((u) => freshScore(u));
      return {
        bloodGroup: g,
        units: list.length,
        volumeCc: list.reduce((s, u) => s + u.volumeCc, 0),
        avgFreshScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        nearExpiry: list.filter((u) => daysUntilExpiry(u.expiryDate) <= 7).length,
      };
    });
    const allScores = avail.map((u) => freshScore(u));
    return {
      totalUnits: avail.length,
      totalVolumeCc: avail.reduce((s, u) => s + u.volumeCc, 0),
      avgFreshScore: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
      expiringToday: avail.filter((u) => daysUntilExpiry(u.expiryDate) <= 0).length,
      expiring3Days: avail.filter((u) => daysUntilExpiry(u.expiryDate) <= 3).length,
      expiring7Days: avail.filter((u) => daysUntilExpiry(u.expiryDate) <= 7).length,
      criticalGroups: groups.filter((g) => g.units < CRITICAL_THRESHOLD).map((g) => g.bloodGroup),
      groups,
    };
  }

  async getInventory(bloodGroup?: BloodGroup): Promise<BloodUnit[]> {
    const list = this.available().filter((u) => !bloodGroup || u.bloodGroup === bloodGroup);
    // FEFO: หมดอายุก่อนอยู่บนสุด
    return [...list].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }

  async receive(input: ReceiveInput): Promise<BloodUnit[]> {
    const existing = new Set(this.all().map((u) => u.unitId));
    const dup = input.unitIds.find((id) => existing.has(id));
    if (dup) throw new Error(`หมายเลขถุง ${dup} มีอยู่ในระบบแล้ว`);
    const created: BloodUnit[] = input.unitIds.map((unitId) => ({
      unitId,
      bloodGroup: input.bloodGroup,
      component: input.component,
      volumeCc: input.volumeCc,
      collectDate: input.collectDate,
      expiryDate: addDays(input.collectDate, 35),
      status: "AVAILABLE",
      receivedAt: new Date().toISOString(),
      receivedBy: input.receivedBy,
    }));
    this.all().push(...created);
    this.persist();
    return created;
  }

  async issue(input: IssueInput): Promise<IssueRecord[]> {
    let picked: BloodUnit[];
    if (input.manualUnitIds?.length) {
      picked = this.available().filter((u) => input.manualUnitIds!.includes(u.unitId));
      if (picked.length !== input.manualUnitIds.length) throw new Error("บางถุงไม่พร้อมจ่าย");
    } else {
      const candidates = this.available()
        .filter((u) => u.bloodGroup === input.bloodGroup && daysUntilExpiry(u.expiryDate) >= 0)
        .sort((a, b) =>
          input.issueType === "THALASSEMIA"
            ? b.expiryDate.localeCompare(a.expiryDate) // เลือดสดที่สุดก่อน
            : a.expiryDate.localeCompare(b.expiryDate) // FEFO
        );
      if (candidates.length < input.unitCount)
        throw new Error(`เลือดกรุ๊ป ${input.bloodGroup} มีเพียง ${candidates.length} ถุง ไม่พอจ่าย ${input.unitCount} ถุง`);
      picked = candidates.slice(0, input.unitCount);
    }
    const now = new Date().toISOString();
    const records: IssueRecord[] = picked.map((u, i) => {
      u.status = "ISSUED";
      return {
        issueId: `I${Date.now()}${i}`,
        unitId: u.unitId,
        bloodGroup: u.bloodGroup,
        volumeCc: u.volumeCc,
        issueType: input.issueType,
        issuedTo: input.issuedTo,
        issuedAt: now,
        issuedBy: input.issuedBy,
      };
    });
    this.persist();
    this.extra().issueLog.push(...records);
    this.persistExtra();
    return records;
  }

  async getExpiring(): Promise<ExpiringData> {
    const avail = this.available();
    const withDays = avail.map((u) => ({ u, d: daysUntilExpiry(u.expiryDate) }));
    const sortByExpiry = (list: BloodUnit[]) => list.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return {
      today: sortByExpiry(withDays.filter((x) => x.d <= 0).map((x) => x.u)),
      in3Days: sortByExpiry(withDays.filter((x) => x.d > 0 && x.d <= 3).map((x) => x.u)),
      in7Days: sortByExpiry(withDays.filter((x) => x.d > 3 && x.d <= 7).map((x) => x.u)),
    };
  }

  async destroy(unitIds: string[], reason: string, by: string): Promise<void> {
    this.changeStatus(unitIds, "DESTROYED", "DESTROY", reason, by);
  }

  async returnUnits(unitIds: string[], reason: string, by: string): Promise<void> {
    this.changeStatus(unitIds, "RETURNED", "RETURN", reason, by);
  }

  private changeStatus(unitIds: string[], status: BloodUnit["status"], action: "DESTROY" | "RETURN", reason: string, by: string) {
    const now = new Date().toISOString();
    for (const u of this.all()) {
      if (unitIds.includes(u.unitId) && u.status === "AVAILABLE") {
        u.status = status;
        this.extra().destroyLog.push({
          logId: `DL${Date.now()}${u.unitId}`,
          unitId: u.unitId,
          bloodGroup: u.bloodGroup,
          volumeCc: u.volumeCc,
          action,
          reason,
          at: now,
          by,
        });
      }
    }
    this.persist();
    this.persistExtra();
  }

  // ---------- Phase 2 (mock) ----------

  private extraData: MockExtra | null = null;

  private extra(): MockExtra {
    if (!this.extraData) this.extraData = loadExtra();
    return this.extraData;
  }

  private persistExtra() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EXTRA_KEY, JSON.stringify(this.extra()));
    }
  }

  async getPatients(): Promise<Patient[]> {
    return [...this.extra().patients];
  }

  async savePatient(input: Partial<Patient>): Promise<Patient> {
    const patients = this.extra().patients;
    if (input.patientId) {
      const p = patients.find((x) => x.patientId === input.patientId);
      if (!p) throw new Error("ไม่พบผู้ป่วย");
      Object.assign(p, input);
      this.persistExtra();
      return p;
    }
    if (patients.some((x) => x.hn === input.hn)) throw new Error(`HN ${input.hn} มีในทะเบียนแล้ว`);
    const created: Patient = {
      patientId: `P${Date.now()}`,
      hn: input.hn ?? "",
      name: input.name ?? "",
      bloodGroup: (input.bloodGroup ?? "O+") as BloodGroup,
      unitsPerVisit: input.unitsPerVisit ?? 1,
      frequencyDays: input.frequencyDays ?? 28,
      note: input.note ?? "",
      createdAt: new Date().toISOString(),
    };
    patients.push(created);
    this.persistExtra();
    return created;
  }

  async getAppointments(): Promise<Appointment[]> {
    const avail = this.available();
    const freshCount = (g: string) => avail.filter((u) => u.bloodGroup === g && freshScore(u) >= 70).length;
    const totalCount = (g: string) => avail.filter((u) => u.bloodGroup === g).length;
    return this.extra()
      .appointments.filter((a) => a.status === "PLANNED")
      .map((a) => {
        const p = this.extra().patients.find((x) => x.patientId === a.patientId);
        const fresh = p ? freshCount(p.bloodGroup) : 0;
        const readiness = Math.min(100, Math.round((fresh / a.unitsNeeded) * 100));
        return {
          apptId: a.apptId,
          patientId: a.patientId,
          patientName: p?.name ?? "(ไม่พบผู้ป่วย)",
          hn: p?.hn ?? "-",
          bloodGroup: p?.bloodGroup ?? "",
          apptDate: a.apptDate,
          unitsNeeded: a.unitsNeeded,
          status: a.status,
          freshAvailable: fresh,
          totalAvailable: p ? totalCount(p.bloodGroup) : 0,
          readiness,
          riskLevel: readiness >= 100 ? "READY" : readiness >= 50 ? "RISK" : "CRITICAL",
        } as Appointment;
      })
      .sort((a, b) => a.apptDate.localeCompare(b.apptDate));
  }

  async saveAppointment(input: { patientId: string; apptDate: string; unitsNeeded: number }): Promise<void> {
    this.extra().appointments.push({
      apptId: `AP${Date.now()}`,
      patientId: input.patientId,
      apptDate: input.apptDate,
      unitsNeeded: input.unitsNeeded,
      status: "PLANNED",
    });
    this.persistExtra();
  }

  async setAppointmentStatus(apptId: string, status: ApptStatus): Promise<void> {
    const a = this.extra().appointments.find((x) => x.apptId === apptId);
    if (a) a.status = status;
    this.persistExtra();
  }

  async getRequests(): Promise<BloodRequestDoc[]> {
    return [...this.extra().requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createRequest(input: { items: RequestItem[]; requestedTo: string; requestedBy: string; note: string }): Promise<BloodRequestDoc> {
    const today = todayIso();
    const dateKey = today.replace(/-/g, "");
    const count = this.extra().requests.filter((r) => r.requestNo.startsWith(`SFB-${dateKey}`)).length;
    const doc: BloodRequestDoc = {
      requestId: `RQ${Date.now()}`,
      requestNo: `SFB-${dateKey}-${String(count + 1).padStart(3, "0")}`,
      requestDate: today,
      requestedTo: input.requestedTo,
      requestedBy: input.requestedBy,
      note: input.note,
      items: input.items,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      fulfilledUnits: 0,
    };
    this.extra().requests.push(doc);
    this.persistExtra();
    return doc;
  }

  async updateRequestFulfillment(input: RequestFulfillmentInput): Promise<BloodRequestDoc> {
    const r = this.extra().requests.find((x) => x.requestId === input.requestId);
    if (!r) throw new Error(`ไม่พบใบขอเลือด ${input.requestId}`);
    const totalRequested = r.items.reduce((s, it) => s + it.units, 0);
    const fulfilledUnits = Math.max(0, input.fulfilledUnits);
    r.fulfilledUnits = fulfilledUnits;
    r.status = input.status ?? (fulfilledUnits <= 0 ? "PENDING" : fulfilledUnits >= totalRequested ? "FULFILLED" : "PARTIAL");
    this.persistExtra();
    return { ...r };
  }

  private monthlyRollup(to?: string): MonthlyRollup[] {
    const end = to ? new Date(to) : new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const received = this.all();
    const issued = this.extra().issueLog;
    const destroyed = this.extra().destroyLog.filter((r) => r.action === "DESTROY");
    return months.map((m) => {
      const recvCount = received.filter((u) => u.receivedAt.slice(0, 7) === m).length;
      const issCount = issued.filter((r) => r.issuedAt.slice(0, 7) === m).length;
      const destCount = destroyed.filter((r) => r.at.slice(0, 7) === m).length;
      const wastagePct = destCount + issCount > 0 ? Math.round((destCount / (destCount + issCount)) * 1000) / 10 : 0;
      return { month: m, received: recvCount, issued: issCount, destroyed: destCount, wastagePct };
    });
  }

  async getReport(type: ReportType, from?: string, to?: string): Promise<ReportData> {
    const inRange = (iso: string) => {
      const d = iso.slice(0, 10);
      return (!from || d >= from) && (!to || d <= to);
    };
    const generatedAt = new Date().toISOString();
    if (type === "stock") return { type, generatedAt, dashboard: await this.getDashboard() };
    if (type === "receive")
      return { type, from, to, generatedAt, rows: this.all().filter((u) => inRange(u.receivedAt)) };
    if (type === "issue") return { type, from, to, generatedAt, rows: this.extra().issueLog.filter((r) => inRange(r.issuedAt)) };
    if (type === "destroy") return { type, from, to, generatedAt, rows: this.extra().destroyLog.filter((r) => inRange(r.at)) };

    if (type === "movement") {
      const received = this.all().filter((u) => inRange(u.receivedAt));
      const issued = this.extra().issueLog.filter((r) => inRange(r.issuedAt));
      const destroyed = this.extra().destroyLog.filter((r) => r.action === "DESTROY" && inRange(r.at));
      const transactions = [...issued].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
      return {
        type,
        from,
        to,
        generatedAt,
        movementKpi: { received: received.length, issued: issued.length, expired: destroyed.length, remaining: this.available().length },
        monthly: this.monthlyRollup(to),
        transactions,
      };
    }

    if (type === "freshscore") {
      const issued = this.extra().issueLog.filter((r) => inRange(r.issuedAt));
      const unitsById = new Map(this.all().map((u) => [u.unitId, u]));
      const scored = issued
        .map((r) => {
          const u = unitsById.get(r.unitId);
          if (!u) return null;
          return { bloodGroup: r.bloodGroup, score: freshScore(u, new Date(r.issuedAt)) };
        })
        .filter((x): x is { bloodGroup: BloodGroup; score: number } => !!x);

      const bucketDefs = [
        { bucket: "0-20", min: 0, max: 20 },
        { bucket: "21-40", min: 21, max: 40 },
        { bucket: "41-60", min: 41, max: 60 },
        { bucket: "61-80", min: 61, max: 80 },
        { bucket: "81-100", min: 81, max: 100 },
      ];
      const histogram: FreshScoreHistogramBucket[] = bucketDefs.map((b) => ({
        bucket: b.bucket,
        count: scored.filter((s) => s.score >= b.min && s.score <= b.max).length,
      }));
      const byGroup: FreshScoreByGroup[] = BLOOD_GROUPS.map((g) => {
        const arr = scored.filter((s) => s.bloodGroup === g).map((s) => s.score);
        return { bloodGroup: g, avgScore: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0 };
      });
      const avgAtIssueTime = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : 0;
      const dashboard = await this.getDashboard();
      return { type, from, to, generatedAt, avgCurrentStock: dashboard.avgFreshScore, avgAtIssueTime, histogram, byGroup };
    }

    // executive
    const received = this.all().filter((u) => inRange(u.receivedAt)).length;
    const issued = this.extra().issueLog.filter((r) => inRange(r.issuedAt)).length;
    const destroyed = this.extra().destroyLog.filter((r) => r.action === "DESTROY" && inRange(r.at)).length;
    const requests = this.extra().requests.filter((r) => inRange(r.requestDate));
    const requestedTotal = requests.reduce((s, r) => s + r.items.reduce((s2, it) => s2 + it.units, 0), 0);
    const fulfilledTotal = requests.reduce((s, r) => s + r.fulfilledUnits, 0);

    const utilizationRate = received > 0 ? Math.round((issued / received) * 1000) / 10 : 0;
    const wastageRate = destroyed + issued > 0 ? Math.round((destroyed / (destroyed + issued)) * 1000) / 10 : 0;
    const fulfillmentRate = requestedTotal > 0 ? Math.round((fulfilledTotal / requestedTotal) * 1000) / 10 : 0;

    const roll = this.monthlyRollup(to);
    const trendUtilization: TrendPoint[] = roll.map((m) => ({
      month: m.month,
      value: m.received > 0 ? Math.round((m.issued / m.received) * 1000) / 10 : 0,
    }));
    const trendWastage: TrendPoint[] = roll.map((m) => ({ month: m.month, value: m.wastagePct }));

    const thisM = roll[roll.length - 1];
    const lastM = roll[roll.length - 2] ?? { received: 0, issued: 0, wastagePct: 0, destroyed: 0, month: "" };
    const thisUtil = thisM.received > 0 ? Math.round((thisM.issued / thisM.received) * 1000) / 10 : 0;
    const lastUtil = lastM.received > 0 ? Math.round((lastM.issued / lastM.received) * 1000) / 10 : 0;

    const cmpRow = (metric: string, thisVal: number, lastVal: number, higherIsBetter: boolean): ExecutiveComparisonRow => {
      const delta = Math.round((thisVal - lastVal) * 10) / 10;
      const improved = higherIsBetter ? delta >= 0 : delta <= 0;
      return { metric, thisMonth: thisVal, lastMonth: lastVal, delta, status: improved ? "ดีขึ้น" : "ต้องแก้ไข" };
    };

    const dashboard = await this.getDashboard();
    return {
      type,
      from,
      to,
      generatedAt,
      execKpi: { totalStock: dashboard.totalUnits, utilizationRate, wastageRate, fulfillmentRate },
      trend: { utilization: trendUtilization, wastage: trendWastage },
      comparison: [
        cmpRow("Utilization Rate (%)", thisUtil, lastUtil, true),
        cmpRow("Wastage Rate (%)", thisM.wastagePct, lastM.wastagePct, false),
      ],
    };
  }

  async getConfig(): Promise<HospitalConfig> {
    const c = this.extra().config ?? {};
    return { hospitalName: c.hospitalName || "โรงพยาบาลตัวอย่าง (โหมดทดสอบ)", hospitalAddress: c.hospitalAddress || "" };
  }

  async search(q: string): Promise<SearchResult> {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return { units: [], patients: [] };
    const lastIssue = new Map(this.extra().issueLog.map((r) => [r.unitId, r]));
    const units = this.all()
      .filter((u) => u.unitId.toLowerCase().includes(query))
      .slice(0, 30)
      .map((u) => {
        const issue = lastIssue.get(u.unitId);
        return issue ? { ...u, issuedTo: issue.issuedTo, issuedAt: issue.issuedAt } : { ...u };
      });
    const patients = this.extra()
      .patients.filter((p) => p.hn.toLowerCase().includes(query) || p.name.toLowerCase().includes(query))
      .slice(0, 30);
    return { units, patients };
  }

  async getAllConfig(): Promise<SystemConfig> {
    return {
      hospitalName: "โรงพยาบาลตัวอย่าง (โหมดทดสอบ)",
      hospitalAddress: "",
      shelfLifeDays: "35",
      criticalThreshold: "3",
      freshThreshold: "70",
      lineChannelToken: "",
      lineTargetId: "",
      notifyEmail: "",
      ...this.extra().config,
    };
  }

  async saveConfig(entries: SystemConfig): Promise<SystemConfig> {
    this.extra().config = { ...this.extra().config, ...entries };
    this.persistExtra();
    return this.getAllConfig();
  }

  async getAuditLog(params: AuditLogParams): Promise<AuditLogResult> {
    const all = generateFakeAuditLog();
    const users = Array.from(new Set(all.filter((r) => r.user).map((r) => r.user))).sort();
    const filtered = all.filter((r) => {
      if ((params.from || params.to) && !inMockRange(r.timestamp, params.from, params.to)) return false;
      if (params.user && r.user !== params.user) return false;
      if (params.channel && r.channel !== params.channel) return false;
      return true;
    });
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize, users };
  }

  async getNotificationLog(params: { from?: string; to?: string; page?: number; pageSize?: number }): Promise<NotificationLogResult> {
    const all = generateFakeNotificationLog();
    const filtered = all.filter((r) => !(params.from || params.to) || inMockRange(r.timestamp, params.from, params.to));
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
  }

  async getStockSnapshot(bloodGroup: BloodGroup, days = 7): Promise<StockSnapshotPoint[]> {
    const current = this.available().filter((u) => u.bloodGroup === bloodGroup);
    const baseCount = current.length;
    const baseScores = current.map((u) => freshScore(u));
    const baseAvg = baseScores.length ? Math.round(baseScores.reduce((a, b) => a + b, 0) / baseScores.length) : 50;
    const today = todayIso();
    const points: StockSnapshotPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      // ข้อมูลจำลอง: แกว่งเล็กน้อยรอบค่าปัจจุบัน (ของจริงจะสะสมทีละวันหลัง deploy)
      const wobble = ((i * 7) % 5) - 2;
      points.push({
        date,
        unitCount: Math.max(0, baseCount + wobble),
        totalVolumeCc: Math.max(0, baseCount + wobble) * 350,
        avgFreshScore: Math.min(100, Math.max(0, baseAvg + wobble * 2)),
      });
    }
    return points;
  }
}

function inMockRange(iso: string, from?: string, to?: string): boolean {
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

const FAKE_STAFF = ["เจ้าหน้าที่ ก.", "เจ้าหน้าที่ ข.", "นักเทคนิค ค.", "หัวหน้างาน ง."];
const FAKE_ACTIONS: { action: string; detail: string }[] = [
  { action: "RECEIVE", detail: "รับเลือด 3 ถุง กรุ๊ป O+" },
  { action: "ISSUE", detail: "จ่ายเลือด 2 ถุง (GENERAL) ให้ ตึกอายุรกรรม" },
  { action: "DESTROY", detail: "ทำลายถุง U00012 เหตุผล: หมดอายุ" },
  { action: "PATIENT_ADD", detail: "เพิ่มผู้ป่วย HN 55501 กรุ๊ป B+" },
  { action: "CONFIG_SAVE", detail: "แก้ไขค่าตั้ง: hospitalName" },
  { action: "REQUEST_CREATE", detail: "สร้างใบขอเลือด SFB-20260701-001" },
];

/** สร้างประวัติ Audit Log จำลอง — คงที่ทุกครั้งที่เรียก (ไม่ใช้ Math.random) เพื่อให้ UI ทดสอบซ้ำได้ */
function generateFakeAuditLog(): AuditLogRow[] {
  const today = todayIso();
  const rows: AuditLogRow[] = [];
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(i / 2);
    const spec = FAKE_ACTIONS[i % FAKE_ACTIONS.length];
    const isSystem = spec.action === "NOTIFY_DAILY" || spec.action === "SETUP";
    const user = isSystem ? "" : FAKE_STAFF[i % FAKE_STAFF.length];
    const date = addDays(today, -daysAgo);
    rows.push({
      timestamp: `${date}T${String(8 + (i % 10)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00.000Z`,
      action: spec.action,
      detail: spec.detail,
      user,
      channel: user ? "WEB" : "SYSTEM",
    });
  }
  // เพิ่มรายการระบบ (NOTIFY_DAILY) ทุกวันย้อนหลัง 10 วัน
  for (let i = 0; i < 10; i++) {
    const date = addDays(today, -i);
    rows.push({
      timestamp: `${date}T07:00:00.000Z`,
      action: "NOTIFY_DAILY",
      detail: "ส่งสรุปประจำวัน (LINE=true Email=true)",
      user: "",
      channel: "SYSTEM",
    });
  }
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** สร้างประวัติการแจ้งเตือนจำลอง ~10 วันย้อนหลัง */
function generateFakeNotificationLog(): NotificationLogRow[] {
  const today = todayIso();
  const rows: NotificationLogRow[] = [];
  for (let i = 0; i < 10; i++) {
    const date = addDays(today, -i);
    rows.push({
      timestamp: `${date}T07:00:00.000Z`,
      channel: "LINE",
      recipient: "กลุ่มไลน์คลังเลือด",
      summary: "🩸 สรุปคลังเลือดประจำวัน...",
      success: i !== 3, // จำลองว่ามีวันหนึ่งส่งไม่สำเร็จ
    });
    rows.push({
      timestamp: `${date}T07:00:05.000Z`,
      channel: "EMAIL",
      recipient: "bloodbank@example.go.th",
      summary: "[Smart Fresh Blood] สรุปคลังเลือดประจำวัน",
      success: true,
    });
  }
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

const EXTRA_KEY = "sfb-mock-extra";

interface MockAppt {
  apptId: string;
  patientId: string;
  apptDate: string;
  unitsNeeded: number;
  status: ApptStatus;
}

interface MockExtra {
  patients: Patient[];
  appointments: MockAppt[];
  requests: BloodRequestDoc[];
  issueLog: IssueRecord[];
  destroyLog: DestroyLogRow[];
  config?: SystemConfig;
}

function loadExtra(): MockExtra {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(EXTRA_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as MockExtra;
      } catch {
        // ใช้ค่าเริ่มต้น
      }
    }
  }
  const today = todayIso();
  return {
    patients: [
      {
        patientId: "P0001",
        hn: "12345",
        name: "ด.ช. ตัวอย่าง ใจดี",
        bloodGroup: "O+",
        unitsPerVisit: 2,
        frequencyDays: 28,
        note: "",
        createdAt: new Date().toISOString(),
      },
    ],
    appointments: [
      { apptId: "AP0001", patientId: "P0001", apptDate: addDays(today, 5), unitsNeeded: 2, status: "PLANNED" },
    ],
    requests: [
      {
        requestId: "RQ_SEED1",
        requestNo: `SFB-${today.replace(/-/g, "")}-001`,
        requestDate: today,
        requestedTo: "ภาคบริการโลหิตแห่งชาติ",
        requestedBy: "เจ้าหน้าที่ตัวอย่าง",
        note: "",
        items: [
          { bloodGroup: "O+", component: "PRC", units: 10 },
          { bloodGroup: "B+", component: "PRC", units: 5 },
        ],
        status: "PARTIAL",
        createdAt: new Date().toISOString(),
        fulfilledUnits: 8,
      },
    ],
    issueLog: [],
    destroyLog: [],
  };
}
