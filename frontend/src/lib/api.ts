import type { ApiEnvelope } from "./types";

const RETRIES = 2;
const RETRY_DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * เรียก Google Apps Script Web App
 * - GET:  {url}?action=xxx&param=...
 * - POST: {url}?action=xxx โดย body เป็น JSON string ส่งแบบ text/plain
 *   (GAS ไม่รองรับ CORS preflight จึงห้ามใช้ Content-Type: application/json)
 * - Retry อัตโนมัติเมื่อเจอ 404/5xx หรือ network error ชั่วคราว
 *   (redirect ไป script.googleusercontent.com ของ GAS มีโอกาสล้มเหลวเป็นครั้งคราว)
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

  // POST ไม่ retry อัตโนมัติ — ถ้า request แรกสำเร็จแต่คำตอบหาย การส่งซ้ำจะบันทึกข้อมูลซ้ำ
  const maxRetries = options?.method === "POST" ? 0 : RETRIES;

  let lastError: Error = new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    try {
      const res = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        redirect: "follow", // GAS redirect ไป googleusercontent เสมอ
        ...(options?.method === "POST"
          ? { headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(options.body ?? {}) }
          : {}),
      });

      if (!res.ok) {
        // 404/5xx จาก redirect ของ GAS มักเป็นอาการชั่วคราว — GET จะลองใหม่อัตโนมัติ
        lastError = new Error(
          options?.method === "POST"
            ? `เซิร์ฟเวอร์ตอบผิดปกติ (${res.status}) — โปรดรีเฟรชตรวจสอบข้อมูลก่อนกดบันทึกซ้ำ`
            : `เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (${res.status})`
        );
        continue;
      }

      const envelope = (await res.json()) as ApiEnvelope<T>;
      if (!envelope.success) {
        // ข้อผิดพลาดจาก business logic — ไม่ต้อง retry
        throw new BusinessError(envelope.error ?? "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
      }
      return envelope.data as T;
    } catch (err) {
      if (err instanceof BusinessError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError;
}

class BusinessError extends Error {}
