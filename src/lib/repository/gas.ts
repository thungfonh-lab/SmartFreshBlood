import { gasRequest } from "../api";
import type {
  Appointment,
  ApptStatus,
  BloodGroup,
  BloodRequestDoc,
  BloodUnit,
  DashboardData,
  ExpiringData,
  HospitalConfig,
  IssueInput,
  IssueRecord,
  Patient,
  ReceiveInput,
  ReportData,
  ReportType,
  RequestItem,
} from "../types";
import type { BloodRepository } from "./types";

/** Repository ที่คุยกับ Google Apps Script Web App จริง */
export class GasRepository implements BloodRepository {
  constructor(private baseUrl: string) {}

  getDashboard(): Promise<DashboardData> {
    return gasRequest<DashboardData>(this.baseUrl, "dashboard");
  }

  getInventory(bloodGroup?: BloodGroup): Promise<BloodUnit[]> {
    return gasRequest<BloodUnit[]>(this.baseUrl, "inventory", {
      params: bloodGroup ? { bloodGroup } : {},
    });
  }

  receive(input: ReceiveInput): Promise<BloodUnit[]> {
    return gasRequest<BloodUnit[]>(this.baseUrl, "receive", { method: "POST", body: input });
  }

  issue(input: IssueInput): Promise<IssueRecord[]> {
    return gasRequest<IssueRecord[]>(this.baseUrl, "issue", { method: "POST", body: input });
  }

  getExpiring(): Promise<ExpiringData> {
    return gasRequest<ExpiringData>(this.baseUrl, "expiring");
  }

  destroy(unitIds: string[], reason: string, by: string): Promise<void> {
    return gasRequest<void>(this.baseUrl, "destroy", { method: "POST", body: { unitIds, reason, by } });
  }

  returnUnits(unitIds: string[], reason: string, by: string): Promise<void> {
    return gasRequest<void>(this.baseUrl, "return", { method: "POST", body: { unitIds, reason, by } });
  }

  getPatients(): Promise<Patient[]> {
    return gasRequest<Patient[]>(this.baseUrl, "patients");
  }

  savePatient(input: Partial<Patient>): Promise<Patient> {
    return gasRequest<Patient>(this.baseUrl, "patientSave", { method: "POST", body: input });
  }

  getAppointments(): Promise<Appointment[]> {
    return gasRequest<Appointment[]>(this.baseUrl, "appointments");
  }

  saveAppointment(input: { patientId: string; apptDate: string; unitsNeeded: number }): Promise<void> {
    return gasRequest<void>(this.baseUrl, "appointmentSave", { method: "POST", body: input });
  }

  setAppointmentStatus(apptId: string, status: ApptStatus): Promise<void> {
    return gasRequest<void>(this.baseUrl, "appointmentStatus", { method: "POST", body: { apptId, status } });
  }

  getRequests(): Promise<BloodRequestDoc[]> {
    return gasRequest<BloodRequestDoc[]>(this.baseUrl, "requests");
  }

  createRequest(input: { items: RequestItem[]; requestedTo: string; requestedBy: string; note: string }): Promise<BloodRequestDoc> {
    return gasRequest<BloodRequestDoc>(this.baseUrl, "requestCreate", { method: "POST", body: input });
  }

  getReport(type: ReportType, from?: string, to?: string): Promise<ReportData> {
    const params: Record<string, string> = { type };
    if (from) params.from = from;
    if (to) params.to = to;
    return gasRequest<ReportData>(this.baseUrl, "report", { params });
  }

  getConfig(): Promise<HospitalConfig> {
    return gasRequest<HospitalConfig>(this.baseUrl, "config");
  }
}
