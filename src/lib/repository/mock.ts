import { addDays, daysUntilExpiry, freshScore, toIsoDate } from "../freshScore";
import type {
  BloodGroup,
  BloodUnit,
  DashboardData,
  ExpiringData,
  GroupSummary,
  IssueInput,
  IssueRecord,
  ReceiveInput,
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

  async destroy(unitIds: string[]): Promise<void> {
    for (const u of this.all()) {
      if (unitIds.includes(u.unitId) && u.status === "AVAILABLE") u.status = "DESTROYED";
    }
    this.persist();
  }
}
