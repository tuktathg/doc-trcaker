// app/api/sheets/route.js
// ทุก request เป็น GET หมด — หลีกเลี่ยงปัญหา POST redirect ของ Apps Script

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxsQNpiGKiJmVqOCbN0g5pNPuoq3m_M7aUtpG6LHu6QppzXktCHB_6oJiRSXeYFKXMJ/exec";

// ── GET: อ่านข้อมูล ─────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sheet  = searchParams.get("sheet")  || "tracker";
  const action = searchParams.get("action") || "read";

  // build upstream URL — ส่ง params ทั้งหมดที่ได้รับมาต่อไป
  const upstream_url = new URL(SCRIPT_URL);
  searchParams.forEach((v, k) => upstream_url.searchParams.set(k, v));

  try {
    const res = await fetch(upstream_url.toString(), {
      redirect: "follow",
      cache:    "no-store",
    });
    if (!res.ok) return Response.json({ error: `Apps Script ${res.status}` }, { status: 502 });
    const data = await res.json();
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
