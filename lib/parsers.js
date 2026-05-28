// lib/parsers.js

// แปลงวันที่ทุกรูปแบบให้เป็น DD/MM/YYYY (พ.ศ.) ไม่มีเวลา
// รองรับ: "2026-05-24T17:00:00.000Z", "2026-05-24", "25/5/2026", "25/5/2569", ""
function cleanDate(raw) {
  if (!raw) return "";
  const s = raw.toString().trim();
  if (!s) return "";

  // ISO format: 2026-05-24 หรือ 2026-05-24T...
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const buddhistYear = parseInt(yyyy) + 543;
    return `${dd}/${mm}/${buddhistYear}`;
  }

  // DD/MM/YYYY หรือ D/M/YYYY (ค.ศ. หรือ พ.ศ. ก็รับ)
  const thaiMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (thaiMatch) {
    const [, dd, mm, yyyy] = thaiMatch;
    // ถ้าปีน้อยกว่า 2500 ถือว่าเป็น ค.ศ. แล้วแปลงเป็น พ.ศ.
    const year = parseInt(yyyy) < 2500 ? parseInt(yyyy) + 543 : parseInt(yyyy);
    return `${dd.padStart(2,"0")}/${mm.padStart(2,"0")}/${year}`;
  }

  // ถ้าไม่ match รูปแบบไหนเลย ส่งคืนดิบ (อาจเป็นข้อความ เช่น "ไม่ระบุ")
  return s;
}

export function parsePeopleRows(rows) {
  return rows
    .filter((r) => r[0]?.toString().trim())
    .map((r) => ({
      name:         r[0]?.toString().trim() || "",
      area:         r[1]?.toString().trim() || "",
      position:     r[2]?.toString().trim() || "สาวบาวแดง",
      head:         r[3]?.toString().trim() || "",
      hr:           r[4]?.toString().trim() || "",
      reportDate:   cleanDate(r[5]),
      deadlineDate: cleanDate(r[6]),
    }))
    .filter((p) => p.name);
}

export function parseDocsRows(rows) {
  if (!rows || rows.length < 3) return {};
  const positions = rows[1].slice(1).map((p) => p?.toString().trim()).filter(Boolean);
  const docRows   = rows.slice(2);
  const defs = {};
  positions.forEach((pos, pi) => {
    defs[pos] = docRows
      .filter((r) => r[0]?.toString().trim())
      .map((r, i) => ({
        id:       `doc_${i}`,
        label:    r[0].toString().trim(),
        required: r[pi + 1]?.toString().trim() === "จำเป็น",
      }));
  });
  return defs;
}

