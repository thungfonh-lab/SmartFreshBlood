import { addDays, daysUntilExpiry, freshScore, toIsoDate } from "../freshScore";
import type {
  Appointment,
  ApptStatus,
  BloodGroup,
  BloodRequestDoc,
  BloodUnit,
  DashboardData,
  DestroyLogRow,
  ExpiringData,
  GroupSummary,
  HospitalConfig,
  IssueInput,
  IssueRecord,
  Patient,
  ReceiveInput,
  ReportData,
  ReportType,
  RequestItem,
  SearchResult,
  SystemConfig,
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
    };
    this.extra().requests.push(doc);
    this.persistExtra();
    return doc;
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
    return { type, from, to, generatedAt, rows: this.extra().destroyLog.filter((r) => inRange(r.at)) };
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
    requests: [],
    issueLog: [],
    destroyLog: [],
  };
}
