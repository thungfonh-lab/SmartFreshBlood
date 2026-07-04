/**
 * Client-side cache — เก็บผลลัพธ์ GET ไว้ในหน่วยความจำ + sessionStorage
 * เปิดหน้าซ้ำภายใน TTL แสดงผลทันทีโดยไม่ต้องรอ API
 */

const PREFIX = "sfb-cache:";
const memory = new Map<string, { t: number; d: unknown }>();

function fromSession(key: string): { t: number; d: unknown } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { t: number; d: unknown };
  } catch {
    return null;
  }
}

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = memory.get(key) ?? fromSession(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.d as T;

  const data = await fetcher();
  const entry = { t: Date.now(), d: data };
  memory.set(key, entry);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // sessionStorage เต็ม — ข้ามได้
    }
  }
  return data;
}

/** ล้าง cache ตาม prefix — เรียกหลังบันทึกข้อมูลเพื่อให้เห็นข้อมูลใหม่ทันที */
export function invalidate(...prefixes: string[]) {
  for (const key of [...memory.keys()]) {
    if (prefixes.some((p) => key.startsWith(p))) memory.delete(key);
  }
  if (typeof window !== "undefined") {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(PREFIX) && prefixes.some((p) => k.slice(PREFIX.length).startsWith(p))) {
        window.sessionStorage.removeItem(k);
      }
    }
  }
}
