export const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type UnitStatus = "AVAILABLE" | "ISSUED" | "EXPIRED" | "DESTROYED";

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
