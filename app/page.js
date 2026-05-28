"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  parsePeopleRows, parseDocsRows,
  getDocDefs, initDocState, calcProg, calcSt, todayStr,
} from "../lib/parsers";

// ── Design tokens — Forest Green ─────────────────────────────────────────────
const C = {
  // backgrounds
  bg:        "#F0F7F2",
  surface:   "#FFFFFF",
  card:      "#FFFFFF",
  cardAlt:   "#F5FAF6",

  // borders
  border:    "#C8E0CE",
  borderMd:  "#A8CDB3",

  // primary green
  primary:   "#2D7A4F",
  primaryDk: "#1F5C3A",
  primaryLt: "#E6F4EC",
  primaryMd: "#A8D5B5",

  // accent teal
  teal:      "#1A8A7A",
  tealLt:    "#E3F4F2",
  tealMd:    "#8ECFC8",

  // semantic
  orange:    "#C06B2A",
  orangeLt:  "#FDF0E6",
  orangeMd:  "#F0BF90",
  red:       "#B84040",
  redLt:     "#FAEAEA",
  yellow:    "#8A7020",
  yellowLt:  "#FBF7E4",
  purple:    "#5A4E8A",
  purpleLt:  "#F0EEF9",
  purpleMd:  "#B8B0D8",

  // text
  text:      "#1A2E1F",
  textSoft:  "#4A6650",
  muted:     "#7A9882",

  // tracking highlight
  trackBg:   "#FFFBE6",
  trackBorder:"#D4A017",
  trackText: "#7A5C00",

  shadow:    "0 1px 4px rgba(30,80,40,0.08)",
  shadowMd:  "0 4px 16px rgba(30,80,40,0.10)",
  shadowLg:  "0 8px 32px rgba(30,80,40,0.13)",
};

const stMeta = s => ({
  complete:    { label:"HR รับครบ ✓",  color:C.primary, bg:C.primaryLt, border:C.primaryMd },
  gap:         { label:"รอ HR ยืนยัน", color:C.orange,  bg:C.orangeLt,  border:C.orangeMd  },
  in_progress: { label:"กำลังส่ง",      color:C.teal,    bg:C.tealLt,    border:C.tealMd    },
  pending:     { label:"ยังไม่ส่ง",     color:C.yellow,  bg:C.yellowLt,  border:"#C8B060"   },
}[s] || { label:s, color:C.muted, bg:C.bg, border:C.border });

