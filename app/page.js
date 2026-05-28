"use client";
import { useState, useEffect, useCallback } from "react";
import {
  parsePeopleRows, parseDocsRows,
  getDocDefs, initDocState, calcProg, calcSt, todayStr,
} from "../lib/parsers";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F7F5F2", surface: "#FFFFFF", card: "#FFFFFF",
  border: "#E8E3DC", borderMd: "#D6CECC",
  accent: "#5C7A9F", accentLo: "#EDF1F7", accentMd: "#BFD0E5",
  green: "#4A8C6A",  greenLo: "#EBF5EF",  greenMd: "#B5D9C5",
  orange: "#C0773A", orangeLo: "#FBF3EB", orangeMd: "#F0C89A",
  red: "#B85C5C",    redLo: "#FAEAEA",
  yellow: "#9A8230", yellowLo: "#FBF7E8",
  purple: "#7B6FA0", purpleLo: "#F2F0F8", purpleMd: "#C9C2E0",
  text: "#2D2A26", textSoft: "#6B6460", muted: "#9E9790",
  shadow: "0 1px 3px rgba(0,0,0,0.07)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
};

const stMeta = (s) => ({
  complete:    { label: "HR รับครบ ✓",  color: C.green,  bg: C.greenLo,  border: C.greenMd  },
  gap:         { label: "รอ HR ยืนยัน", color: C.orange, bg: C.orangeLo, border: C.orangeMd },
  in_progress: { label: "กำลังส่ง",      color: C.accent, bg: C.accentLo, border: C.accentMd },
  pending:     { label: "ยังไม่ส่ง",     color: C.yellow, bg: C.yellowLo, border: "#D4C47A"  },
}[s] || { label: s, color: C.muted, bg: C.bg, border: C.border });

