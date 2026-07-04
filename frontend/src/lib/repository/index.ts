import { GasRepository } from "./gas";
import { MockRepository } from "./mock";
import type { BloodRepository } from "./types";

let instance: BloodRepository | null = null;

/**
 * ถ้าตั้ง NEXT_PUBLIC_GAS_URL → ใช้ Google Apps Script จริง
 * ถ้าไม่ตั้ง → ใช้ MockRepository (ข้อมูลตัวอย่าง เก็บใน localStorage)
 */
export function getRepository(): BloodRepository {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_GAS_URL;
    instance = url ? new GasRepository(url) : new MockRepository();
  }
  return instance;
}

export function isMockMode(): boolean {
  return !process.env.NEXT_PUBLIC_GAS_URL;
}
