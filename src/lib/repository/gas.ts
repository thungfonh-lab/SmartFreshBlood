import { gasRequest } from "../api";
import type {
  BloodGroup,
  BloodUnit,
  DashboardData,
  ExpiringData,
  IssueInput,
  IssueRecord,
  ReceiveInput,
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
}
