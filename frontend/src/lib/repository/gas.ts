import { gasRequest } from "../api";
import { cached, invalidate } from "../cache";
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
import type { BloodRepository } from "./types";

const TTL = 45_000; // ข้อมูลคลังเลือด
const TTL_CONFIG = 10 * 60_000; // ค่าตั้งหน่วยงาน (แทบไม่เปลี่ยน)

// ล้าง cache กลุ่มข้อมูลคลังเมื่อมีการรับ/จ่าย/ทำลาย/คืน
const STOCK_KEYS = ["dashboard", "inventory", "expiring", "appointments", "report"];

/** Repository ที่คุยกับ Google Apps Script Web App จริง */
export class GasRepository implements BloodRepository {
  constructor(private baseUrl: string) {}

  getDashboard(): Promise<DashboardData> {
    return cached("dashboard", TTL, () => gasRequest<DashboardData>(this.baseUrl, "dashboard"));
  }

  getInventory(bloodGroup?: BloodGroup): Promise<BloodUnit[]> {
    return cached(`inventory:${bloodGroup ?? "ALL"}`, TTL, () =>
      gasRequest<BloodUnit[]>(this.baseUrl, "inventory", { params: bloodGroup ? { bloodGroup } : {} })
    );
  }

  async receive(input: ReceiveInput): Promise<BloodUnit[]> {
    const result = await gasRequest<BloodUnit[]>(this.baseUrl, "receive", { method: "POST", body: input });
    invalidate(...STOCK_KEYS);
    return result;
  }

  async issue(input: IssueInput): Promise<IssueRecord[]> {
    const result = await gasRequest<IssueRecord[]>(this.baseUrl, "issue", { method: "POST", body: input });
    invalidate(...STOCK_KEYS);
    return result;
  }

  getExpiring(): Promise<ExpiringData> {
    return cached("expiring", TTL, () => gasRequest<ExpiringData>(this.baseUrl, "expiring"));
  }

  async destroy(unitIds: string[], reason: string, by: string): Promise<void> {
    await gasRequest<void>(this.baseUrl, "destroy", { method: "POST", body: { unitIds, reason, by } });
    invalidate(...STOCK_KEYS);
  }

  async returnUnits(unitIds: string[], reason: string, by: string): Promise<void> {
    await gasRequest<void>(this.baseUrl, "return", { method: "POST", body: { unitIds, reason, by } });
    invalidate(...STOCK_KEYS);
  }

  getPatients(): Promise<Patient[]> {
    return cached("patients", TTL, () => gasRequest<Patient[]>(this.baseUrl, "patients"));
  }

  async savePatient(input: Partial<Patient>): Promise<Patient> {
    const result = await gasRequest<Patient>(this.baseUrl, "patientSave", { method: "POST", body: input });
    invalidate("patients", "appointments");
    return result;
  }

  getAppointments(): Promise<Appointment[]> {
    return cached("appointments", TTL, () => gasRequest<Appointment[]>(this.baseUrl, "appointments"));
  }

  async saveAppointment(input: { patientId: string; apptDate: string; unitsNeeded: number }): Promise<void> {
    await gasRequest<void>(this.baseUrl, "appointmentSave", { method: "POST", body: input });
    invalidate("appointments");
  }

  async setAppointmentStatus(apptId: string, status: ApptStatus): Promise<void> {
    await gasRequest<void>(this.baseUrl, "appointmentStatus", { method: "POST", body: { apptId, status } });
    invalidate("appointments");
  }

  getRequests(): Promise<BloodRequestDoc[]> {
    return cached("requests", TTL, () => gasRequest<BloodRequestDoc[]>(this.baseUrl, "requests"));
  }

  async createRequest(input: { items: RequestItem[]; requestedTo: string; requestedBy: string; note: string }): Promise<BloodRequestDoc> {
    const result = await gasRequest<BloodRequestDoc>(this.baseUrl, "requestCreate", { method: "POST", body: input });
    invalidate("requests");
    return result;
  }

  getReport(type: ReportType, from?: string, to?: string): Promise<ReportData> {
    const params: Record<string, string> = { type };
    if (from) params.from = from;
    if (to) params.to = to;
    return cached(`report:${type}:${from ?? ""}:${to ?? ""}`, TTL, () =>
      gasRequest<ReportData>(this.baseUrl, "report", { params })
    );
  }

  getConfig(): Promise<HospitalConfig> {
    return cached("config", TTL_CONFIG, () => gasRequest<HospitalConfig>(this.baseUrl, "config"));
  }

  search(q: string): Promise<SearchResult> {
    return cached(`search:${q}`, TTL, () => gasRequest<SearchResult>(this.baseUrl, "search", { params: { q } }));
  }

  getAllConfig(): Promise<SystemConfig> {
    // ไม่ cache — หน้าตั้งค่าต้องเห็นค่าปัจจุบันเสมอ
    return gasRequest<SystemConfig>(this.baseUrl, "configAll");
  }

  async saveConfig(entries: SystemConfig, by: string): Promise<SystemConfig> {
    const result = await gasRequest<SystemConfig>(this.baseUrl, "configSave", { method: "POST", body: { entries, by } });
    invalidate("config", "dashboard", "appointments"); // เกณฑ์ต่างๆ กระทบการคำนวณ
    return result;
  }

  getAuditLog(params: AuditLogParams): Promise<AuditLogResult> {
    // ไม่ cache — หน้า filter สดต้องเห็นข้อมูลล่าสุดเสมอ
    return gasRequest<AuditLogResult>(this.baseUrl, "auditLog", {
      params: {
        from: params.from ?? "",
        to: params.to ?? "",
        user: params.user ?? "",
        channel: params.channel ?? "",
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 50),
      },
    });
  }

  getNotificationLog(params: { from?: string; to?: string; page?: number; pageSize?: number }): Promise<NotificationLogResult> {
    return gasRequest<NotificationLogResult>(this.baseUrl, "notificationLog", {
      params: {
        from: params.from ?? "",
        to: params.to ?? "",
        page: String(params.page ?? 1),
        pageSize: String(params.pageSize ?? 50),
      },
    });
  }

  getStockSnapshot(bloodGroup: BloodGroup, days = 7): Promise<StockSnapshotPoint[]> {
    return cached(`stockSnapshot:${bloodGroup}:${days}`, TTL, () =>
      gasRequest<StockSnapshotPoint[]>(this.baseUrl, "stockSnapshot", { params: { bloodGroup, days: String(days) } })
    );
  }

  async updateRequestFulfillment(input: RequestFulfillmentInput): Promise<BloodRequestDoc> {
    const result = await gasRequest<BloodRequestDoc>(this.baseUrl, "requestFulfill", { method: "POST", body: input });
    invalidate("requests", "report");
    return result;
  }
}
