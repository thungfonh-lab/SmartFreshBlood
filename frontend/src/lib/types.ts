export const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type UnitStatus = "AVAILABLE" | "ISSUED" | "EXPIRED" | "DESTROYED" | "RETURNED";

export type IssueType = "GENERAL" | "THALASSEMIA";

export interface BloodUnit {
  unitId: string;
  bloodGroup: BloodGroup;
  component: string; // e.g. "PRC"
  volumeCc: number;
  collectDate: string; // ISO date (YYYY-MM-DD)
  expiryDate: string; // ISO date (YYYY-MM-DD)
  status: UnitStatus;
  receivedAt: string; // ISO datetime
  receivedBy: string;
}

export interface ReceiveInput {
  bloodGroup: BloodGroup;
  component: string;
  volumeCc: number;
  collectDate: string;
  bagCount: number;
  unitIds: string[]; // ความยาวเท่ากับ bagCount
  receivedBy: string;
}

export interface IssueInput {
  bloodGroup: BloodGroup;
  unitCount: number;
  issueType: IssueType;
  issuedTo: string;
  issuedBy: string;
  manualUnitIds?: string[]; // ถ้าผู้ใช้เลือกถุงเอง
}

export interface IssueRecord {
  issueId: string;
  unitId: string;
  bloodGroup: BloodGroup;
  volumeCc: number;
  issueType: IssueType;
  issuedTo: string;
  issuedAt: string;
  issuedBy: string;
}

export interface GroupSummary {
  bloodGroup: BloodGroup;
  units: number;
  volumeCc: number;
  avgFreshScore: number;
  nearExpiry: number; // หมดอายุใน 7 วัน
}

export interface DashboardData {
  totalUnits: number;
  totalVolumeCc: number;
  avgFreshScore: number;
  expiringToday: number;
  expiring3Days: number;
  expiring7Days: number;
  criticalGroups: BloodGroup[]; // stock ต่ำกว่าเกณฑ์
  groups: GroupSummary[];
}

export interface ExpiringData {
  today: BloodUnit[];
  in3Days: BloodUnit[];
  in7Days: BloodUnit[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------- Phase 2 ----------

export interface Patient {
  patientId: string;
  hn: string;
  name: string;
  bloodGroup: BloodGroup;
  unitsPerVisit: number;
  frequencyDays: number;
  note: string;
  createdAt: string;
}

export type ApptStatus = "PLANNED" | "COMPLETED" | "CANCELLED";
export type RiskLevel = "READY" | "RISK" | "CRITICAL";

export interface Appointment {
  apptId: string;
  patientId: string;
  patientName: string;
  hn: string;
  bloodGroup: BloodGroup | "";
  apptDate: string;
  unitsNeeded: number;
  status: ApptStatus;
  freshAvailable: number;
  totalAvailable: number;
  readiness: number; // 0–100
  riskLevel: RiskLevel;
}

export interface RequestItem {
  bloodGroup: BloodGroup;
  component: string;
  units: number;
}

export interface BloodRequestDoc {
  requestId: string;
  requestNo: string;
  requestDate: string;
  requestedTo: string;
  requestedBy: string;
  note: string;
  items: RequestItem[];
  status: string;
  createdAt: string;
}

export interface HospitalConfig {
  hospitalName: string;
  hospitalAddress: string;
}

export type ReportType = "stock" | "receive" | "issue" | "destroy";

export interface DestroyLogRow {
  logId: string;
  unitId: string;
  bloodGroup: BloodGroup;
  volumeCc: number;
  action: "DESTROY" | "RETURN";
  reason: string;
  at: string;
  by: string;
}

export interface SearchUnit extends BloodUnit {
  issuedTo?: string;
  issuedAt?: string;
}

export interface SearchResult {
  units: SearchUnit[];
  patients: Patient[];
}

/** ค่าตั้งระบบทั้งหมด (key → value) — ค่าลับถูก mask จากเซิร์ฟเวอร์ */
export type SystemConfig = Record<string, string>;

export interface ReportData {
  type: ReportType;
  from?: string;
  to?: string;
  generatedAt: string;
  dashboard?: DashboardData; // type=stock
  rows?: BloodUnit[] | IssueRecord[] | DestroyLogRow[]; // type=receive|issue|destroy
}
