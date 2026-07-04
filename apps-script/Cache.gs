/**
 * Server-side cache (CacheService) — ลดการอ่าน Google Sheets ซ้ำ
 *
 * หลักการ: ทุกการเขียนจะ bump "data version" — cache key ผูกกับ version
 * ทำให้ข้อมูลเก่าหมดสภาพทันทีหลังมีการบันทึก โดยไม่ต้องไล่ลบทีละ key
 */

var CACHE_TTL_SECONDS = 120;

function getDataVersion() {
  return CacheService.getScriptCache().get("sfb:v") || "0";
}

function bumpDataVersion() {
  CacheService.getScriptCache().put("sfb:v", String(Date.now()), 21600);
}

/** คืนค่าจาก cache ถ้ามี ไม่งั้นคำนวณใหม่แล้วเก็บ */
function cachedJson(key, fn) {
  var cache = CacheService.getScriptCache();
  var fullKey = "sfb:" + key + ":" + getDataVersion();
  var hit = cache.get(fullKey);
  if (hit) {
    try {
      return JSON.parse(hit);
    } catch (ignored) {}
  }
  var value = fn();
  try {
    cache.put(fullKey, JSON.stringify(value), CACHE_TTL_SECONDS);
  } catch (ignored) {
    // ค่าเกิน 100KB — ข้าม cache ได้
  }
  return value;
}
