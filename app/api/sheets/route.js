// app/api/sheets/route.js
// รัน server-side → ไม่ติด CORS เลย

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzNF8owXXQxtrplNf8GdszoHNuoEbbvApYD4XPOYgrea9VuaVdl5ZDjmcc-3d4NAUHziA/exec";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sheet = searchParams.get("sheet") || "tracker";

  try {
    const upstream = await fetch(`${SCRIPT_URL}?sheet=${sheet}`, {
      // force no cache so we always get fresh data
      cache: "no-store",
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `Apps Script returned ${upstream.status}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();

    return Response.json(data, {
      headers: {
        // allow the browser (same origin) to read this
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
