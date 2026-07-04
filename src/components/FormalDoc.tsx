"use client";

/**
 * องค์ประกอบเอกสารทางการ: หัวเอกสาร ตาราง ช่องลงนาม และปุ่มพิมพ์
 * ใช้ฟอนต์ Sarabun (--font-document) ตามแบบเอกสารราชการ
 */

export function formatThaiFullDate(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatThaiDateTime(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) +
    " เวลา " +
    d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) +
    " น."
  );
}

export function DocHeader({
  hospitalName,
  hospitalAddress,
  title,
  docNo,
  docDate,
}: {
  hospitalName: string;
  hospitalAddress?: string;
  title: string;
  docNo?: string;
  docDate: string;
}) {
  return (
    <header className="mb-5 text-center">
      <p className="text-lg font-bold">{hospitalName || "(ยังไม่ได้ตั้งชื่อหน่วยงาน — กำหนดที่ชีท Config: hospitalName)"}</p>
      {hospitalAddress && <p className="text-sm">{hospitalAddress}</p>}
      <p className="mt-3 text-base font-bold underline underline-offset-4">{title}</p>
      <div className="mt-3 flex justify-between text-sm">
        <span>{docNo ? `เลขที่เอกสาร ${docNo}` : ""}</span>
        <span>วันที่ {formatThaiFullDate(docDate)}</span>
      </div>
    </header>
  );
}

export function DocTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} className="border border-black bg-slate-100 px-2 py-1.5 text-center font-semibold print:bg-transparent">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="border border-black px-2 py-4 text-center">
              — ไม่มีข้อมูลในช่วงที่เลือก —
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={`border border-black px-2 py-1 ${j === 0 ? "text-center" : typeof cell === "number" ? "text-right" : ""}`}>
                  {typeof cell === "number" ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function SignatureBlock({ roles }: { roles: string[] }) {
  return (
    <div className="mt-10 flex flex-wrap justify-around gap-8 break-inside-avoid">
      {roles.map((role) => (
        <div key={role} className="text-center text-sm">
          <p className="mb-8">ลงชื่อ ...........................................................</p>
          <p>( ........................................................... )</p>
          <p className="mt-1">{role}</p>
          <p className="mt-1">วันที่ ............ / ............ / ............</p>
        </div>
      ))}
    </div>
  );
}

export function DocFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <p className="mt-8 text-right text-xs text-slate-500 print:text-black">
      เอกสารออกโดยระบบ Smart Fresh Blood · พิมพ์เมื่อ {formatThaiDateTime(generatedAt)}
    </p>
  );
}

export function PrintButton({ label = "พิมพ์ / บันทึกเป็น PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print w-full rounded-2xl bg-slate-800 py-3 text-base font-bold text-white shadow-sm"
    >
      🖨️ {label}
    </button>
  );
}