// ── Mini components ───────────────────────────────────────────────────────────
function Bar({ pct, color, h = 5 }) {
  return (
    <div style={{ height: h, background: C.border, borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width .6s ease" }} />
    </div>
  );
}

function Chk({ active, tint, tintBg, onCk, off }) {
  return (
    <div
      onClick={off ? null : onCk}
      style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        border: `1.5px solid ${active ? tint : off ? "#D6CECC" : C.borderMd}`,
        background: active ? tint : off ? "#F5F3F0" : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: off ? "default" : "pointer",
        transition: "all .15s",
        boxShadow: active ? `0 0 0 3px ${tintBg}` : "none",
      }}
    >
      {active && (
        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
          <path d="M1.5 5L5 8.5L11.5 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── PersonCard ────────────────────────────────────────────────────────────────
function PersonCard({ person, selected, onClick, dynDefs }) {
  const defs = getDocDefs(person.position, dynDefs);
  const prog = calcProg(defs, person.docState);
  const sm   = stMeta(calcSt(defs, person.docState));
  return (
    <div
      onClick={() => onClick(person)}
      style={{
        background: selected ? "#EDF3FA" : C.card,
        border: `1.5px solid ${selected ? C.accent : C.border}`,
        borderRadius: 12, padding: "13px 15px", cursor: "pointer",
        transition: "all .18s", marginBottom: 8,
        boxShadow: selected ? `0 0 0 3px ${C.accentLo}` : C.shadow,
        animation: "fadeIn .2s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{person.name}</div>
          <div style={{ color: C.muted, fontSize: 11 }}>{person.position} · {person.area.split("_")[0]}</div>
        </div>
        <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
          {sm.label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {[
          { l: `ส่ง ${prog.sent}/${prog.total}`, p: prog.sp, c: C.accent },
          { l: `รับ ${prog.recv}/${prog.total}`, p: prog.rp, c: C.green  },
        ].map((b) => (
          <div key={b.l} style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginBottom: 3 }}>
              <span>{b.l}</span><span style={{ color: b.c, fontWeight: 600 }}>{b.p}%</span>
            </div>
            <Bar pct={b.p} color={b.c} />
          </div>
        ))}
      </div>
      {(person.deadlineDate || person.hr) && (
        <div style={{ fontSize: 10, color: C.muted }}>
          {person.deadlineDate && <span>กำหนด <b style={{ color: C.textSoft }}>{person.deadlineDate}</b></span>}
          {person.hr && <span style={{ marginLeft: 8 }}>HR <b style={{ color: C.textSoft }}>{person.hr}</b></span>}
        </div>
      )}
    </div>
  );
}

// ── CheckRow ──────────────────────────────────────────────────────────────────
function CheckRow({ docDef, state, role, onToggleField, onToggleHR, onTracking, onNote }) {
  const [openT, setOpenT] = useState(false);
  const [tv, setTv]       = useState(state.trackingNo || "");
  const [openN, setOpenN] = useState(false);
  const [nv, setNv]       = useState(state.note || "");

  const gap     = state.fieldSent && !state.hrReceived;
  const rowBg   = state.hrReceived ? C.greenLo  : gap ? C.orangeLo : "white";
  const rowBord = state.hrReceived ? C.greenMd  : gap ? C.orangeMd : C.border;

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${rowBord}`, background: rowBg, marginBottom: 6, overflow: "hidden", transition: "all .2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px" }}>
        {/* Label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ color: state.hrReceived ? C.green : C.text, fontSize: 12.5, fontWeight: 500, textDecoration: state.hrReceived ? "line-through" : "none", opacity: state.hrReceived ? 0.7 : 1 }}>
              {docDef.label}
            </span>
            {!docDef.required && <span style={{ color: C.muted, fontSize: 9, background: "#F0EDE8", borderRadius: 4, padding: "1px 5px" }}>ไม่บังคับ</span>}
            {gap && <span style={{ color: C.orange, fontSize: 9, fontWeight: 700, background: C.orangeLo, borderRadius: 4, padding: "1px 6px", border: `1px solid ${C.orangeMd}` }}>⚠ รอ HR</span>}
            {state.trackingNo && <span style={{ color: C.purple, fontSize: 9, background: C.purpleLo, borderRadius: 4, padding: "1px 6px", border: `1px solid ${C.purpleMd}` }}>📦 {state.trackingNo}</span>}
          </div>
          <div style={{ color: C.muted, fontSize: 9.5, marginTop: 2 }}>
            {state.fieldSentAt && <span>📤 {state.fieldSentAt}</span>}
            {state.hrReceivedAt && <span style={{ color: C.green }}> · ✅ {state.hrReceivedAt}</span>}
            {state.note && <span style={{ color: C.accent }}> · 💬 {state.note}</span>}
          </div>
        </div>

        {/* Field */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52 }}>
          <span style={{ fontSize: 8.5, color: C.muted, fontWeight: 500 }}>🚗 ภาคสนาม</span>
          <Chk active={state.fieldSent} tint={C.accent} tintBg={C.accentLo} onCk={onToggleField} off={role !== "field"} />
          <span style={{ fontSize: 8.5, color: state.fieldSent ? C.accent : C.muted, fontWeight: state.fieldSent ? 600 : 400 }}>
            {state.fieldSent ? "ส่งแล้ว" : "ยังไม่ส่ง"}
          </span>
        </div>

        <span style={{ color: C.borderMd, fontSize: 16 }}>›</span>

        {/* HR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52 }}>
          <span style={{ fontSize: 8.5, color: C.muted, fontWeight: 500 }}>🏢 HR รับ</span>
          <Chk active={state.hrReceived} tint={C.green} tintBg={C.greenLo} onCk={onToggleHR} off={role !== "hr" || !state.fieldSent} />
          <span style={{ fontSize: 8.5, color: state.hrReceived ? C.green : state.fieldSent ? C.orange : C.muted, fontWeight: state.hrReceived || state.fieldSent ? 600 : 400 }}>
            {state.hrReceived ? "รับแล้ว" : state.fieldSent ? "รอรับ" : "รอส่ง"}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 4 }}>
          {role === "field" && (
            <button onClick={() => setOpenT((v) => !v)} title="กรอกเลขเทรคกิ้ง"
              style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${state.trackingNo ? C.purpleMd : C.border}`, background: state.trackingNo ? C.purpleLo : "white", color: state.trackingNo ? C.purple : C.muted, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              📦
            </button>
          )}
          <button onClick={() => setOpenN((v) => !v)} title="หมายเหตุ"
            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${state.note ? C.accentMd : C.border}`, background: state.note ? C.accentLo : "white", color: state.note ? C.accent : C.muted, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            📝
          </button>
        </div>
      </div>

      {openT && role === "field" && (
        <div style={{ padding: "0 13px 11px", display: "flex", gap: 8 }}>
          <input value={tv} onChange={(e) => setTv(e.target.value)} placeholder="เลขเทรคกิ้ง เช่น TH12345678"
            style={{ flex: 1, background: "white", border: `1.5px solid ${C.accentMd}`, borderRadius: 8, padding: "7px 11px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <button onClick={() => { onTracking(tv); setOpenT(false); }}
            style={{ background: C.purple, border: "none", borderRadius: 8, color: "white", padding: "7px 14px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>บันทึก</button>
        </div>
      )}
      {openN && (
        <div style={{ padding: "0 13px 11px", display: "flex", gap: 8 }}>
          <input value={nv} onChange={(e) => setNv(e.target.value)} placeholder="หมายเหตุ..."
            style={{ flex: 1, background: "white", border: `1.5px solid ${C.accentMd}`, borderRadius: 8, padding: "7px 11px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <button onClick={() => { onNote(nv); setOpenN(false); }}
            style={{ background: C.accent, border: "none", borderRadius: 8, color: "white", padding: "7px 14px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>บันทึก</button>
        </div>
      )}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────
function DetailPanel({ person, role, onUpdate, dynDefs }) {
  const defs       = getDocDefs(person.position, dynDefs);
  const prog       = calcProg(defs, person.docState);
  const sm         = stMeta(calcSt(defs, person.docState));
  const notSent    = defs.filter((d) => d.required && !person.docState[d.id]?.fieldSent).length;
  const sentNotRcv = defs.filter((d) => d.required && person.docState[d.id]?.fieldSent && !person.docState[d.id]?.hrReceived).length;
  const missTrk    = defs.filter((d) => person.docState[d.id]?.fieldSent && !person.docState[d.id]?.trackingNo).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: C.shadowMd, animation: "fadeIn .25s ease" }}>
      {/* Header */}
      <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${C.border}`, background: "white" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 3, fontWeight: 500 }}>{person.position} · {person.area.replace(/_/g, " ")}</div>
            <div style={{ color: C.text, fontSize: 20, fontWeight: 800, letterSpacing: -0.3, marginBottom: 3 }}>{person.name}</div>
            <div style={{ color: C.textSoft, fontSize: 12 }}>
              {person.head && `หัวหน้า: ${person.head}`}
              {person.head && person.hr && " · "}
              {person.hr && `HR: ${person.hr}`}
            </div>
          </div>
          <span style={{ padding: "5px 13px", borderRadius: 20, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {sm.label}
          </span>
        </div>

        {/* Dual progress */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {[
            { l: "🚗 ภาคสนามส่ง", v: `${prog.sent}/${prog.total}`, p: prog.sp, c: C.accent, bg: C.accentLo },
            { l: "🏢 HR รับแล้ว",  v: `${prog.recv}/${prog.total}`, p: prog.rp, c: C.green,  bg: C.greenLo  },
          ].map((b) => (
            <div key={b.l} style={{ flex: 1, background: b.bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ fontSize: 11.5, color: C.textSoft, fontWeight: 500 }}>{b.l}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: b.c }}>{b.v}</span>
              </div>
              <Bar pct={b.p} color={b.c} h={6} />
            </div>
          ))}
        </div>

        {/* Chips */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {notSent > 0    && <span style={{ padding: "4px 11px", borderRadius: 8, background: C.redLo,    border: "1px solid #E0AAAA",       color: C.red,    fontSize: 11, fontWeight: 600 }}>⚠ ยังไม่ส่ง {notSent} รายการ</span>}
          {sentNotRcv > 0 && <span style={{ padding: "4px 11px", borderRadius: 8, background: C.orangeLo, border: `1px solid ${C.orangeMd}`, color: C.orange, fontSize: 11, fontWeight: 600 }}>📬 รอ HR ยืนยัน {sentNotRcv} รายการ</span>}
          {role === "field" && missTrk > 0 && <span style={{ padding: "4px 11px", borderRadius: 8, background: C.purpleLo, border: `1px solid ${C.purpleMd}`, color: C.purple, fontSize: 11, fontWeight: 600 }}>📦 ยังไม่กรอกเทรคกิ้ง {missTrk} รายการ</span>}
          {notSent === 0 && sentNotRcv === 0 && <span style={{ padding: "4px 11px", borderRadius: 8, background: C.greenLo, border: `1px solid ${C.greenMd}`, color: C.green, fontSize: 11, fontWeight: 600 }}>✅ เอกสารครบทุกรายการ</span>}
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: "8px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 14, fontSize: 10.5, color: C.muted, background: "#FAFAF8", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: C.accent, fontWeight: 500 }}>■ ภาคสนามส่ง</span>
        <span style={{ color: C.green,  fontWeight: 500 }}>■ HR รับแล้ว</span>
        <span style={{ color: C.orange, fontWeight: 500 }}>■ รอ HR ยืนยัน</span>
        <span style={{ color: C.purple, fontWeight: 500 }}>📦 เทรคกิ้ง</span>
        <span style={{ marginLeft: "auto", color: C.muted }}>
          {role === "field" ? "คลิก ☐ ซ้ายบันทึกส่ง · 📦 ใส่เลขส่ง" : "คลิก ☐ ขวาเพื่อยืนยันรับ"}
        </span>
      </div>

      {/* Checklist */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px", background: C.bg }}>
        {defs.map((doc) => (
          <CheckRow
            key={doc.id} docDef={doc} state={person.docState[doc.id] || {}} role={role}
            onToggleField={() => onUpdate(person.name, doc.id, "field")}
            onToggleHR={()    => onUpdate(person.name, doc.id, "hr")}
            onTracking={(v)   => onUpdate(person.name, doc.id, "tracking", v)}
            onNote={(v)       => onUpdate(person.name, doc.id, "note", v)}
          />
        ))}
      </div>

      {/* Footer */}
      {(person.reportDate || person.deadlineDate) && (
        <div style={{ padding: "10px 22px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 20, fontSize: 11, color: C.muted, background: "white" }}>
          {person.reportDate   && <span>📅 รายงานตัว <b style={{ color: C.textSoft }}>{person.reportDate}</b></span>}
          {person.deadlineDate && <span>⏰ กำหนดครบ <b style={{ color: C.textSoft }}>{person.deadlineDate}</b></span>}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [role,       setRole]       = useState("hr");
  const [people,     setPeople]     = useState([]);
  const [dynDefs,    setDynDefs]    = useState({});
  const [selected,   setSelected]   = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [loadState,  setLoadState]  = useState("idle"); // idle | loading | ok | error
  const [loadMsg,    setLoadMsg]    = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);

  const fetchData = useCallback(async () => {
    setLoadState("loading");
    setLoadMsg("กำลังดึงข้อมูลจาก Google Sheets...");
    try {
      // calls our own Next.js API route → no CORS
      const [r1, r2] = await Promise.all([
        fetch("/api/sheets?sheet=tracker"),
        fetch("/api/sheets?sheet=docs"),
      ]);
      if (!r1.ok) throw new Error(`server returned ${r1.status}`);
      const j1 = await r1.json();
      const j2 = r2.ok ? await r2.json() : { rows: [] };

      if (j1.error) throw new Error(j1.error);

      const importedDefs = parseDocsRows(j2.rows || []);
      const raw          = parsePeopleRows(j1.rows || []);
      if (!raw.length) throw new Error("ไม่พบข้อมูลรายชื่อใน Sheet");

      const withState = raw.map((p) => {
        const d = getDocDefs(p.position, importedDefs);
        return { ...p, docState: initDocState(d) };
      });

      setDynDefs(importedDefs);
      setPeople(withState);
      setSelected((prev) => withState.find((p) => p.name === prev?.name) || withState[0] || null);
      setLoadState("ok");
      setLastLoaded(new Date());
      setLoadMsg(`โหลดสำเร็จ ${withState.length} คน`);
    } catch (e) {
      setLoadState("error");
      setLoadMsg("เชื่อมไม่ได้: " + e.message);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selected) {
      const up = people.find((p) => p.name === selected.name);
      if (up) setSelected(up);
    }
  }, [people]);

  function handleDocUpdate(name, docId, action, value) {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.name !== name) return p;
        const d = { ...p.docState[docId] };
        if      (action === "field")    { d.fieldSent = !d.fieldSent; d.fieldSentAt = d.fieldSent ? todayStr() : null; if (!d.fieldSent) { d.hrReceived = false; d.hrReceivedAt = null; } }
        else if (action === "hr")       { d.hrReceived = !d.hrReceived; d.hrReceivedAt = d.hrReceived ? todayStr() : null; }
        else if (action === "tracking") { d.trackingNo = value; }
        else if (action === "note")     { d.note = value; }
        return { ...p, docState: { ...p.docState, [docId]: d } };
      })
    );
  }

  const withSt   = people.map((p) => ({ ...p, _st: calcSt(getDocDefs(p.position, dynDefs), p.docState) }));
  const filtered = withSt.filter((p) => {
    const mf = filter === "all" || p._st === filter;
    const ms = [p.name, p.area, p.position, p.hr].some((v) => v.includes(search));
    return mf && ms;
  });
  const stats = {
    total:    people.length,
    complete: withSt.filter((p) => p._st === "complete").length,
    gap:      withSt.filter((p) => p._st === "gap").length,
    progress: withSt.filter((p) => p._st === "in_progress").length,
    pending:  withSt.filter((p) => p._st === "pending").length,
  };

  const dotColor = { ok: C.green, error: C.red, loading: C.yellow, idle: C.muted }[loadState];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* NAV */}
      <nav style={{ height: 56, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${C.accent},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 2px 6px rgba(92,122,159,0.3)" }}>📂</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3, color: C.text }}>DocTrack HR</div>
            <div style={{ fontSize: 9.5, color: dotColor, display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
              {loadState === "ok"      ? `เชื่อม Sheets · ${lastLoaded?.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` :
               loadState === "loading" ? "กำลังโหลด..." :
               loadState === "error"   ? "เชื่อมไม่ได้" : "พร้อมใช้งาน"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={fetchData} disabled={loadState === "loading"}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "white", color: C.textSoft, fontSize: 12, cursor: loadState === "loading" ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 500, boxShadow: C.shadow, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", animation: loadState === "loading" ? "spin 0.8s linear infinite" : "none" }}>
              {loadState === "loading" ? "⏳" : "🔄"}
            </span>
            รีเฟรช
          </button>

          <div style={{ display: "flex", background: C.bg, borderRadius: 9, padding: 3, border: `1px solid ${C.border}` }}>
            {[{ id: "hr", label: "🏢 HR" }, { id: "field", label: "🚗 ภาคสนาม" }].map((r) => (
              <button key={r.id} onClick={() => setRole(r.id)}
                style={{ padding: "5px 15px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit", background: role === r.id ? C.accent : "transparent", color: role === r.id ? "white" : C.textSoft, fontWeight: role === r.id ? 700 : 400, fontSize: 12.5, transition: "all .18s", boxShadow: role === r.id ? "0 1px 4px rgba(92,122,159,0.3)" : "none" }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Status bar */}
      {loadMsg && (
        <div style={{ padding: "7px 20px", background: loadState === "ok" ? C.greenLo : loadState === "error" ? C.redLo : "#FEF9E7", borderBottom: `1px solid ${loadState === "ok" ? C.greenMd : loadState === "error" ? "#E0AAAA" : "#F0D77A"}`, fontSize: 12, color: loadState === "ok" ? C.green : loadState === "error" ? C.red : C.yellow, display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 500 }}>
          <span>{loadState === "ok" ? "✅" : loadState === "error" ? "⚠" : "⏳"} {loadMsg}</span>
          <button onClick={() => setLoadMsg("")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Loading spinner */}
      {loadState === "loading" && people.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: C.muted, fontSize: 13 }}>กำลังดึงข้อมูลจาก Google Sheets...</span>
        </div>
      )}

      {/* Error state */}
      {loadState === "error" && people.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", flexDirection: "column", gap: 14, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <div style={{ color: C.text, fontSize: 17, fontWeight: 700 }}>โหลดข้อมูลไม่สำเร็จ</div>
          <div style={{ color: C.muted, fontSize: 13, maxWidth: 360, lineHeight: 1.7 }}>{loadMsg.replace("เชื่อมไม่ได้: ", "")}</div>
          <button onClick={fetchData} style={{ padding: "10px 24px", background: C.accent, border: "none", borderRadius: 9, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ลองใหม่</button>
        </div>
      )}

      {/* STATS */}
      {people.length > 0 && (
        <div style={{ padding: "10px 20px", display: "flex", gap: 8, background: "white", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { label: "ทั้งหมด",    v: stats.total,    color: C.accent, f: "all"         },
            { label: "HR รับครบ",  v: stats.complete, color: C.green,  f: "complete"    },
            { label: "รอ HR",      v: stats.gap,      color: C.orange, f: "gap"         },
            { label: "กำลังส่ง",   v: stats.progress, color: C.accent, f: "in_progress" },
            { label: "ยังไม่ส่ง",  v: stats.pending,  color: C.yellow, f: "pending"     },
          ].map((s) => (
            <button key={s.f} onClick={() => setFilter((f) => f === s.f ? "all" : s.f)}
              style={{ padding: "6px 13px", borderRadius: 9, cursor: "pointer", transition: "all .18s", fontFamily: "inherit", background: filter === s.f ? s.color : "white", border: `1.5px solid ${filter === s.f ? s.color : C.border}`, display: "flex", alignItems: "center", gap: 6, boxShadow: filter === s.f ? "0 2px 6px rgba(0,0,0,0.1)" : C.shadow }}>
              <span style={{ color: filter === s.f ? "white" : s.color, fontWeight: 800, fontSize: 15 }}>{s.v}</span>
              <span style={{ color: filter === s.f ? "rgba(255,255,255,0.85)" : C.textSoft, fontSize: 11 }}>{s.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "6px 13px" }}>
            <span style={{ color: C.muted }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ พื้นที่ ตำแหน่ง..."
              style={{ background: "none", border: "none", outline: "none", color: C.text, fontSize: 12.5, width: 170, fontFamily: "inherit" }} />
          </div>
        </div>
      )}

      {/* MAIN */}
      {people.length > 0 && (
        <div style={{ display: "flex", height: "calc(100vh - 120px)" }}>
          <div style={{ width: 320, borderRight: `1px solid ${C.border}`, overflowY: "auto", padding: "14px 12px", background: C.bg }}>
            {filtered.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40, fontSize: 13 }}>ไม่พบข้อมูล</div>}
            {filtered.map((p) => (
              <PersonCard key={p.name} person={p} selected={selected?.name === p.name} onClick={setSelected} dynDefs={dynDefs} />
            ))}
          </div>
          <div style={{ flex: 1, padding: 16, overflowY: "auto", background: C.bg }}>
            {selected
              ? <DetailPanel person={people.find((p) => p.name === selected.name) || selected} role={role} onUpdate={handleDocUpdate} dynDefs={dynDefs} />
              : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>← เลือกพนักงานเพื่อดูรายละเอียด</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}
