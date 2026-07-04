import type { ApiEnvelope } from "./types";

/**
 * เรียก Google Apps Script Web App
 * - GET:  {url}?action=xxx&param=...
 * - POST: {url}?action=xxx โดย body เป็น JSON string ส่งแบบ text/plain
 *   (GAS ไม่รองรับ CORS preflight จึงห้ามใช้ Content-Type: application/json)
 */
export async function gasRequest<T>(
  baseUrl: string,
  action: string,
  options?: { method?: "GET" | "POST"; params?: Record<string, string>; body?: unknown }
): Promise<T> {
  const url = new URL(baseUrl);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(options?.params ?? {})) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    redirect: "follow", // GAS redirect ไป googleusercontent เสมอ
    ...(options?.method === "POST"
      ? { headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(options.body ?? {}) }
      : {}),
  });

  if (!res.ok) throw new Error(`เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (${res.status})`);
  const envelope = (await res.json()) as ApiEnvelope<T>;
  if (!envelope.success) throw new Error(envelope.error ?? "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  return envelope.data as T;
}