export const DEFAULT_DOCS = {
  สาวบาวแดง: [
    { id: "d0",  label: "ประกันสังคม",                 required: true  },
    { id: "d1",  label: "ประกันเมืองไทย",              required: true  },
    { id: "d2",  label: "ประกันทิพย์",                 required: true  },
    { id: "d3",  label: "กองทุนสำรองเลี้ยงชีพ",        required: true  },
    { id: "d4",  label: "ใบสมัคร",                     required: true  },
    { id: "d5",  label: "PDPA",                        required: true  },
    { id: "d6",  label: "บัตรประชาชน",                 required: true  },
    { id: "d7",  label: "ทะเบียนบ้าน",                 required: true  },
    { id: "d8",  label: "วุฒิการศึกษา",                required: true  },
    { id: "d9",  label: "ใบเกณฑ์ทหาร",                required: false },
    { id: "d10", label: "บัญชีกสิกรไทย",              required: true  },
    { id: "d11", label: "ใบซบซิ (อายุมากกว่า 1 ปี)",  required: false },
    { id: "d12", label: "ตรวจสารเสพติด",               required: true  },
    { id: "d13", label: "ตรวจตั้งครรภ์",               required: true  },
    { id: "d14", label: "สัญญาจ้าง",                   required: true  },
  ],
  ผู้ช่วยทีม: [
    { id: "d0",  label: "ประกันสังคม",                 required: true  },
    { id: "d1",  label: "ประกันเมืองไทย",              required: true  },
    { id: "d2",  label: "ประกันทิพย์",                 required: true  },
    { id: "d3",  label: "กองทุนสำรองเลี้ยงชีพ",        required: true  },
    { id: "d4",  label: "ใบสมัคร",                     required: true  },
    { id: "d5",  label: "PDPA",                        required: true  },
    { id: "d6",  label: "บัตรประชาชน",                 required: true  },
    { id: "d7",  label: "ทะเบียนบ้าน",                 required: true  },
    { id: "d8",  label: "วุฒิการศึกษา",                required: true  },
    { id: "d9",  label: "ใบเกณฑ์ทหาร",                required: false },
    { id: "d10", label: "บัญชีกสิกรไทย",              required: true  },
    { id: "d11", label: "ใบซบซิ (อายุมากกว่า 1 ปี)",  required: false },
    { id: "d12", label: "ตรวจสารเสพติด",               required: true  },
    { id: "d13", label: "ตรวจตั้งครรภ์",               required: false },
    { id: "d14", label: "สัญญาจ้าง",                   required: true  },
  ],
  "มั้วเร็ว": [
    { id: "d0",  label: "ประกันสังคม",                 required: true  },
    { id: "d1",  label: "ประกันเมืองไทย",              required: true  },
    { id: "d2",  label: "ประกันทิพย์",                 required: true  },
    { id: "d3",  label: "กองทุนสำรองเลี้ยงชีพ",        required: true  },
    { id: "d4",  label: "ใบสมัคร",                     required: true  },
    { id: "d5",  label: "PDPA",                        required: true  },
    { id: "d6",  label: "บัตรประชาชน",                 required: true  },
    { id: "d7",  label: "ทะเบียนบ้าน",                 required: true  },
    { id: "d8",  label: "วุฒิการศึกษา",                required: true  },
    { id: "d9",  label: "ใบเกณฑ์ทหาร",                required: true  },
    { id: "d10", label: "บัญชีกสิกรไทย",              required: true  },
    { id: "d11", label: "ใบซบซิ (อายุมากกว่า 1 ปี)",  required: false },
    { id: "d12", label: "ตรวจสารเสพติด",               required: true  },
    { id: "d13", label: "ตรวจตั้งครรภ์",               required: true  },
    { id: "d14", label: "สัญญาจ้าง",                   required: true  },
  ],
};

export function getDocDefs(pos, dyn) {
  if (dyn && Object.keys(dyn).length) {
    const key = Object.keys(dyn).find((k) => k.trim() === pos.trim());
    if (key) return dyn[key];
  }
  return DEFAULT_DOCS[pos] || DEFAULT_DOCS["สาวบาวแดง"];
}

export function initDocState(defs) {
  const s = {};
  defs.forEach((d) => {
    s[d.id] = { fieldSent: false, fieldSentAt: null, hrReceived: false, hrReceivedAt: null, trackingNo: "", note: "" };
  });
  return s;
}

export function calcProg(defs, state) {
  const req  = defs.filter((d) => d.required);
  const sent = req.filter((d) => state[d.id]?.fieldSent).length;
  const recv = req.filter((d) => state[d.id]?.hrReceived).length;
  const n    = req.length || 1;
  return { sent, recv, total: req.length, sp: Math.round((sent / n) * 100), rp: Math.round((recv / n) * 100) };
}

export function calcSt(defs, state) {
  const req = defs.filter((d) => d.required);
  if (!req.length) return "pending";
  if (req.every((d) => state[d.id]?.hrReceived))                              return "complete";
  if (req.some((d) => state[d.id]?.fieldSent && !state[d.id]?.hrReceived))   return "gap";
  if (req.some((d) => state[d.id]?.fieldSent))                               return "in_progress";
  return "pending";
}

export function todayStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear() + 543; // พ.ศ.
  return `${dd}/${mm}/${yy}`;
}
