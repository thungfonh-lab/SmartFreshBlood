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

export type RequestStatus = "PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED";

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
  fulfilledUnits: number;
}

export interface HospitalConfig {
  hospitalName: string;
  hospitalAddress: string;
}

export type ReportType = "stock" | "receive" | "issue" | "destroy" | "movement" | "freshscore" | "executive";

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

export interface MonthlyRollup {
  month: string; // yyyy-MM
  received: number;
  issued: number;
  destroyed: number;
  wastagePct: number;
}

export interface MovementKpi {
  received: number;
  issued: number;
  expired: number;
  remaining: number;
}

export interface FreshScoreHistogramBucket {
  bucket: string;
  count: number;
}

export interface FreshScoreByGroup {
  bloodGroup: BloodGroup;
  avgScore: number;
}

export interface ExecutiveKpi {
  totalStock: number;
  utilizationRate: number;
  wastageRate: number;
  fulfillmentRate: number;
}

export interface TrendPoint {
  month: string;
  value: number;
}

export interface ExecutiveComparisonRow {
  metric: string;
  thisMonth: number;
  lastMonth: number;
  delta: number;
  status: "ดีขึ้น" | "ต้องแก้ไข";
}

export interface ReportData {
  type: ReportType;
  from?: string;
  to?: string;
  generatedAt: string;
  dashboard?: DashboardData; // type=stock
  rows?: BloodUnit[] | IssueRecord[] | DestroyLogRow[]; // type=receive|issue|destroy
  // type=movement
  movementKpi?: MovementKpi;
  monthly?: MonthlyRollup[];
  transactions?: IssueRecord[];
  // type=freshscore
  avgCurrentStock?: number;
  avgAtIssueTime?: number;
  histogram?: FreshScoreHistogramBucket[];
  byGroup?: FreshScoreByGroup[];
  // type=executive
  execKpi?: ExecutiveKpi;
  trend?: { utilization: TrendPoint[]; wastage: TrendPoint[] };
  comparison?: ExecutiveComparisonRow[];
}

// ---------- Phase 3 ----------

export type AuditChannel = "WEB" | "SYSTEM";

export interface AuditLogRow {
  timestamp: string;
  action: string;
  detail: string;
  user: string;
  channel: AuditChannel;
}

export interface AuditLogResult {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  users: string[];
}

export interface AuditLogParams {
  from?: string;
  to?: string;
  user?: string;
  channel?: AuditChannel;
  page?: number;
  pageSize?: number;
}

export type NotificationChannel = "LINE" | "EMAIL";

export interface NotificationLogRow {
  timestamp: string;
  channel: NotificationChannel;
  recipient: string;
  summary: string;
  success: boolean;
}

export interface NotificationLogResult {
  rows: NotificationLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StockSnapshotPoint {
  date: string;
  unitCount: number;
  totalVolumeCc: number;
  avgFreshScore: number;
}

export interface RequestFulfillmentInput {
  requestId: string;
  fulfilledUnits: number;
  status?: RequestStatus;
  by: string;
}
