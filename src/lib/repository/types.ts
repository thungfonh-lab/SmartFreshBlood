import type { BloodGroup, BloodUnit, DashboardData, ExpiringData, IssueInput, IssueRecord, ReceiveInput } from "../types";

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
}
