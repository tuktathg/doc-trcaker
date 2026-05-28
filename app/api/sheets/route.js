// app/api/sheets/route.js — proxy ทั้ง GET และ POST ไปยัง Apps Script

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwnzjL-THNoOjL-K-0tjyRSGWjK65Ilyw8dt4cBZ5k9jzuDZMRgRwdue5jX9wk-xbkreA/exec";

// ── GET: ดึงข้อมูล ──────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sheet = searchParams.get("sheet") || "tracker";
  try {
    const upstream = await fetch(`${SCRIPT_URL}?sheet=${sheet}`, { cache: "no-store" });
    if (!upstream.ok) return Response.json({ error: `Apps Script ${upstream.status}` }, { status: 502 });
    const data = await upstream.json();
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: บันทึกสถานะ ───────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const upstream = await fetch(SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      cache:   "no-store",
    });
    if (!upstream.ok) return Response.json({ error: `Apps Script ${upstream.status}` }, { status: 502 });
    const data = await upstream.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
