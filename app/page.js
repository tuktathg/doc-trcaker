"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  parsePeopleRows, parseDocsRows,
  getDocDefs, initDocState, calcProg, calcSt, todayStr,
} from "../lib/parsers";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:"#F0F7F2", card:"#FFFFFF", cardAlt:"#F5FAF6",
  border:"#C8E0CE", borderMd:"#A8CDB3",
  primary:"#2D7A4F", primaryDk:"#1F5C3A", primaryLt:"#E6F4EC", primaryMd:"#A8D5B5",
  teal:"#1A8A7A", tealLt:"#E3F4F2", tealMd:"#8ECFC8",
  orange:"#C06B2A", orangeLt:"#FDF0E6", orangeMd:"#F0BF90",
  red:"#B84040", redLt:"#FAEAEA",
  yellow:"#8A7020", yellowLt:"#FBF7E4",
  text:"#1A2E1F", textSoft:"#4A6650", muted:"#7A9882",
  trackBg:"#FFFBE6", trackBorder:"#D4A017", trackText:"#7A5C00",
  shadow:"0 1px 4px rgba(30,80,40,0.08)",
  shadowMd:"0 4px 16px rgba(30,80,40,0.10)",
};

const stMeta = s => ({
  complete:    { label:"HR รับครบ ✓",  color:C.primary, bg:C.primaryLt, border:C.primaryMd },
  gap:         { label:"รอ HR ยืนยัน", color:C.orange,  bg:C.orangeLt,  border:C.orangeMd  },
  in_progress: { label:"กำลังส่ง",      color:C.teal,    bg:C.tealLt,    border:C.tealMd    },
  pending:     { label:"ยังไม่ส่ง",     color:C.yellow,  bg:C.yellowLt,  border:"#C8B060"   },
}[s] || { label:s, color:C.muted, bg:C.bg, border:C.border });

