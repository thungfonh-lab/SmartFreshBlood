import type {
  Appointment,
  ApptStatus,
  AuditLogParams,
  AuditLogResult,
  BloodGroup,
  BloodRequestDoc,
  BloodUnit,
  DashboardData,
  ExpiringData,
  HospitalConfig,
  IssueInput,
  IssueRecord,
  NotificationLogResult,
  Patient,
  ReceiveInput,
  ReportData,
  ReportType,
  RequestFulfillmentInput,
  RequestItem,
  SearchResult,
  StockSnapshotPoint,
  SystemConfig,
} from "../types";

/**
 * Repository interface — Frontend เรียกผ่าน interface นี้เท่านั้น
 * เปลี่ยน backend (GAS → Supabase/PostgreSQL) ได้โดยเพิ่ม implementation ใหม่
 */
export interface BloodRepository {
  getDashboard(): Promise<DashboardData>;
  getInventory(bloodGroup?: BloodGroup): Promise<BloodUnit[]>;
  receive(input: ReceiveInput): Promise<BloodUnit[]>;
  issue(input: IssueInput): Promise<IssueRecord[]>;
  getExpiring(): Promise<ExpiringData>;
  destroy(unitIds: string[], reason: string, by: string): Promise<void>;
  // Phase 2
  returnUnits(unitIds: string[], reason: string, by: string): Promise<void>;
  getPatients(): Promise<Patient[]>;
  savePatient(input: Partial<Patient>): Promise<Patient>;
  getAppointments(): Promise<Appointment[]>;
  saveAppointment(input: { patientId: string; apptDate: string; unitsNeeded: number }): Promise<void>;
  setAppointmentStatus(apptId: string, status: ApptStatus): Promise<void>;
  getRequests(): Promise<BloodRequestDoc[]>;
  createRequest(input: { items: RequestItem[]; requestedTo: string; requestedBy: string; note: string }): Promise<BloodRequestDoc>;
  getReport(type: ReportType, from?: string, to?: string): Promise<ReportData>;
  getConfig(): Promise<HospitalConfig>;
  search(q: string): Promise<SearchResult>;
  getAllConfig(): Promise<SystemConfig>;
  saveConfig(entries: SystemConfig, by: string): Promise<SystemConfig>;
  // Phase 3
  getAuditLog(params: AuditLogParams): Promise<AuditLogResult>;
  getNotificationLog(params: { from?: string; to?: string; page?: number; pageSize?: number }): Promise<NotificationLogResult>;
  getStockSnapshot(bloodGroup: BloodGroup, days?: number): Promise<StockSnapshotPoint[]>;
  updateRequestFulfillment(input: RequestFulfillmentInput): Promise<BloodRequestDoc>;
}