// ── Helpers ───────────────────────────────────────────────────────────────────
function Bar({ pct, color, h=6 }) {
  return (
    <div style={{ height:h, background:C.border, borderRadius:99, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width .6s ease" }} />
    </div>
  );
}

function Chk({ active, tint, tintLt, onCk, off, size=28 }) {
  return (
    <div onClick={off ? null : onCk} style={{
      width:size, height:size, borderRadius:8, flexShrink:0,
      border:`2px solid ${active ? tint : off ? C.border : C.borderMd}`,
      background: active ? tint : off ? "#F2F7F3" : "white",
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor: off ? "default" : "pointer",
      transition:"all .18s",
      boxShadow: active ? `0 0 0 4px ${tintLt}` : "none",
    }}>
      {active && (
        <svg width={size*.5} height={size*.45} viewBox="0 0 14 11" fill="none">
          <path d="M1.5 5.5L5.5 9.5L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ── Tracking Input — prominent, mobile-friendly ────────────────────────────
function TrackingInput({ value, onSave, onClose }) {
  const [v, setV] = useState(value || "");
  const inputRef  = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  return (
    <div style={{
      margin:"4px 0 8px",
      background:C.trackBg,
      border:`2px solid ${C.trackBorder}`,
      borderRadius:12, padding:"12px 14px",
      animation:"popIn .18s ease",
      boxShadow:"0 2px 12px rgba(212,160,23,.18)",
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.trackText, marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ fontSize:15 }}>📦</span> กรอกเลขพัสดุ / เทรคกิ้ง
      </div>
      <input
        ref={inputRef}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if(e.key==="Enter") { onSave(v); onClose(); } if(e.key==="Escape") onClose(); }}
        placeholder="เช่น TH12345678901, EMS001234"
        style={{
          width:"100%", padding:"12px 14px",
          fontSize:15, fontWeight:600, letterSpacing:.5,
          background:"white",
          border:`2.5px solid ${C.trackBorder}`,
          borderRadius:9, outline:"none", color:C.trackText,
          boxShadow:"inset 0 1px 4px rgba(212,160,23,.10)",
          marginBottom:10,
        }}
      />
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => { onSave(v); onClose(); }} style={{
          flex:1, padding:"11px", borderRadius:9, border:"none",
          background:C.primary, color:"white", fontSize:14, fontWeight:700, cursor:"pointer",
          boxShadow:`0 2px 6px rgba(45,122,79,.3)`,
          minHeight:44,
        }}>✓ บันทึก</button>
        <button onClick={onClose} style={{
          padding:"11px 16px", borderRadius:9, border:`1.5px solid ${C.border}`,
          background:"white", color:C.muted, fontSize:14, cursor:"pointer", minHeight:44,
        }}>ยกเลิก</button>
      </div>
    </div>
  );
}

// ── NoteInput ─────────────────────────────────────────────────────────────────
function NoteInput({ value, onSave, onClose }) {
  const [v, setV] = useState(value || "");
  const inputRef  = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  return (
    <div style={{ margin:"4px 0 8px", background:C.primaryLt, border:`1.5px solid ${C.primaryMd}`, borderRadius:12, padding:"12px 14px", animation:"popIn .18s ease" }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.primary, marginBottom:8 }}>📝 หมายเหตุ</div>
      <input
        ref={inputRef}
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if(e.key==="Enter") { onSave(v); onClose(); } if(e.key==="Escape") onClose(); }}
        placeholder="พิมพ์หมายเหตุ..."
        style={{
          width:"100%", padding:"11px 13px", fontSize:14,
          background:"white", border:`1.5px solid ${C.primaryMd}`, borderRadius:8,
          outline:"none", color:C.text, marginBottom:10,
        }}
      />
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => { onSave(v); onClose(); }} style={{
          flex:1, padding:"11px", borderRadius:9, border:"none",
          background:C.primary, color:"white", fontSize:13, fontWeight:700, cursor:"pointer", minHeight:44,
        }}>✓ บันทึก</button>
        <button onClick={onClose} style={{
          padding:"11px 16px", borderRadius:9, border:`1.5px solid ${C.border}`,
          background:"white", color:C.muted, fontSize:13, cursor:"pointer", minHeight:44,
        }}>ยกเลิก</button>
      </div>
    </div>
  );
}