// ── Excel Export ──────────────────────────────────────────────────────────────
function exportExcel(people, dynDefs) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: สรุปรายคน ──────────────────────────────────────────────────
  const summaryRows = [["ชื่อ-นามสกุล","พื้นที่","ตำแหน่ง","หัวหน้าทีม","HR","วันรายงานตัว","สถานะ","ส่งแล้ว","HR รับแล้ว","เอกสารทั้งหมด","เอกสารค้างส่ง"]];
  people.forEach(p => {
    const defs    = getDocDefs(p.position, dynDefs);
    const prog    = calcProg(defs, p.docState);
    const st      = calcSt(defs, p.docState);
    const pending = defs.filter(d => d.required && !p.docState[d.id]?.fieldSent).map(d => d.label).join(", ");
    summaryRows.push([
      p.name, p.area.replace(/_/g," "), p.position, p.head, p.hr, p.reportDate,
      stMeta(st).label, prog.sent, prog.recv, prog.total, pending || "-",
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [20,22,14,20,8,14,14,8,10,12,40].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, "สรุปรายคน");

  // ── Sheet 2: รายละเอียดเอกสาร ────────────────────────────────────────────
  const detailRows = [["ชื่อ-นามสกุล","หัวหน้าทีม","พื้นที่","วันรายงานตัว","เอกสาร","บังคับ","ภาคสนามส่ง","วันที่ส่ง","HR รับ","วันที่รับ","เลขเทรคกิ้ง","หมายเหตุ"]];
  people.forEach(p => {
    const defs = getDocDefs(p.position, dynDefs);
    defs.forEach(doc => {
      const s = p.docState[doc.id] || {};
      detailRows.push([
        p.name, p.head, p.area.replace(/_/g," "), p.reportDate,
        doc.label, doc.required?"จำเป็น":"ไม่บังคับ",
        s.fieldSent?"✓":"", s.fieldSentAt||"",
        s.hrReceived?"✓":"", s.hrReceivedAt||"",
        s.trackingNo||"", s.note||"",
      ]);
    });
  });
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
  ws2["!cols"] = [20,20,18,14,24,10,10,14,8,14,16,20].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, "รายละเอียดเอกสาร");

  // ── Sheet 3: เอกสารค้างส่ง ───────────────────────────────────────────────
  const pendingRows = [["ชื่อ-นามสกุล","หัวหน้าทีม","พื้นที่","วันรายงานตัว","เอกสารที่ค้าง"]];
  people.forEach(p => {
    const defs    = getDocDefs(p.position, dynDefs);
    const pending = defs.filter(d => d.required && !p.docState[d.id]?.fieldSent);
    if (pending.length > 0) {
      pendingRows.push([p.name, p.head, p.area.replace(/_/g," "), p.reportDate, pending.map(d=>d.label).join(", ")]);
    }
  });
  const ws3 = XLSX.utils.aoa_to_sheet(pendingRows);
  ws3["!cols"] = [20,20,18,14,50].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws3, "เอกสารค้างส่ง");

  const date = new Date().toLocaleDateString("th-TH",{day:"2-digit",month:"2-digit",year:"numeric"}).replace(/\//g,"-");
  XLSX.writeFile(wb, `DocTrack_${date}.xlsx`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Bar({ pct, color, h=6 }) {
  return (
    <div style={{ height:h, background:C.border, borderRadius:99, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width .6s ease" }}/>
    </div>
  );
}

function Chk({ active, tint, tintLt, onCk, off, size=28 }) {
  return (
    <div onClick={off?null:onCk} style={{
      width:size, height:size, borderRadius:8, flexShrink:0,
      border:`2px solid ${active?tint:off?C.border:C.borderMd}`,
      background:active?tint:off?"#F2F7F3":"white",
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor:off?"default":"pointer", transition:"all .18s",
      boxShadow:active?`0 0 0 4px ${tintLt}`:"none",
    }}>
      {active && (
        <svg width={size*.52} height={size*.46} viewBox="0 0 14 11" fill="none">
          <path d="M1.5 5.5L5.5 9.5L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ── BulkTrackingSheet ─────────────────────────────────────────────────────────
function BulkTrackingSheet({ person, defs, onApply, onClose }) {
  const [trackNo, setTrackNo] = useState("");
  const [mode,    setMode]    = useState("unsent");
  const [sel,     setSel]     = useState({});
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(()=>inputRef.current?.focus(), 120); }, []);

  const sentDocs    = defs.filter(d => person.docState[d.id]?.fieldSent);
  const noTrackDocs = sentDocs.filter(d => !person.docState[d.id]?.trackingNo);
  const scopeDocs   = mode==="unsent" ? noTrackDocs : mode==="all" ? sentDocs : sentDocs.filter(d=>sel[d.id]);
  const canApply    = trackNo.trim().length>0 && scopeDocs.length>0;

  const ModeBtn = ({m, label, count}) => (
    <button onClick={()=>setMode(m)} style={{
      flex:1, padding:"10px 8px", borderRadius:9,
      border:`2px solid ${mode===m?C.primary:C.border}`,
      background:mode===m?C.primaryLt:"white",
      color:mode===m?C.primary:C.textSoft,
      fontWeight:mode===m?700:500, fontSize:12, cursor:"pointer", fontFamily:"inherit",
      transition:"all .18s", minHeight:56,
    }}>
      {count!=null && <div style={{ fontSize:20, fontWeight:800, color:mode===m?C.primary:C.muted }}>{count}</div>}
      {label}
    </button>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500 }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ position:"absolute", inset:0, background:"rgba(10,30,15,0.45)", backdropFilter:"blur(2px)" }} onClick={onClose}/>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"white", borderRadius:"20px 20px 0 0", padding:"20px 18px 36px", maxHeight:"88vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(10,40,20,0.18)", animation:"slideUp .28s ease" }}>
        <div style={{ width:40, height:4, background:C.border, borderRadius:99, margin:"-8px auto 18px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:C.text }}>📦 กรอกเลขพัสดุทีเดียว</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{person.name}</div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${C.border}`, background:C.cardAlt, color:C.muted, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <label style={{ fontSize:12, fontWeight:700, color:C.trackText, marginBottom:7, display:"block" }}>📦 เลขพัสดุ / เทรคกิ้ง</label>
        <input ref={inputRef} value={trackNo} onChange={e=>setTrackNo(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter")handleApply(); if(e.key==="Escape")onClose(); }}
          placeholder="เช่น TH12345678901"
          style={{ width:"100%", padding:"14px 16px", fontSize:16, fontWeight:700, letterSpacing:.8, background:C.trackBg, border:`2.5px solid ${trackNo?C.trackBorder:C.borderMd}`, borderRadius:11, outline:"none", color:C.trackText, boxShadow:trackNo?`0 0 0 4px rgba(212,160,23,.15)`:"none", transition:"all .18s", marginBottom:14 }}/>
        <div style={{ fontSize:12, fontWeight:700, color:C.textSoft, marginBottom:8 }}>ใส่เลขนี้ให้รายการใด?</div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <ModeBtn m="unsent" label="ที่ยังไม่มีเลข"           count={noTrackDocs.length}/>
          <ModeBtn m="all"    label="ทุกรายการที่ส่งแล้ว"     count={sentDocs.length}/>
          <ModeBtn m="custom" label="เลือกเอง"                 count={null}/>
        </div>
        {mode==="custom" && (
          <div style={{ marginBottom:14, border:`1.5px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"9px 13px", background:C.cardAlt, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.textSoft }}>เลือกรายการ</span>
              <button onClick={()=>{const s={};sentDocs.forEach(d=>{s[d.id]=true;});setSel(s);}} style={{ fontSize:11, color:C.primary, background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>เลือกทั้งหมด</button>
            </div>
            {sentDocs.map(doc=>(
              <div key={doc.id} onClick={()=>setSel(p=>({...p,[doc.id]:!p[doc.id]}))} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px", cursor:"pointer", background:sel[doc.id]?C.primaryLt:"white", borderTop:`1px solid ${C.border}`, transition:"background .15s" }}>
                <Chk active={!!sel[doc.id]} tint={C.primary} tintLt={C.primaryLt} onCk={()=>setSel(p=>({...p,[doc.id]:!p[doc.id]}))} off={false} size={22}/>
                <span style={{ fontSize:13, color:C.text, flex:1 }}>{doc.label}</span>
                {person.docState[doc.id]?.trackingNo && <span style={{ fontSize:10, color:C.trackText, background:C.trackBg, borderRadius:4, padding:"1px 6px", border:`1px solid ${C.trackBorder}` }}>{person.docState[doc.id].trackingNo}</span>}
              </div>
            ))}
          </div>
        )}
        {trackNo && scopeDocs.length>0 && (
          <div style={{ padding:"9px 13px", borderRadius:9, background:C.tealLt, border:`1px solid ${C.tealMd}`, color:C.teal, fontSize:12.5, fontWeight:600, marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
            ✓ ใส่เลข <b style={{ fontFamily:"monospace", background:"white", padding:"1px 6px", borderRadius:5, border:`1px solid ${C.tealMd}` }}>{trackNo}</b> ให้ <b>{scopeDocs.length}</b> รายการ
          </div>
        )}
        <button onClick={handleApply} disabled={!canApply} style={{ width:"100%", padding:"15px", borderRadius:12, border:"none", background:canApply?C.primary:C.border, color:canApply?"white":C.muted, fontWeight:800, fontSize:15, cursor:canApply?"pointer":"default", boxShadow:canApply?`0 3px 12px rgba(45,122,79,.35)`:"none", transition:"all .2s", fontFamily:"inherit", minHeight:52 }}>
          {canApply?`📦 ใส่เลขพัสดุ ${scopeDocs.length} รายการ`:"กรอกเลขพัสดุก่อน"}
        </button>
      </div>
    </div>
  );

  function handleApply() { if(!canApply) return; onApply(scopeDocs.map(d=>d.id), trackNo.trim()); onClose(); }
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────
function BulkActionBar({ person, defs, onBulkSend, onOpenBulkTracking }) {
  // เฉพาะที่ยังไม่ได้ส่ง (lock: ส่งแล้วไม่นับ)
  const notSent     = defs.filter(d => !person.docState[d.id]?.fieldSent);
  const sentNoTrack = defs.filter(d =>  person.docState[d.id]?.fieldSent && !person.docState[d.id]?.trackingNo);
  const sentDocs    = defs.filter(d =>  person.docState[d.id]?.fieldSent);
  // ซ่อน bar ถ้าไม่มีอะไรให้ทำเลย
  if (notSent.length===0 && sentDocs.length===0) return null;
  return (
    <div style={{ padding:"12px 14px", borderTop:`1.5px solid ${C.primaryMd}`, background:`linear-gradient(135deg,${C.tealLt},${C.primaryLt})`, display:"flex", gap:8, flexWrap:"wrap",
      // Sticky at bottom on mobile
      position:"sticky", bottom:0, zIndex:50,
      boxShadow:"0 -2px 12px rgba(30,80,40,0.10)",
    }}>
      {/* แสดงปุ่มส่งทั้งหมดเฉพาะเมื่อยังมีค้างส่ง */}
      {notSent.length>0 && (
        <button onClick={()=>onBulkSend(notSent.map(d=>d.id))} style={{ flex:1, minWidth:140, padding:"11px 14px", borderRadius:10, border:`1.5px solid ${C.teal}`, background:C.teal, color:"white", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, minHeight:44, boxShadow:`0 2px 8px rgba(26,138,122,.3)` }}>
          ✓ ส่งทั้งหมด ({notSent.length} รายการ)
        </button>
      )}
      {sentDocs.length>0 && (
        <button onClick={onOpenBulkTracking} style={{ flex:1, minWidth:140, padding:"11px 14px", borderRadius:10, border:`2px solid ${C.trackBorder}`, background:C.trackBg, color:C.trackText, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, minHeight:44, boxShadow:`0 2px 8px rgba(212,160,23,.18)` }}>
          📦 กรอกเลขพัสดุทีเดียว
          {sentNoTrack.length>0 && <span style={{ background:C.trackBorder, color:"white", borderRadius:20, fontSize:11, fontWeight:800, padding:"1px 7px" }}>{sentNoTrack.length}</span>}
        </button>
      )}
    </div>
  );
}

// ── CheckRow ──────────────────────────────────────────────────────────────────
// editMode prop: เมื่อ true ปลดล็อค checkbox ได้
function CheckRow({ docDef, state, role, editMode, onToggleField, onToggleHR, onToggleFieldOff, onToggleHROff, onTracking, onNote }) {
  const [showT, setShowT] = useState(false);
  const [showN, setShowN] = useState(false);
  const [tv, setTv] = useState(state.trackingNo||"");
  const [nv, setNv] = useState(state.note||"");
  const trackRef = useRef(null);
  const noteRef  = useRef(null);
  useEffect(()=>{ if(showT) setTimeout(()=>trackRef.current?.focus(),80); },[showT]);
  useEffect(()=>{ if(showN) setTimeout(()=>noteRef.current?.focus(),80); },[showN]);
  // sync input values เมื่อ state เปลี่ยนจากภายนอก
  useEffect(()=>{ setTv(state.trackingNo||""); },[state.trackingNo]);
  useEffect(()=>{ setNv(state.note||""); },[state.note]);

  const gap      = state.fieldSent && !state.hrReceived;
  const done     = !!state.hrReceived;
  // ปกติ: lock เมื่อส่ง/รับแล้ว — editMode: ปลดล็อคทั้งหมด
  const fieldLocked = !editMode && !!state.fieldSent;
  const hrLocked    = !editMode && !!state.hrReceived;

  const rowBg   = done ? C.primaryLt : gap ? C.orangeLt : editMode ? "#FFFEF5" : "white";
  const rowBord = editMode ? C.orange+"88" : done ? C.primaryMd : gap ? C.orangeMd : state.fieldSent ? C.tealMd : C.border;

  // toggle handlers: edit mode สามารถ uncheck ได้
  function handleFieldClick() {
    if (editMode) {
      state.fieldSent ? onToggleFieldOff() : onToggleField();
    } else if (!fieldLocked) {
      onToggleField();
    }
  }
  function handleHRClick() {
    if (editMode) {
      state.hrReceived ? onToggleHROff() : onToggleHR();
    } else if (!hrLocked && state.fieldSent) {
      onToggleHR();
    }
  }

  const fieldOff = editMode ? false : (role!=="field" || fieldLocked);
  const hrOff    = editMode ? false : (role!=="hr" || !state.fieldSent || hrLocked);

  return (
    <div style={{ borderRadius:12, border:`1.5px solid ${rowBord}`, background:rowBg, marginBottom:8, overflow:"hidden", transition:"all .2s", boxShadow:done&&!editMode?"none":C.shadow }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:3 }}>
            <span style={{ fontSize:14, fontWeight:600, color:done&&!editMode?C.primary:C.text, textDecoration:done&&!editMode?"line-through":"none", opacity:done&&!editMode?.65:1 }}>
              {docDef.label}
            </span>
            {!docDef.required && <span style={{ fontSize:9, color:C.muted, background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:4, padding:"1px 5px" }}>ไม่บังคับ</span>}
            {editMode && <span style={{ fontSize:9, color:C.orange, background:"#FFF3E0", border:`1px solid ${C.orange}88`, borderRadius:4, padding:"1px 6px", fontWeight:700 }}>✏️ แก้ไขได้</span>}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
            {gap && !editMode && <span style={{ fontSize:10, fontWeight:700, color:C.orange, background:C.orangeLt, borderRadius:5, padding:"1px 7px", border:`1px solid ${C.orangeMd}` }}>⚠ รอ HR</span>}
            {state.trackingNo && <span style={{ fontSize:10, fontWeight:700, color:C.trackText, background:C.trackBg, borderRadius:5, padding:"2px 8px", border:`1.5px solid ${C.trackBorder}` }}>📦 {state.trackingNo}</span>}
            {state.note && <span style={{ fontSize:10, color:C.teal }}>💬 {state.note}</span>}
            {state.fieldSentAt && <span style={{ fontSize:10, color:C.muted }}>📤 {state.fieldSentAt}</span>}
            {state.hrReceivedAt && <span style={{ fontSize:10, color:C.primary, fontWeight:600 }}>✅ {state.hrReceivedAt}</span>}
          </div>
        </div>

        {/* Field checkbox */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <span style={{ fontSize:9, color:C.muted, fontWeight:600 }}>🚗 ส่ง</span>
          <Chk active={state.fieldSent} tint={C.teal} tintLt={C.tealLt}
            onCk={handleFieldClick}
            off={editMode ? false : (role!=="field" || fieldLocked)}
          />
        </div>

        <span style={{ color:C.borderMd, fontSize:18 }}>›</span>

        {/* HR checkbox */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <span style={{ fontSize:9, color:C.muted, fontWeight:600 }}>🏢 รับ</span>
          <Chk active={state.hrReceived} tint={C.primary} tintLt={C.primaryLt}
            onCk={handleHRClick}
            off={editMode ? false : (role!=="hr" || !state.fieldSent || hrLocked)}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {(role==="field" || editMode) && (
            <button onClick={()=>{setShowT(v=>!v); setShowN(false);}}
              style={{ width:36, height:36, borderRadius:8,
                border:`1.5px solid ${state.trackingNo?C.trackBorder:C.border}`,
                background:state.trackingNo?C.trackBg:"white",
                color:state.trackingNo?C.trackText:C.muted,
                fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:state.trackingNo?`0 0 0 2px ${C.trackBorder}44`:"none",
              }}>📦</button>
          )}
          <button onClick={()=>{setShowN(v=>!v); setShowT(false);}}
            style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${state.note?C.primaryMd:C.border}`,
              background:state.note?C.primaryLt:"white", color:state.note?C.primary:C.muted,
              fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>📝</button>
        </div>
      </div>

      {/* Tracking input */}
      {showT && (
        <div style={{ padding:"0 14px 14px", animation:"popIn .18s ease" }}>
          <div style={{ background:C.trackBg, border:`2px solid ${C.trackBorder}`, borderRadius:11, padding:"12px 13px", boxShadow:"0 2px 10px rgba(212,160,23,.15)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.trackText, marginBottom:8 }}>📦 เลขพัสดุรายการนี้</div>
            <input ref={trackRef} value={tv} onChange={e=>setTv(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"){onTracking(tv);setShowT(false);} if(e.key==="Escape")setShowT(false); }}
              placeholder="TH12345678901"
              style={{ width:"100%", padding:"11px 13px", fontSize:15, fontWeight:700, letterSpacing:.6, background:"white", border:`2px solid ${C.trackBorder}`, borderRadius:8, outline:"none", color:C.trackText, marginBottom:10 }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{onTracking(tv);setShowT(false);}} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:C.primary, color:"white", fontSize:13, fontWeight:700, cursor:"pointer", minHeight:42 }}>✓ บันทึก</button>
              <button onClick={()=>setShowT(false)} style={{ padding:"10px 14px", borderRadius:9, border:`1px solid ${C.border}`, background:"white", color:C.muted, fontSize:13, cursor:"pointer", minHeight:42 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
      {/* Note input */}
      {showN && (
        <div style={{ padding:"0 14px 14px", animation:"popIn .18s ease" }}>
          <div style={{ background:C.primaryLt, border:`1.5px solid ${C.primaryMd}`, borderRadius:11, padding:"12px 13px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.primary, marginBottom:8 }}>📝 หมายเหตุ</div>
            <input ref={noteRef} value={nv} onChange={e=>setNv(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"){onNote(nv);setShowN(false);} if(e.key==="Escape")setShowN(false); }}
              placeholder="พิมพ์หมายเหตุ..."
              style={{ width:"100%", padding:"10px 12px", fontSize:14, background:"white", border:`1.5px solid ${C.primaryMd}`, borderRadius:8, outline:"none", color:C.text, marginBottom:10 }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{onNote(nv);setShowN(false);}} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:C.primary, color:"white", fontSize:13, fontWeight:700, cursor:"pointer", minHeight:42 }}>✓ บันทึก</button>
              <button onClick={()=>setShowN(false)} style={{ padding:"10px 14px", borderRadius:9, border:`1px solid ${C.border}`, background:"white", color:C.muted, fontSize:13, cursor:"pointer", minHeight:42 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PersonCard — shows head, reportDate only, pending-only docs ──────────────
function PersonCard({ person, selected, onClick, dynDefs }) {
  const defs    = getDocDefs(person.position, dynDefs);
  const prog    = calcProg(defs, person.docState);
  const sm      = stMeta(calcSt(defs, person.docState));
  const pending = defs.filter(d => d.required && !person.docState[d.id]?.fieldSent);

  return (
    <div onClick={()=>onClick(person)} style={{ background:selected?C.primaryLt:C.card, border:`2px solid ${selected?C.primary:C.border}`, borderRadius:14, padding:"14px 15px", cursor:"pointer", transition:"all .18s", marginBottom:10, boxShadow:selected?`0 0 0 3px ${C.primaryMd}55`:C.shadow, animation:"fadeUp .2s ease" }}>
      {/* Row 1: name + status */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div style={{ flex:1, minWidth:0, marginRight:8 }}>
          <div style={{ color:C.text, fontWeight:700, fontSize:14, marginBottom:1 }}>{person.name}</div>
          <div style={{ color:C.muted, fontSize:11 }}>
            {person.position}
            {person.head && <span> · หัวหน้า <b style={{ color:C.textSoft }}>{person.head}</b></span>}
          </div>
        </div>
        <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap", background:sm.bg, color:sm.color, border:`1.5px solid ${sm.border}` }}>{sm.label}</span>
      </div>

      {/* Row 2: reportDate + progress bars */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
        {person.reportDate && (
          <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>📅 <b style={{ color:C.textSoft }}>{person.reportDate}</b></span>
        )}
        <div style={{ flex:1, display:"flex", gap:8 }}>
          {[
            { l:`ส่ง ${prog.sent}/${prog.total}`, p:prog.sp, c:C.teal    },
            { l:`รับ ${prog.recv}/${prog.total}`, p:prog.rp, c:C.primary },
          ].map(b=>(
            <div key={b.l} style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginBottom:3 }}>
                <span>{b.l}</span><span style={{ color:b.c, fontWeight:700 }}>{b.p}%</span>
              </div>
              <Bar pct={b.p} color={b.c}/>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: pending docs (only if any) */}
      {pending.length>0 && (
        <div style={{ borderTop:`1px dashed ${C.border}`, paddingTop:8 }}>
          <div style={{ fontSize:10, color:C.red, fontWeight:700, marginBottom:4 }}>⚠ ค้างส่ง {pending.length} รายการ</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {pending.slice(0,4).map(d=>(
              <span key={d.id} style={{ fontSize:10, background:C.redLt, color:C.red, border:"1px solid #E0A0A0", borderRadius:5, padding:"1px 7px" }}>{d.label}</span>
            ))}
            {pending.length>4 && <span style={{ fontSize:10, color:C.muted }}>+{pending.length-4} รายการ</span>}
          </div>
        </div>
      )}
      {pending.length===0 && (
        <div style={{ fontSize:10, color:C.primary, fontWeight:700 }}>✅ ส่งครบทุกรายการแล้ว</div>
      )}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────
function DetailPanel({ person, role, onUpdate, dynDefs, onBack }) {
  const [showBulk, setShowBulk] = useState(false);
  const [showAll, setShowAll]   = useState(false);
  const [editMode, setEditMode] = useState(false); // ปลดล็อคแก้ไข

  const defs       = getDocDefs(person.position, dynDefs);
  const prog       = calcProg(defs, person.docState);
  const sm         = stMeta(calcSt(defs, person.docState));
  const notSent    = defs.filter(d=>d.required&&!person.docState[d.id]?.fieldSent).length;
  const sentNotRcv = defs.filter(d=>d.required&&person.docState[d.id]?.fieldSent&&!person.docState[d.id]?.hrReceived).length;
  const sentNoTrk  = defs.filter(d=>person.docState[d.id]?.fieldSent&&!person.docState[d.id]?.trackingNo).length;

  // which docs to display
  // editMode: แสดงทั้งหมดเสมอ / field ปกติ: แสดงแค่ค้างส่ง ถ้าไม่ toggle showAll
  const displayDefs = (editMode || showAll || role==="hr")
    ? defs
    : defs.filter(d => !person.docState[d.id]?.fieldSent);

  function handleBulkSend(ids)   { ids.forEach(id=>onUpdate(person.name,id,"field_force_on")); }
  function handleBulkTrack(ids,t){ ids.forEach(id=>onUpdate(person.name,id,"tracking",t)); }

  return (
    <>
      {showBulk && <BulkTrackingSheet person={person} defs={defs} onApply={handleBulkTrack} onClose={()=>setShowBulk(false)}/>}

      <div style={{ display:"flex", flexDirection:"column", background:C.card, borderRadius:16, border:`1.5px solid ${C.border}`, boxShadow:C.shadowMd, animation:"fadeUp .25s ease", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"16px 18px 14px", borderBottom:`1px solid ${C.border}`, background:"white" }}>
          {onBack && (
            <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:C.primary, fontSize:14, fontWeight:700, cursor:"pointer", padding:"0 0 12px", marginLeft:-2 }}>
              <span style={{ fontSize:18, lineHeight:1 }}>‹</span> กลับรายชื่อ
            </button>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ color:C.muted, fontSize:11, marginBottom:2, fontWeight:500 }}>{person.position} · {person.area.replace(/_/g," ")}</div>
              <div style={{ color:C.text, fontSize:19, fontWeight:800, letterSpacing:-0.3, marginBottom:2 }}>{person.name}</div>
              <div style={{ color:C.textSoft, fontSize:12, display:"flex", flexWrap:"wrap", gap:10 }}>
                {person.head && <span>หัวหน้าทีม <b style={{ color:C.text }}>{person.head}</b></span>}
                {person.hr   && <span>HR <b style={{ color:C.text }}>{person.hr}</b></span>}
                {person.reportDate && <span>📅 รายงานตัว <b style={{ color:C.primary }}>{person.reportDate}</b></span>}
              </div>
            </div>
            <span style={{ padding:"5px 12px", borderRadius:20, background:sm.bg, color:sm.color, border:`1.5px solid ${sm.border}`, fontSize:12, fontWeight:700, whiteSpace:"nowrap", marginLeft:8 }}>{sm.label}</span>
          </div>

          {/* Progress */}
          <div style={{ display:"flex", gap:10, marginBottom:10 }}>
            {[
              { l:"🚗 ภาคสนามส่ง", v:`${prog.sent}/${prog.total}`, p:prog.sp, c:C.teal,    bg:C.tealLt    },
              { l:"🏢 HR รับแล้ว",  v:`${prog.recv}/${prog.total}`, p:prog.rp, c:C.primary, bg:C.primaryLt },
            ].map(b=>(
              <div key={b.l} style={{ flex:1, background:b.bg, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
                  <span style={{ fontSize:11, color:C.textSoft, fontWeight:500 }}>{b.l}</span>
                  <span style={{ fontSize:15, fontWeight:800, color:b.c }}>{b.v}</span>
                </div>
                <Bar pct={b.p} color={b.c} h={7}/>
              </div>
            ))}
          </div>

          {/* Chips */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {notSent>0    && <span style={{ padding:"4px 11px", borderRadius:8, background:C.redLt, border:"1px solid #E0A0A0", color:C.red, fontSize:11, fontWeight:700 }}>⚠ ค้างส่ง {notSent} รายการ</span>}
            {sentNotRcv>0 && <span style={{ padding:"4px 11px", borderRadius:8, background:C.orangeLt, border:`1px solid ${C.orangeMd}`, color:C.orange, fontSize:11, fontWeight:700 }}>📬 รอ HR {sentNotRcv} รายการ</span>}
            {role==="field"&&sentNoTrk>0 && (
              <button onClick={()=>setShowBulk(true)} style={{ padding:"4px 11px", borderRadius:8, background:C.trackBg, border:`1.5px solid ${C.trackBorder}`, color:C.trackText, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 }}>
                📦 กรอกเลขพัสดุทีเดียว ({sentNoTrk})
              </button>
            )}
            {notSent===0&&sentNotRcv===0 && <span style={{ padding:"4px 11px", borderRadius:8, background:C.primaryLt, border:`1px solid ${C.primaryMd}`, color:C.primary, fontSize:11, fontWeight:700 }}>✅ เอกสารครบทุกรายการ</span>}
          </div>
        </div>

        {/* Subheader */}
        <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background: editMode ? "#FFF8F0" : C.cardAlt, gap:8 }}>
          <div style={{ display:"flex", gap:10, fontSize:10.5, color:C.muted, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ color:C.teal, fontWeight:600 }}>■ ส่งแล้ว</span>
            <span style={{ color:C.primary, fontWeight:600 }}>■ HR รับ</span>
            <span style={{ color:C.trackText, fontWeight:600 }}>📦 เทรคกิ้ง</span>
            {editMode && <span style={{ color:C.orange, fontWeight:700, fontSize:11 }}>✏️ โหมดแก้ไข — แตะ checkbox เพื่อเปลี่ยนสถานะ</span>}
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {role==="field" && !editMode && (
              <button onClick={()=>setShowAll(v=>!v)} style={{ fontSize:11, fontWeight:700, color:C.primary, background:C.primaryLt, border:`1px solid ${C.primaryMd}`, borderRadius:7, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", minHeight:32 }}>
                {showAll ? "ค้างส่ง" : `ทั้งหมด (${defs.length})`}
              </button>
            )}
            {/* ปุ่มแก้ไข */}
            <button
              onClick={()=>{ setEditMode(v=>!v); setShowAll(true); }}
              style={{
                fontSize:11, fontWeight:700, padding:"5px 11px", borderRadius:7, cursor:"pointer",
                fontFamily:"inherit", whiteSpace:"nowrap", minHeight:32,
                background: editMode ? C.orange : "white",
                color:      editMode ? "white"  : C.orange,
                border:     `1.5px solid ${C.orange}`,
                boxShadow:  editMode ? `0 2px 8px rgba(192,119,58,.3)` : "none",
                transition: "all .18s",
              }}
            >
              {editMode ? "✓ เสร็จสิ้น" : "✏️ แก้ไข"}
            </button>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ padding:"12px 14px", background:C.bg }}>
          {displayDefs.length===0
            ? <div style={{ textAlign:"center", padding:40, color:C.primary, fontSize:14, fontWeight:600 }}>✅ ส่งเอกสารครบทุกรายการแล้ว!</div>
            : displayDefs.map(doc=>(
                <CheckRow key={doc.id} docDef={doc} state={person.docState[doc.id]||{}} role={role}
                  editMode={editMode}
                  onToggleField={()=>onUpdate(person.name,doc.id,"field")}
                  onToggleHR={()=>onUpdate(person.name,doc.id,"hr")}
                  onToggleFieldOff={()=>onUpdate(person.name,doc.id,"field_off")}
                  onToggleHROff={()=>onUpdate(person.name,doc.id,"hr_off")}
                  onTracking={v=>onUpdate(person.name,doc.id,"tracking",v)}
                  onNote={v=>onUpdate(person.name,doc.id,"note",v)}
                />
              ))
          }
        </div>

        {/* Bulk action bar */}
        {role==="field" && <BulkActionBar person={person} defs={defs} onBulkSend={handleBulkSend} onOpenBulkTracking={()=>setShowBulk(true)}/>}
      </div>
    </>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────
function StatPill({ label, v, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"7px 14px", borderRadius:10, cursor:"pointer", transition:"all .18s", fontFamily:"inherit", display:"flex", alignItems:"center", gap:7, background:active?color:"white", border:`1.5px solid ${active?color:C.border}`, boxShadow:active?"0 2px 8px rgba(0,0,0,0.12)":C.shadow, minHeight:40, flexShrink:0 }}>
      <span style={{ color:active?"white":color, fontWeight:800, fontSize:16 }}>{v}</span>
      <span style={{ color:active?"rgba(255,255,255,.85)":C.textSoft, fontSize:11.5, whiteSpace:"nowrap" }}>{label}</span>
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [role,       setRole]       = useState("hr");
  const [people,     setPeople]     = useState([]);
  const [dynDefs,    setDynDefs]    = useState({});
  const [selected,   setSelected]   = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [loadState,  setLoadState]  = useState("idle");
  const [loadMsg,    setLoadMsg]    = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);
  const [mobileView, setMobileView] = useState("list");

  const fetchData = useCallback(async () => {
    setLoadState("loading"); setLoadMsg("กำลังดึงข้อมูล...");
    try {
      const [r1,r2] = await Promise.all([fetch("/api/sheets?sheet=tracker"),fetch("/api/sheets?sheet=docs")]);
      if (!r1.ok) throw new Error(`server ${r1.status}`);
      const j1 = await r1.json(); const j2 = r2.ok?await r2.json():{rows:[]};
      if (j1.error) throw new Error(j1.error);
      const importedDefs = parseDocsRows(j2.rows||[]);
      const raw = parsePeopleRows(j1.rows||[]);
      if (!raw.length) throw new Error("ไม่พบข้อมูลรายชื่อใน Sheet");
      const withState = raw.map(p=>{ const d=getDocDefs(p.position,importedDefs); return{...p,docState:initDocState(d)}; });
      setDynDefs(importedDefs); setPeople(withState);
      setSelected(prev=>withState.find(p=>p.name===prev?.name)||withState[0]||null);
      setLoadState("ok"); setLastLoaded(new Date()); setLoadMsg(`โหลดสำเร็จ ${withState.length} คน`);
    } catch(e) { setLoadState("error"); setLoadMsg("โหลดไม่สำเร็จ: "+e.message); }
  },[]);

  useEffect(()=>{ fetchData(); },[]);
  useEffect(()=>{
    if(selected){ const up=people.find(p=>p.name===selected.name); if(up) setSelected(up); }
  },[people]);

  function handleDocUpdate(name,docId,action,value) {
    setPeople(prev=>prev.map(p=>{
      if(p.name!==name) return p;
      const d={...p.docState[docId]};
      if      (action==="field")          { if(!d.fieldSent){d.fieldSent=true;d.fieldSentAt=todayStr();} }
      else if (action==="field_force_on") { if(!d.fieldSent){d.fieldSent=true;d.fieldSentAt=todayStr();} }
      else if (action==="field_off")      { d.fieldSent=false;d.fieldSentAt=null;d.hrReceived=false;d.hrReceivedAt=null; } // edit mode
      else if (action==="hr")             { if(!d.hrReceived){d.hrReceived=true;d.hrReceivedAt=todayStr();} }
      else if (action==="hr_off")         { d.hrReceived=false;d.hrReceivedAt=null; } // edit mode
      else if (action==="tracking")      { d.trackingNo=value; }
      else if (action==="note")          { d.note=value; }
      return{...p,docState:{...p.docState,[docId]:d}};
    }));
  }

  const withSt   = people.map(p=>({...p,_st:calcSt(getDocDefs(p.position,dynDefs),p.docState)}));
  const filtered = withSt.filter(p=>{
    const mf=filter==="all"||p._st===filter;
    const ms=[p.name,p.area,p.position,p.hr,p.head].some(v=>v.includes(search));
    return mf&&ms;
  });
  const stats = { total:people.length, complete:withSt.filter(p=>p._st==="complete").length, gap:withSt.filter(p=>p._st==="gap").length, progress:withSt.filter(p=>p._st==="in_progress").length, pending:withSt.filter(p=>p._st==="pending").length };
  const dotColor = { ok:C.primary,error:C.red,loading:C.yellow,idle:C.muted }[loadState];
  const currentPerson = people.find(p=>p.name===selected?.name)||selected;

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>

      {/* NAV */}
      <nav style={{ height:56, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"white", borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:200, boxShadow:"0 1px 6px rgba(30,80,40,0.08)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:`linear-gradient(135deg,${C.primary},${C.teal})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:"0 2px 8px rgba(45,122,79,.3)" }}>📂</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text, letterSpacing:-0.3 }}>DocTrack HR</div>
            <div style={{ fontSize:9.5, color:dotColor, display:"flex", alignItems:"center", gap:4, fontWeight:600 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:dotColor, display:"inline-block", flexShrink:0 }}/>
              <span style={{ whiteSpace:"nowrap" }}>{loadState==="ok"?`อัปเดต ${lastLoaded?.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})}`:loadState==="loading"?"กำลังโหลด...":loadState==="error"?"โหลดไม่สำเร็จ":"พร้อมใช้งาน"}</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          {/* Export Excel */}
          {people.length>0 && (
            <button onClick={()=>exportExcel(people,dynDefs)} style={{ padding:"6px 13px", borderRadius:9, border:`1.5px solid ${C.primaryMd}`, background:C.primaryLt, color:C.primary, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5, minHeight:36, boxShadow:C.shadow }}>
              📊 Export Excel
            </button>
          )}
          {/* Refresh */}
          <button onClick={fetchData} disabled={loadState==="loading"} style={{ width:38, height:38, borderRadius:9, border:`1.5px solid ${C.border}`, background:"white", color:C.textSoft, fontSize:17, cursor:loadState==="loading"?"wait":"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:C.shadow }}>
            <span style={{ display:"inline-block", animation:loadState==="loading"?"spin 0.8s linear infinite":"none" }}>{loadState==="loading"?"⏳":"🔄"}</span>
          </button>
          {/* Role toggle */}
          <div style={{ display:"flex", background:C.cardAlt, borderRadius:10, padding:3, border:`1.5px solid ${C.border}` }}>
            {[{id:"hr",label:"🏢 HR"},{id:"field",label:"🚗 สนาม"}].map(r=>(
              <button key={r.id} onClick={()=>setRole(r.id)} style={{ padding:"6px 13px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", background:role===r.id?C.primary:"transparent", color:role===r.id?"white":C.muted, fontWeight:role===r.id?700:500, fontSize:12.5, transition:"all .18s", boxShadow:role===r.id?"0 1px 4px rgba(45,122,79,.35)":"none", minHeight:34 }}>{r.label}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Status bar */}
      {loadMsg && (
        <div style={{ padding:"8px 16px", background:loadState==="ok"?C.primaryLt:loadState==="error"?C.redLt:"#FEF9E4", borderBottom:`1px solid ${loadState==="ok"?C.primaryMd:loadState==="error"?"#E0A0A0":"#DCC060"}`, fontSize:12.5, fontWeight:600, color:loadState==="ok"?C.primary:loadState==="error"?C.red:C.yellow, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>{loadState==="ok"?"✅":loadState==="error"?"⚠":"⏳"} {loadMsg}</span>
          <button onClick={()=>setLoadMsg("")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:20 }}>×</button>
        </div>
      )}

      {/* Loading / Error */}
      {loadState==="loading"&&people.length===0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"70vh", flexDirection:"column", gap:16 }}>
          <div style={{ width:44, height:44, border:`3px solid ${C.border}`, borderTopColor:C.primary, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          <span style={{ color:C.muted, fontSize:14 }}>กำลังดึงข้อมูลจาก Google Sheets...</span>
        </div>
      )}
      {loadState==="error"&&people.length===0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"70vh", flexDirection:"column", gap:16, padding:32, textAlign:"center" }}>
          <div style={{ fontSize:48 }}>⚠️</div>
          <div style={{ color:C.text, fontSize:18, fontWeight:700 }}>โหลดข้อมูลไม่สำเร็จ</div>
          <div style={{ color:C.muted, fontSize:13, maxWidth:340, lineHeight:1.7 }}>{loadMsg.replace("โหลดไม่สำเร็จ: ","")}</div>
          <button onClick={fetchData} style={{ padding:"12px 28px", background:C.primary, border:"none", borderRadius:10, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>ลองใหม่</button>
        </div>
      )}

      {/* Stats + Search */}
      {people.length>0 && (
        <div style={{ padding:"10px 14px", background:"white", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:2, marginBottom:9, scrollbarWidth:"none" }}>
            {[
              { label:"ทั้งหมด",   v:stats.total,    color:C.teal,    f:"all"         },
              { label:"HR รับครบ", v:stats.complete, color:C.primary, f:"complete"    },
              { label:"รอ HR",     v:stats.gap,      color:C.orange,  f:"gap"         },
              { label:"กำลังส่ง",  v:stats.progress, color:C.teal,    f:"in_progress" },
              { label:"ยังไม่ส่ง", v:stats.pending,  color:C.yellow,  f:"pending"     },
            ].map(s=><StatPill key={s.f} {...s} active={filter===s.f} onClick={()=>setFilter(f=>f===s.f?"all":s.f)}/>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:9, background:C.cardAlt, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"9px 13px" }}>
            <span style={{ color:C.muted, fontSize:16 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ พื้นที่ ตำแหน่ง หัวหน้า..." style={{ background:"none", border:"none", outline:"none", color:C.text, fontSize:14, flex:1, fontFamily:"inherit" }}/>
            {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>×</button>}
          </div>
        </div>
      )}

      {/* ── Desktop: fixed two-pane ─────────────────────────────────────── */}
      {people.length>0 && (
        <div className="desktop-layout" style={{ display:"flex", height:"calc(100vh - 56px - 112px)" }}>
          <div style={{ width:340, borderRight:`1px solid ${C.border}`, overflowY:"auto", padding:"14px 12px", background:C.bg, flexShrink:0 }}>
            {filtered.length===0 && <div style={{ textAlign:"center", color:C.muted, padding:48, fontSize:14 }}>ไม่พบข้อมูล</div>}
            {filtered.map(p=><PersonCard key={p.name} person={p} selected={selected?.name===p.name} onClick={setSelected} dynDefs={dynDefs}/>)}
          </div>
          <div style={{ flex:1, padding:16, overflowY:"auto", background:C.bg, minWidth:0 }}>
            {currentPerson
              ?<DetailPanel person={currentPerson} role={role} onUpdate={handleDocUpdate} dynDefs={dynDefs}/>
              :<div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:14 }}>&#8592; เลือกพนักงานเพื่อดูรายละเอียด</div>
            }
          </div>
        </div>
      )}

      {/* ── Mobile: native page scroll — list ───────────────────────────── */}
      {people.length>0 && mobileView==="list" && (
        <div className="mobile-layout" style={{ padding:"12px 12px 100px", background:C.bg }}>
          {filtered.length===0 && <div style={{ textAlign:"center", color:C.muted, padding:48 }}>ไม่พบข้อมูล</div>}
          {filtered.map(p=>(
            <PersonCard key={p.name} person={p} selected={false}
              onClick={p=>{ setSelected(p); setMobileView("detail"); window.scrollTo({top:0,behavior:"instant"}); }}
              dynDefs={dynDefs}
            />
          ))}
        </div>
      )}

      {/* ── Mobile: native page scroll — detail ─────────────────────────── */}
      {people.length>0 && mobileView==="detail" && currentPerson && (
        <div className="mobile-layout" style={{ padding:"0 0 100px", background:C.bg }}>
          <DetailPanel
            person={currentPerson} role={role}
            onUpdate={handleDocUpdate} dynDefs={dynDefs}
            onBack={()=>{ setMobileView("list"); window.scrollTo({top:0,behavior:"instant"}); }}
          />
        </div>
      )}

      <style>{`
        .desktop-layout{ display:flex !important; }
        .mobile-layout { display:none !important; }
        @media (max-width: 700px) {
          .desktop-layout { display:none  !important; }
          .mobile-layout  { display:block !important; }
        }
        * { -webkit-overflow-scrolling: touch; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes slideUp { from{transform:translateY(100px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}
