# คู่มือติดตั้ง Smart Fresh Blood

## ภาพรวม

ระบบมี 2 ส่วน:

1. **Frontend** — Next.js (โฟลเดอร์ `frontend/`) รันในเครื่องหรือ deploy ขึ้น Vercel
2. **Backend** — Google Apps Script + Google Sheets (โฟลเดอร์ `apps-script/`)

ถ้ายังไม่ตั้งค่า backend ระบบจะรันด้วย **ข้อมูลตัวอย่าง (Mock)** อัตโนมัติ — เปิดใช้งานได้ทันที

---

## ส่วนที่ 1: ติดตั้ง Backend (Google Sheets + Apps Script)

### 1.1 สร้าง Google Sheet

1. เข้า [sheets.new](https://sheets.new) สร้างสเปรดชีตใหม่ ตั้งชื่อ เช่น `SmartFreshBlood-DB`

### 1.2 วางโค้ด Apps Script

1. ในสเปรดชีต ไปที่เมนู **ส่วนขยาย (Extensions) → Apps Script**
2. ลบโค้ดเดิมใน `Code.gs` แล้วสร้างไฟล์ตามนี้ (ปุ่ม **+** → Script) และคัดลอกเนื้อหาจากโฟลเดอร์ `apps-script/` ของโปรเจกต์นี้:
   - `Code.gs`
   - `Repository.gs`
   - `FreshScore.gs`
   - `Services.gs`
   - `Setup.gs`
3. ไปที่ **การตั้งค่าโปรเจกต์ (Project Settings)** → เปิด "Show appsscript.json" แล้ววางเนื้อหาจาก `apps-script/appsscript.json` (ตั้ง timezone เป็น Asia/Bangkok)
4. กด **บันทึก** (ไอคอนแผ่นดิสก์)

### 1.3 สร้างโครงสร้างชีท

1. ที่แถบด้านบนของ editor เลือกฟังก์ชัน **`setupSheets`** แล้วกด **Run**
2. ครั้งแรกจะขอสิทธิ์ → กด **Review permissions** → เลือกบัญชี → **Allow**
3. กลับไปดูสเปรดชีต จะเห็นชีท `BloodUnits`, `IssueLog`, `AuditLog`, `Config` พร้อม header

### 1.4 Deploy เป็น Web App

1. กด **Deploy → New deployment**
2. เลือกประเภท **Web app**
3. ตั้งค่า:
   - **Execute as**: `Me` (บัญชีของคุณ)
   - **Who has access**: `Anyone`
4. กด **Deploy** แล้วคัดลอก **Web app URL** (ลงท้าย `/exec`)

> ⚠️ ทุกครั้งที่แก้โค้ด ต้อง Deploy ใหม่แบบ **Manage deployments → Edit → Version: New version** URL เดิมจึงจะได้โค้ดใหม่

### 1.5 ทดสอบ API

เปิด URL นี้ในเบราว์เซอร์:

```
{Web app URL}?action=dashboard
```

ควรได้ JSON เช่น `{"success":true,"data":{...}}`

---

## ส่วนที่ 2: ตั้งค่า Frontend

### 2.1 เชื่อมต่อกับ backend

สร้างไฟล์ `frontend/.env.local`:

```
NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/XXXXX/exec
```

(ถ้าไม่สร้างไฟล์นี้ = โหมดข้อมูลตัวอย่าง)

### 2.2 รันในเครื่อง

```bash
cd frontend
npm install
npm run dev
```

เปิด http://localhost:3000

### 2.3 Deploy ขึ้น Vercel (แนะนำ)

```bash
cd frontend
npx vercel
```

แล้วตั้ง Environment Variable `NEXT_PUBLIC_GAS_URL` ใน Vercel dashboard → Redeploy

---

## การอัปเดตเป็น Phase 2 (สำหรับระบบที่ติดตั้ง Phase 1 แล้ว)

1. เปิด Apps Script editor เดิม แล้ว **แทนที่เนื้อหา** ไฟล์เดิมทั้งหมดด้วยเวอร์ชันใหม่จาก `apps-script/`:
   `Code.gs`, `Repository.gs`, `FreshScore.gs`, `Services.gs`, `Setup.gs`
2. **สร้างไฟล์ใหม่ 4 ไฟล์** แล้วคัดลอกเนื้อหา: `Thalassemia.gs`, `Requests.gs`, `Reports.gs`, `Notify.gs`
3. รัน **`setupSheets`** อีกครั้ง (เพิ่มชีทใหม่: `Patients`, `Appointments`, `Requests`, `DestroyLog` และค่า Config ใหม่ — ข้อมูลเดิมไม่หาย)
4. **Deploy เวอร์ชันใหม่**: Deploy → Manage deployments → ✏️ Edit → Version: **New version** → Deploy
   (URL เดิมคงอยู่ ไม่ต้องแก้ฝั่ง frontend)
5. (ทางเลือก) เปิดแจ้งเตือนอัตโนมัติ: กรอก `lineChannelToken`, `lineTargetId`, `notifyEmail` ในชีท `Config` แล้วรันฟังก์ชัน **`setupNotificationTriggers`** หนึ่งครั้ง → ระบบส่งสรุปคลังเลือดทุกวัน 07:00 น.
6. ตั้งชื่อหน่วยงานบนหัวเอกสาร: แก้ค่า `hospitalName` และ `hospitalAddress` ในชีท `Config`

## โครงสร้างข้อมูลใน Google Sheets

| ชีท | เก็บอะไร |
|---|---|
| `BloodUnits` | เลือดรายถุง: unitId, กรุ๊ป, ปริมาณ, วันเจาะ, วันหมดอายุ, สถานะ (AVAILABLE/ISSUED/EXPIRED/DESTROYED/RETURNED) |
| `IssueLog` | ประวัติการจ่ายเลือดทุกครั้ง |
| `AuditLog` | บันทึกทุกการกระทำ (รับ/จ่าย/ทำลาย/error) |
| `Patients` | ทะเบียนผู้ป่วยธาลัสซีเมีย (HN, ชื่อ, กรุ๊ป, ถุง/ครั้ง, ความถี่) |
| `Appointments` | วันนัดรับเลือด + สถานะ (PLANNED/COMPLETED/CANCELLED) |
| `Requests` | ใบขอเลือด (เลขที่เอกสาร, รายการ, ผู้ขอ) |
| `DestroyLog` | ทะเบียนทำลาย/คืนเลือดรายถุง พร้อมเหตุผลและผู้ดำเนินการ |
| `Config` | ค่าตั้ง: `shelfLifeDays` (35), `criticalThreshold` (3), `freshThreshold` (70), `hospitalName`, `hospitalAddress`, `lineChannelToken`, `lineTargetId`, `notifyEmail` |

## API Reference

| action | method | ตัวอย่าง |
|---|---|---|
| `dashboard` | GET | `?action=dashboard` |
| `inventory` | GET | `?action=inventory&bloodGroup=O%2B` |
| `expiring` | GET | `?action=expiring` |
| `receive` | POST | body: `{bloodGroup, component, volumeCc, collectDate, unitIds[], receivedBy}` |
| `issue` | POST | body: `{bloodGroup, unitCount, issueType, issuedTo, issuedBy}` |
| `destroy` | POST | body: `{unitIds[], reason, by}` |

หมายเหตุ: POST ต้องส่ง body เป็น JSON string ด้วย `Content-Type: text/plain` (ข้อจำกัด CORS ของ Apps Script) — โค้ดใน `frontend/src/lib/api.ts` จัดการให้แล้ว

## แผนอนาคต

- โมดูลเฟสถัดไป: Thalassemia Planning, Blood Request, Notification (LINE OA/Email), Reports, Destroy & Return เต็มรูปแบบ
- ย้าย database: เขียน Repository ใหม่ (เช่น `SupabaseRepository`) ที่ implement interface ใน `frontend/src/lib/repository/types.ts` โดยไม่ต้องแก้หน้า UI