// ── CheckRow — mobile-first ───────────────────────────────────────────────────
function CheckRow({ docDef, state, role, onToggleField, onToggleHR, onTracking, onNote }) {
  const [showT, setShowT] = useState(false);
  const [showN, setShowN] = useState(false);

  const gap     = state.fieldSent && !state.hrReceived;
  const done    = !!state.hrReceived;
  const rowBg   = done ? C.primaryLt : gap ? C.orangeLt : "white";
  const rowBord = done ? C.primaryMd : gap ? C.orangeMd : C.border;

  return (
    <div style={{
      borderRadius:12, border:`1.5px solid ${rowBord}`, background:rowBg,
      marginBottom:8, overflow:"hidden", transition:"all .2s",
      boxShadow: done ? "none" : C.shadow,
    }}>
      {/* Main row */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px" }}>

        {/* Doc label */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
            <span style={{
              fontSize:14, fontWeight:600,
              color: done ? C.primary : C.text,
              textDecoration: done ? "line-through" : "none",
              opacity: done ? .65 : 1,
            }}>{docDef.label}</span>
            {!docDef.required && (
              <span style={{ fontSize:9, color:C.muted, background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:4, padding:"1px 5px" }}>ไม่บังคับ</span>
            )}
          </div>
          {/* Sub-info */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
            {gap && <span style={{ fontSize:10, fontWeight:700, color:C.orange, background:C.orangeLt, borderRadius:5, padding:"1px 7px", border:`1px solid ${C.orangeMd}` }}>⚠ รอ HR</span>}
            {state.trackingNo && (
              <span style={{ fontSize:10, fontWeight:700, color:C.trackText, background:C.trackBg, borderRadius:5, padding:"2px 8px", border:`1.5px solid ${C.trackBorder}` }}>
                📦 {state.trackingNo}
              </span>
            )}
            {state.note && <span style={{ fontSize:10, color:C.teal }}>💬 {state.note}</span>}
            {state.fieldSentAt && <span style={{ fontSize:10, color:C.muted }}>📤 {state.fieldSentAt}</span>}
            {state.hrReceivedAt && <span style={{ fontSize:10, color:C.primary, fontWeight:600 }}>✅ {state.hrReceivedAt}</span>}
          </div>
        </div>

        {/* Checkboxes */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <span style={{ fontSize:9, color:C.muted, fontWeight:600, whiteSpace:"nowrap" }}>🚗 ส่ง</span>
          <Chk active={state.fieldSent} tint={C.teal} tintLt={C.tealLt} onCk={onToggleField} off={role!=="field"} />
        </div>

        <span style={{ color:C.borderMd, fontSize:18, fontWeight:300, lineHeight:1 }}>›</span>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <span style={{ fontSize:9, color:C.muted, fontWeight:600, whiteSpace:"nowrap" }}>🏢 รับ</span>
          <Chk active={state.hrReceived} tint={C.primary} tintLt={C.primaryLt} onCk={onToggleHR} off={role!=="hr"||!state.fieldSent} />
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {role==="field" && (
            <button onClick={() => { setShowT(v=>!v); setShowN(false); }} style={{
              width:36, height:36, borderRadius:8,
              border:`1.5px solid ${state.trackingNo ? C.trackBorder : C.border}`,
              background: state.trackingNo ? C.trackBg : "white",
              color: state.trackingNo ? C.trackText : C.muted,
              fontSize:16, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: state.trackingNo ? `0 0 0 2px ${C.trackBorder}44` : "none",
            }}>📦</button>
          )}
          <button onClick={() => { setShowN(v=>!v); setShowT(false); }} style={{
            width:36, height:36, borderRadius:8,
            border:`1.5px solid ${state.note ? C.primaryMd : C.border}`,
            background: state.note ? C.primaryLt : "white",
            color: state.note ? C.primary : C.muted,
            fontSize:16, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>📝</button>
        </div>
      </div>

      {/* Tracking input */}
      {showT && role==="field" && (
        <div style={{ padding:"0 14px 14px" }}>
          <TrackingInput value={state.trackingNo} onSave={v=>onTracking(v)} onClose={()=>setShowT(false)} />
        </div>
      )}
      {/* Note input */}
      {showN && (
        <div style={{ padding:"0 14px 14px" }}>
          <NoteInput value={state.note} onSave={v=>onNote(v)} onClose={()=>setShowN(false)} />
        </div>
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
    <div onClick={() => onClick(person)} style={{
      background: selected ? C.primaryLt : C.card,
      border:`2px solid ${selected ? C.primary : C.border}`,
      borderRadius:14, padding:"14px 15px", cursor:"pointer",
      transition:"all .18s", marginBottom:10,
      boxShadow: selected ? `0 0 0 3px ${C.primaryMd}55` : C.shadow,
      animation:"fadeUp .2s ease",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ flex:1, minWidth:0, marginRight:8 }}>
          <div style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:2 }}>{person.name}</div>
          <div style={{ color:C.muted, fontSize:12 }}>{person.position} · {person.area.split("_")[0]}</div>
        </div>
        <span style={{
          padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap",
          background:sm.bg, color:sm.color, border:`1.5px solid ${sm.border}`,
        }}>{sm.label}</span>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:7 }}>
        {[
          { l:`ส่ง ${prog.sent}/${prog.total}`, p:prog.sp, c:C.teal    },
          { l:`รับ ${prog.recv}/${prog.total}`, p:prog.rp, c:C.primary },
        ].map(b => (
          <div key={b.l} style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:4 }}>
              <span>{b.l}</span><span style={{ color:b.c, fontWeight:700 }}>{b.p}%</span>
            </div>
            <Bar pct={b.p} color={b.c} />
          </div>
        ))}
      </div>
      {(person.deadlineDate || person.hr) && (
        <div style={{ fontSize:11, color:C.muted }}>
          {person.deadlineDate && <span>กำหนด <b style={{ color:C.textSoft }}>{person.deadlineDate}</b></span>}
          {person.hr && <span style={{ marginLeft:10 }}>HR <b style={{ color:C.textSoft }}>{person.hr}</b></span>}
        </div>
      )}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────
function DetailPanel({ person, role, onUpdate, dynDefs, onBack }) {
  const defs       = getDocDefs(person.position, dynDefs);
  const prog       = calcProg(defs, person.docState);
  const sm         = stMeta(calcSt(defs, person.docState));
  const notSent    = defs.filter(d => d.required && !person.docState[d.id]?.fieldSent).length;
  const sentNotRcv = defs.filter(d => d.required && person.docState[d.id]?.fieldSent && !person.docState[d.id]?.hrReceived).length;
  const missTrk    = defs.filter(d => person.docState[d.id]?.fieldSent && !person.docState[d.id]?.trackingNo).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.card, borderRadius:16, border:`1.5px solid ${C.border}`, overflow:"hidden", boxShadow:C.shadowMd, animation:"fadeUp .25s ease" }}>

      {/* Header */}
      <div style={{ padding:"16px 18px 14px", borderBottom:`1px solid ${C.border}`, background:"white" }}>
        {/* Mobile back button */}
        {onBack && (
          <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.primary, fontSize:13, fontWeight:600, cursor:"pointer", padding:"0 0 12px", marginLeft:-2 }}>
            ← กลับรายชื่อ
          </button>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ color:C.muted, fontSize:11, marginBottom:3, fontWeight:500 }}>{person.position} · {person.area.replace(/_/g," ")}</div>
            <div style={{ color:C.text, fontSize:19, fontWeight:800, letterSpacing:-0.3, marginBottom:3 }}>{person.name}</div>
            <div style={{ color:C.textSoft, fontSize:12 }}>
              {person.head && `หัวหน้า: ${person.head}`}
              {person.head && person.hr && " · "}
              {person.hr && `HR: ${person.hr}`}
            </div>
          </div>
          <span style={{ padding:"5px 12px", borderRadius:20, background:sm.bg, color:sm.color, border:`1.5px solid ${sm.border}`, fontSize:12, fontWeight:700, whiteSpace:"nowrap", marginLeft:8 }}>{sm.label}</span>
        </div>

        {/* Dual progress */}
        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          {[
            { l:"🚗 ภาคสนามส่ง", v:`${prog.sent}/${prog.total}`, p:prog.sp, c:C.teal,    bg:C.tealLt    },
            { l:"🏢 HR รับแล้ว",  v:`${prog.recv}/${prog.total}`, p:prog.rp, c:C.primary, bg:C.primaryLt },
          ].map(b => (
            <div key={b.l} style={{ flex:1, background:b.bg, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
                <span style={{ fontSize:11, color:C.textSoft, fontWeight:500 }}>{b.l}</span>
                <span style={{ fontSize:15, fontWeight:800, color:b.c }}>{b.v}</span>
              </div>
              <Bar pct={b.p} color={b.c} h={7} />
            </div>
          ))}
        </div>

        {/* Alert chips */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {notSent>0    && <span style={{ padding:"4px 11px", borderRadius:8, background:C.redLt,    border:"1px solid #E0A0A0", color:C.red,    fontSize:11, fontWeight:700 }}>⚠ ยังไม่ส่ง {notSent} รายการ</span>}
          {sentNotRcv>0 && <span style={{ padding:"4px 11px", borderRadius:8, background:C.orangeLt, border:`1px solid ${C.orangeMd}`, color:C.orange, fontSize:11, fontWeight:700 }}>📬 รอ HR {sentNotRcv} รายการ</span>}
          {role==="field"&&missTrk>0 && <span style={{ padding:"4px 11px", borderRadius:8, background:C.trackBg, border:`1px solid ${C.trackBorder}`, color:C.trackText, fontSize:11, fontWeight:700 }}>📦 ยังไม่กรอกเทรคกิ้ง {missTrk} รายการ</span>}
          {notSent===0&&sentNotRcv===0 && <span style={{ padding:"4px 11px", borderRadius:8, background:C.primaryLt, border:`1px solid ${C.primaryMd}`, color:C.primary, fontSize:11, fontWeight:700 }}>✅ เอกสารครบทุกรายการ</span>}
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding:"7px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:12, fontSize:10.5, color:C.muted, background:C.cardAlt, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ color:C.teal, fontWeight:600 }}>■ ภาคสนามส่ง</span>
        <span style={{ color:C.primary, fontWeight:600 }}>■ HR รับ</span>
        <span style={{ color:C.orange, fontWeight:600 }}>■ รอ HR</span>
        <span style={{ color:C.trackText, fontWeight:600 }}>📦 เทรคกิ้ง</span>
        <span style={{ marginLeft:"auto", color:C.muted }}>
          {role==="field" ? "กด ☐ ซ้าย=ส่ง · 📦=กรอกเลข" : "กด ☐ ขวา=ยืนยันรับ"}
        </span>
      </div>

      {/* Checklist */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", background:C.bg }}>
        {defs.map(doc => (
          <CheckRow
            key={doc.id} docDef={doc} state={person.docState[doc.id]||{}} role={role}
            onToggleField={() => onUpdate(person.name, doc.id, "field")}
            onToggleHR={()    => onUpdate(person.name, doc.id, "hr")}
            onTracking={v     => onUpdate(person.name, doc.id, "tracking", v)}
            onNote={v         => onUpdate(person.name, doc.id, "note", v)}
          />
        ))}
      </div>

      {/* Footer */}
      {(person.reportDate || person.deadlineDate) && (
        <div style={{ padding:"10px 18px", borderTop:`1px solid ${C.border}`, display:"flex", gap:18, fontSize:11.5, color:C.muted, background:"white", flexWrap:"wrap" }}>
          {person.reportDate   && <span>📅 รายงานตัว <b style={{ color:C.textSoft }}>{person.reportDate}</b></span>}
          {person.deadlineDate && <span>⏰ กำหนดครบ <b style={{ color:C.primary, fontWeight:700 }}>{person.deadlineDate}</b></span>}
        </div>
      )}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, v, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 14px", borderRadius:10, cursor:"pointer", transition:"all .18s",
      fontFamily:"inherit", display:"flex", alignItems:"center", gap:7,
      background: active ? color : "white",
      border:`1.5px solid ${active ? color : C.border}`,
      boxShadow: active ? `0 2px 8px rgba(0,0,0,0.12)` : C.shadow,
      minHeight:40,
    }}>
      <span style={{ color: active ? "white" : color, fontWeight:800, fontSize:16 }}>{v}</span>
      <span style={{ color: active ? "rgba(255,255,255,.85)" : C.textSoft, fontSize:11.5, whiteSpace:"nowrap" }}>{label}</span>
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [role,        setRole]       = useState("hr");
  const [people,      setPeople]     = useState([]);
  const [dynDefs,     setDynDefs]    = useState({});
  const [selected,    setSelected]   = useState(null);
  const [filter,      setFilter]     = useState("all");
  const [search,      setSearch]     = useState("");
  const [loadState,   setLoadState]  = useState("idle");
  const [loadMsg,     setLoadMsg]    = useState("");
  const [lastLoaded,  setLastLoaded] = useState(null);
  const [mobileView,  setMobileView] = useState("list"); // "list" | "detail"

  const fetchData = useCallback(async () => {
    setLoadState("loading"); setLoadMsg("กำลังดึงข้อมูล...");
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/sheets?sheet=tracker"),
        fetch("/api/sheets?sheet=docs"),
      ]);
      if (!r1.ok) throw new Error(`server ${r1.status}`);
      const j1 = await r1.json();
      const j2 = r2.ok ? await r2.json() : { rows:[] };
      if (j1.error) throw new Error(j1.error);

      const importedDefs = parseDocsRows(j2.rows || []);
      const raw          = parsePeopleRows(j1.rows || []);
      if (!raw.length) throw new Error("ไม่พบข้อมูลรายชื่อใน Sheet");

      const withState = raw.map(p => {
        const d = getDocDefs(p.position, importedDefs);
        return { ...p, docState: initDocState(d) };
      });
      setDynDefs(importedDefs);
      setPeople(withState);
      setSelected(prev => withState.find(p => p.name===prev?.name) || withState[0] || null);
      setLoadState("ok"); setLastLoaded(new Date());
      setLoadMsg(`โหลดสำเร็จ ${withState.length} คน`);
    } catch(e) {
      setLoadState("error"); setLoadMsg("โหลดไม่สำเร็จ: " + e.message);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selected) { const up = people.find(p => p.name===selected.name); if(up) setSelected(up); }
  }, [people]);

  function handleDocUpdate(name, docId, action, value) {
    setPeople(prev => prev.map(p => {
      if (p.name !== name) return p;
      const d = { ...p.docState[docId] };
      if      (action==="field")    { d.fieldSent=!d.fieldSent; d.fieldSentAt=d.fieldSent?todayStr():null; if(!d.fieldSent){d.hrReceived=false;d.hrReceivedAt=null;} }
      else if (action==="hr")       { d.hrReceived=!d.hrReceived; d.hrReceivedAt=d.hrReceived?todayStr():null; }
      else if (action==="tracking") { d.trackingNo=value; }
      else if (action==="note")     { d.note=value; }
      return { ...p, docState:{ ...p.docState, [docId]:d } };
    }));
  }

  const withSt   = people.map(p => ({ ...p, _st:calcSt(getDocDefs(p.position,dynDefs), p.docState) }));
  const filtered = withSt.filter(p => {
    const mf = filter==="all" || p._st===filter;
    const ms = [p.name, p.area, p.position, p.hr].some(v => v.includes(search));
    return mf && ms;
  });
  const stats = {
    total:    people.length,
    complete: withSt.filter(p=>p._st==="complete").length,
    gap:      withSt.filter(p=>p._st==="gap").length,
    progress: withSt.filter(p=>p._st==="in_progress").length,
    pending:  withSt.filter(p=>p._st==="pending").length,
  };

  const dotColor = { ok:C.primary, error:C.red, loading:C.yellow, idle:C.muted }[loadState];

  const handleSelectPerson = (person) => {
    setSelected(person);
    setMobileView("detail");
  };

  const currentPerson = people.find(p => p.name===selected?.name) || selected;

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{
        height:56, padding:"0 16px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"white", borderBottom:`1px solid ${C.border}`,
        position:"sticky", top:0, zIndex:200,
        boxShadow:"0 1px 6px rgba(30,80,40,0.08)",
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:34, height:34, borderRadius:10, flexShrink:0,
            background:`linear-gradient(135deg,${C.primary},${C.teal})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, boxShadow:"0 2px 8px rgba(45,122,79,.3)",
          }}>📂</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text, letterSpacing:-0.3 }}>DocTrack HR</div>
            <div style={{ fontSize:9.5, color:dotColor, display:"flex", alignItems:"center", gap:4, fontWeight:600 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:dotColor, display:"inline-block", flexShrink:0 }}/>
              <span style={{ whiteSpace:"nowrap" }}>
                {loadState==="ok"      ? `อัปเดต ${lastLoaded?.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})}` :
                 loadState==="loading" ? "กำลังโหลด..." :
                 loadState==="error"   ? "โหลดไม่สำเร็จ" : "พร้อมใช้งาน"}
              </span>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          {/* Refresh */}
          <button onClick={fetchData} disabled={loadState==="loading"} style={{
            width:38, height:38, borderRadius:9,
            border:`1.5px solid ${C.border}`, background:"white",
            color:C.textSoft, fontSize:17, cursor:loadState==="loading"?"wait":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:C.shadow,
          }}>
            <span style={{ display:"inline-block", animation:loadState==="loading"?"spin 0.8s linear infinite":"none" }}>
              {loadState==="loading" ? "⏳" : "🔄"}
            </span>
          </button>

          {/* Role toggle */}
          <div style={{ display:"flex", background:C.cardAlt, borderRadius:10, padding:3, border:`1.5px solid ${C.border}` }}>
            {[{id:"hr",label:"🏢 HR"},{id:"field",label:"🚗 สนาม"}].map(r => (
              <button key={r.id} onClick={() => setRole(r.id)} style={{
                padding:"6px 13px", borderRadius:8, border:"none", cursor:"pointer",
                fontFamily:"inherit",
                background: role===r.id ? C.primary : "transparent",
                color: role===r.id ? "white" : C.muted,
                fontWeight: role===r.id ? 700 : 500, fontSize:12.5, transition:"all .18s",
                boxShadow: role===r.id ? "0 1px 4px rgba(45,122,79,.35)" : "none",
                minHeight:34,
              }}>{r.label}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Status bar */}
      {loadMsg && (
        <div style={{
          padding:"8px 16px",
          background: loadState==="ok"?C.primaryLt : loadState==="error"?C.redLt : "#FEF9E4",
          borderBottom:`1px solid ${loadState==="ok"?C.primaryMd:loadState==="error"?"#E0A0A0":"#DCC060"}`,
          fontSize:12.5, fontWeight:600,
          color: loadState==="ok"?C.primary : loadState==="error"?C.red : C.yellow,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <span>{loadState==="ok"?"✅":loadState==="error"?"⚠":"⏳"} {loadMsg}</span>
          <button onClick={()=>setLoadMsg("")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* ── LOADING / ERROR ──────────────────────────────────────────────── */}
      {loadState==="loading" && people.length===0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"70vh", flexDirection:"column", gap:16 }}>
          <div style={{ width:44, height:44, border:`3px solid ${C.border}`, borderTopColor:C.primary, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          <span style={{ color:C.muted, fontSize:14 }}>กำลังดึงข้อมูลจาก Google Sheets...</span>
        </div>
      )}

      {loadState==="error" && people.length===0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"70vh", flexDirection:"column", gap:16, padding:32, textAlign:"center" }}>
          <div style={{ fontSize:48 }}>⚠️</div>
          <div style={{ color:C.text, fontSize:18, fontWeight:700 }}>โหลดข้อมูลไม่สำเร็จ</div>
          <div style={{ color:C.muted, fontSize:13, maxWidth:340, lineHeight:1.7 }}>{loadMsg.replace("โหลดไม่สำเร็จ: ","")}</div>
          <button onClick={fetchData} style={{ padding:"12px 28px", background:C.primary, border:"none", borderRadius:10, color:"white", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:`0 2px 8px rgba(45,122,79,.3)` }}>ลองใหม่</button>
        </div>
      )}

      {/* ── STATS + SEARCH ───────────────────────────────────────────────── */}
      {people.length>0 && (
        <div style={{ padding:"10px 14px", background:"white", borderBottom:`1px solid ${C.border}`, boxShadow:"0 1px 3px rgba(30,80,40,0.05)" }}>
          {/* Stat pills — horizontal scroll on mobile */}
          <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:2, marginBottom:9, scrollbarWidth:"none" }}>
            {[
              { label:"ทั้งหมด",   v:stats.total,    color:C.teal,    f:"all"         },
              { label:"HR รับครบ", v:stats.complete, color:C.primary, f:"complete"    },
              { label:"รอ HR",     v:stats.gap,      color:C.orange,  f:"gap"         },
              { label:"กำลังส่ง",  v:stats.progress, color:C.teal,    f:"in_progress" },
              { label:"ยังไม่ส่ง", v:stats.pending,  color:C.yellow,  f:"pending"     },
            ].map(s => (
              <StatPill key={s.f} {...s} active={filter===s.f} onClick={() => setFilter(f=>f===s.f?"all":s.f)} />
            ))}
          </div>
          {/* Search */}
          <div style={{ display:"flex", alignItems:"center", gap:9, background:C.cardAlt, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"9px 13px" }}>
            <span style={{ color:C.muted, fontSize:16 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ พื้นที่ ตำแหน่ง..."
              style={{ background:"none", border:"none", outline:"none", color:C.text, fontSize:14, flex:1, fontFamily:"inherit" }}/>
            {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>×</button>}
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ──────────────────────────────────────────────────── */}
      {people.length>0 && (
        <>
          {/* Desktop: side-by-side */}
          <div style={{ display:"flex", height:"calc(100vh - 56px - 110px)" }} className="desktop-layout">
            {/* List pane */}
            <div style={{ width:340, borderRight:`1px solid ${C.border}`, overflowY:"auto", padding:"14px 12px", background:C.bg, flexShrink:0 }}>
              {filtered.length===0 && <div style={{ textAlign:"center", color:C.muted, padding:48, fontSize:14 }}>ไม่พบข้อมูล</div>}
              {filtered.map(p => (
                <PersonCard key={p.name} person={p} selected={selected?.name===p.name} onClick={handleSelectPerson} dynDefs={dynDefs}/>
              ))}
            </div>
            {/* Detail pane */}
            <div style={{ flex:1, padding:16, overflowY:"auto", background:C.bg, minWidth:0 }}>
              {currentPerson
                ? <DetailPanel person={currentPerson} role={role} onUpdate={handleDocUpdate} dynDefs={dynDefs}/>
                : <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:14 }}>← เลือกพนักงานเพื่อดูรายละเอียด</div>
              }
            </div>
          </div>

          {/* Mobile: stacked, show list or detail */}
          <div className="mobile-layout" style={{ height:"calc(100vh - 56px - 110px)", overflow:"hidden", position:"relative" }}>
            {/* List */}
            <div style={{
              position:"absolute", inset:0,
              overflowY:"auto", padding:"12px 12px",
              background:C.bg,
              transform: mobileView==="detail" ? "translateX(-100%)" : "translateX(0)",
              transition:"transform .28s ease",
            }}>
              {filtered.length===0 && <div style={{ textAlign:"center", color:C.muted, padding:48 }}>ไม่พบข้อมูล</div>}
              {filtered.map(p => (
                <PersonCard key={p.name} person={p} selected={selected?.name===p.name} onClick={handleSelectPerson} dynDefs={dynDefs}/>
              ))}
            </div>
            {/* Detail */}
            <div style={{
              position:"absolute", inset:0,
              overflowY:"auto", padding:"10px 10px",
              background:C.bg,
              transform: mobileView==="detail" ? "translateX(0)" : "translateX(100%)",
              transition:"transform .28s ease",
            }}>
              {currentPerson && (
                <DetailPanel
                  person={currentPerson} role={role}
                  onUpdate={handleDocUpdate} dynDefs={dynDefs}
                  onBack={() => setMobileView("list")}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Responsive CSS ────────────────────────────────────────────────── */}
      <style>{`
        .desktop-layout { display: flex; }
        .mobile-layout  { display: none; }
        @media (max-width: 700px) {
          .desktop-layout { display: none !important; }
          .mobile-layout  { display: block !important; }
        }
      `}</style>
    </div>
  );
}
