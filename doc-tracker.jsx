import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — ดึงผ่าน CSV (ไม่ต้องใช้ API Key)
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_ID    = "1qfZP80vVrqbDua8pTbeJ-2tRpXQJ8HISKBNW14IKmt4";
const TRACKER_GID = "0";
const DOCS_GID    = "1911274135";

function csvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  return lines.map(line => {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample fallback
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PEOPLE = [
  { name:"สุทธิดา ธงกระโทก", area:"พระราม3_ถนนจันทร์_สาธร", position:"สาวบาวแดง", head:"เสฐจุฑี หมื่นเทพ",    hr:"พาส", reportDate:"25/5/2026", deadlineDate:"2/6/2026"  },
  { name:"ยศวีร์ จันทร์ตลาย", area:"ลาดกระบัง",              position:"ผู้ช่วยทีม",  head:"ชัยชนะ ดนกลาย",     hr:"ฝน",  reportDate:"25/5/2026", deadlineDate:"1/6/2026"  },
  { name:"ยูวี ดวงแก้ว",      area:"สีลม_บรรทัดทอง",         position:"สาวบาวแดง", head:"เกียรตินิยา เวสวรางกูร",hr:"ฝน", reportDate:"25/5/2026", deadlineDate:"1/6/2026"  },
  { name:"สุกฤตา ค่ายางเครือ",area:"เมืองปทุมธานี",           position:"สาวบาวแดง", head:"เอกพัน จำปา",        hr:"มาย", reportDate:"22/5/2026", deadlineDate:"30/5/2026" },
  { name:"อาภรณ์ สวัสดิ์",    area:"พัทยากลาง_พัทยาใต้",     position:"สาวบาวแดง", head:"พลัส พิมพ์เบาธรรม",   hr:"ฝน",  reportDate:"25/5/2026", deadlineDate:"1/6/2026"  },
  { name:"กนกลักษณ์ เพชรงาม", area:"พัทยากลาง_พัทยาใต้",     position:"สาวบาวแดง", head:"พลัส พิมพ์เบาธรรม",   hr:"ฝน",  reportDate:"25/5/2026", deadlineDate:"1/6/2026"  },
  { name:"สมแดช พรมเชย",      area:"อ่างศิลา",                position:"มั้วเร็ว",   head:"มนูญ กลิ่นสันเทียะ",  hr:"มาย", reportDate:"25/5/2026", deadlineDate:"1/6/2026"  },
  { name:"พัชญา สาวเสม",      area:"หนองปรือ",                position:"สาวบาวแดง", head:"ถุชากร มานะพรชัย",    hr:"มาย", reportDate:"24/5/2026", deadlineDate:"1/6/2026"  },
  { name:"พัชรา สิมลี",       area:"ลาดพร้าว",                position:"สาวบาวแดง", head:"นิติกร เหมเหนาม",     hr:"มาย", reportDate:"25/5/2026", deadlineDate:"2/6/2026"  },
  { name:"ศิริโชค เชื่อเฉลิม",area:"เดหะบางพลี",              position:"ผู้ช่วยทีม",  head:"ศรีวินี เมืองจันทร์",  hr:"ฝน",  reportDate:"28/5/2026", deadlineDate:"4/6/2026"  },
  { name:"ชไมพร สาถัว",       area:"นิคมอมตะชนคร",            position:"สาวบาวแดง", head:"นันทิดา โฉมตระการ",    hr:"โจ",  reportDate:"26/5/2026", deadlineDate:"2/6/2026"  },
];

// เอกสาร default ต่อตำแหน่ง (ใช้ถ้าโหลด sheet รายการเอกสารไม่ได้)
const DEFAULT_DOC_DEFS = {
  "สาวบาวแดง": [
    {id:"insurance_soc",label:"ประกันสังคม",required:true},
    {id:"insurance_mth",label:"ประกันเมืองไทย",required:true},
    {id:"insurance_tip",label:"ประกันทิพย์",required:true},
    {id:"provident",label:"กองทุนสำรองเลี้ยงชีพ",required:true},
    {id:"application",label:"ใบสมัคร",required:true},
    {id:"pdpa",label:"PDPA",required:true},
    {id:"id_card",label:"บัตรประชาชน",required:true},
    {id:"house_reg",label:"ทะเบียนบ้าน",required:true},
    {id:"edu_cert",label:"วุฒิการศึกษา",required:true},
    {id:"military",label:"ใบเกณฑ์ทหาร",required:false},
    {id:"bank_kasikorn",label:"บัญชีกสิกรไทย",required:true},
    {id:"company_cert",label:"ใบซบซิ (อายุมากกว่า 1 ปี)",required:false},
    {id:"drug_test",label:"ตรวจสารเสพติด",required:true},
    {id:"pregnancy_test",label:"ตรวจตั้งครรภ์",required:true},
    {id:"contract",label:"สัญญาจ้าง",required:true},
  ],
  "ผู้ช่วยทีม": [
    {id:"insurance_soc",label:"ประกันสังคม",required:true},
    {id:"insurance_mth",label:"ประกันเมืองไทย",required:true},
    {id:"insurance_tip",label:"ประกันทิพย์",required:true},
    {id:"provident",label:"กองทุนสำรองเลี้ยงชีพ",required:true},
    {id:"application",label:"ใบสมัคร",required:true},
    {id:"pdpa",label:"PDPA",required:true},
    {id:"id_card",label:"บัตรประชาชน",required:true},
    {id:"house_reg",label:"ทะเบียนบ้าน",required:true},
    {id:"edu_cert",label:"วุฒิการศึกษา",required:true},
    {id:"military",label:"ใบเกณฑ์ทหาร",required:false},
    {id:"bank_kasikorn",label:"บัญชีกสิกรไทย",required:true},
    {id:"company_cert",label:"ใบซบซิ (อายุมากกว่า 1 ปี)",required:false},
    {id:"drug_test",label:"ตรวจสารเสพติด",required:true},
    {id:"pregnancy_test",label:"ตรวจตั้งครรภ์",required:false},
    {id:"contract",label:"สัญญาจ้าง",required:true},
  ],
  "มั้วเร็ว": [
    {id:"insurance_soc",label:"ประกันสังคม",required:true},
    {id:"insurance_mth",label:"ประกันเมืองไทย",required:true},
    {id:"insurance_tip",label:"ประกันทิพย์",required:true},
    {id:"provident",label:"กองทุนสำรองเลี้ยงชีพ",required:true},
    {id:"application",label:"ใบสมัคร",required:true},
    {id:"pdpa",label:"PDPA",required:true},
    {id:"id_card",label:"บัตรประชาชน",required:true},
    {id:"house_reg",label:"ทะเบียนบ้าน",required:true},
    {id:"edu_cert",label:"วุฒิการศึกษา",required:true},
    {id:"military",label:"ใบเกณฑ์ทหาร",required:true},
    {id:"bank_kasikorn",label:"บัญชีกสิกรไทย",required:true},
    {id:"company_cert",label:"ใบซบซิ (อายุมากกว่า 1 ปี)",required:false},
    {id:"drug_test",label:"ตรวจสารเสพติด",required:true},
    {id:"pregnancy_test",label:"ตรวจตั้งครรภ์",required:true},
    {id:"contract",label:"สัญญาจ้าง",required:true},
  ],
};

function getDocsForPosition(pos, dynamicDefs) {
  if (dynamicDefs && Object.keys(dynamicDefs).length > 0) {
    // ค้นหา key ที่ match (case-insensitive, trim)
    const key = Object.keys(dynamicDefs).find(k => k.trim() === pos.trim());
    if (key) return dynamicDefs[key];
  }
  return DEFAULT_DOC_DEFS[pos] || DEFAULT_DOC_DEFS["สาวบาวแดง"];
}

function initDocState(docDefs) {
  const s = {};
  docDefs.forEach(d => { s[d.id] = { fieldSent:false, fieldSentAt:null, hrReceived:false, hrReceivedAt:null, trackingNo:"", note:"" }; });
  return s;
}

function calcProgress(docDefs, docState) {
  const req = docDefs.filter(d => d.required);
  const sent = req.filter(d => docState[d.id]?.fieldSent).length;
  const recv = req.filter(d => docState[d.id]?.hrReceived).length;
  return { sent, recv, total: req.length, sentPct: Math.round(sent/req.length*100), recvPct: Math.round(recv/req.length*100) };
}

function calcStatus(docDefs, docState) {
  const req = docDefs.filter(d => d.required);
  if (req.every(d => docState[d.id]?.hrReceived)) return "complete";
  if (req.some(d => docState[d.id]?.fieldSent && !docState[d.id]?.hrReceived)) return "gap";
  if (req.some(d => docState[d.id]?.fieldSent)) return "in_progress";
  return "pending";
}

function todayStr() {
  return new Date().toLocaleDateString("th-TH",{day:"2-digit",month:"2-digit",year:"numeric"});
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:"#080c14", surface:"#0f1520", card:"#141b2a", card2:"#192035",
  border:"#1e2d45", borderHi:"#2a3f60",
  accent:"#3b82f6", accentLo:"rgba(59,130,246,0.12)",
  green:"#22c55e", greenLo:"rgba(34,197,94,0.1)",
  orange:"#f97316", orangeLo:"rgba(249,115,22,0.1)",
  red:"#ef4444", redLo:"rgba(239,68,68,0.1)",
  yellow:"#eab308", yellowLo:"rgba(234,179,8,0.1)",
  purple:"#8b5cf6", purpleLo:"rgba(139,92,246,0.1)",
  text:"#e2e8f0", textSoft:"#94a3b8", muted:"#475569",
};

const statusMeta = s => ({
  complete:    { label:"HR รับครบ ✓",    color:C.green,  bg:C.greenLo  },
  gap:         { label:"รอ HR ยืนยัน",   color:C.orange, bg:C.orangeLo },
  in_progress: { label:"กำลังส่ง",        color:C.accent, bg:C.accentLo },
  pending:     { label:"ยังไม่ส่ง",       color:C.yellow, bg:C.yellowLo },
}[s] || {label:s,color:C.muted,bg:"transparent"});

function Bar({ pct, color }) {
  return (
    <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2,transition:"width .5s"}}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PersonCard
// ─────────────────────────────────────────────────────────────────────────────
function PersonCard({ person, selected, onClick, dynamicDefs }) {
  const docs = getDocsForPosition(person.position, dynamicDefs);
  const prog = calcProgress(docs, person.docState);
  const st   = calcStatus(docs, person.docState);
  const sm   = statusMeta(st);
  return (
    <div onClick={() => onClick(person)} style={{
      background: selected ? C.accentLo : C.card,
      border:`1.5px solid ${selected ? C.accent : C.border}`,
      borderRadius:12, padding:"12px 14px", cursor:"pointer", transition:"all .18s",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{color:C.text,fontWeight:700,fontSize:13}}>{person.name}</div>
          <div style={{color:C.muted,fontSize:11,marginTop:2}}>{person.position} · {person.area.split("_")[0]}</div>
        </div>
        <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sm.bg,color:sm.color,whiteSpace:"nowrap"}}>{sm.label}</span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:4}}>
        {[
          {label:`ส่ง ${prog.sent}/${prog.total}`, pct:prog.sentPct, color:C.accent},
          {label:`รับ ${prog.recv}/${prog.total}`, pct:prog.recvPct, color:C.green},
        ].map(b => (
          <div key={b.label} style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.muted,marginBottom:2}}>
              <span>{b.label}</span><span style={{color:b.color}}>{b.pct}%</span>
            </div>
            <Bar pct={b.pct} color={b.color}/>
          </div>
        ))}
      </div>
      <div style={{fontSize:10,color:C.muted}}>กำหนด: <span style={{color:C.textSoft}}>{person.deadlineDate}</span> · HR: {person.hr}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckRow
// ─────────────────────────────────────────────────────────────────────────────
function CheckRow({ docDef, state, role, onToggleField, onToggleHR, onTracking, onNote }) {
  const [openT, setOpenT] = useState(false);
  const [trackVal, setTrackVal] = useState(state.trackingNo || "");
  const [openN, setOpenN] = useState(false);
  const [noteVal, setNoteVal] = useState(state.note || "");

  const gap     = state.fieldSent && !state.hrReceived;
  const rowBg   = state.hrReceived ? C.greenLo : gap ? C.orangeLo : "transparent";
  const rowBord = state.hrReceived ? C.green+"33" : gap ? C.orange+"44" : C.border;

  return (
    <div style={{borderRadius:9,border:`1px solid ${rowBord}`,background:rowBg,marginBottom:5,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{color:state.hrReceived?C.green:C.text,fontSize:12,fontWeight:500}}>{docDef.label}</span>
            {!docDef.required && <span style={{color:C.muted,fontSize:9,border:`1px solid ${C.border}`,borderRadius:4,padding:"0 4px"}}>ไม่บังคับ</span>}
            {gap && <span style={{color:C.orange,fontSize:10,fontWeight:700}}>⚠ รอ HR</span>}
            {state.trackingNo && <span style={{color:C.purple,fontSize:10,background:C.purpleLo,borderRadius:4,padding:"0 5px"}}>📦 {state.trackingNo}</span>}
          </div>
          <div style={{color:C.muted,fontSize:9,marginTop:1}}>
            {state.fieldSentAt && <span>📤 {state.fieldSentAt}</span>}
            {state.hrReceivedAt && <span> · ✅ HR รับ {state.hrReceivedAt}</span>}
            {state.note && <span> · 💬 {state.note}</span>}
          </div>
        </div>

        {/* Field checkbox */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:52}}>
          <span style={{fontSize:8,color:C.muted}}>🚗 ภาคสนาม</span>
          <div
            onClick={() => role==="field" && onToggleField()}
            style={{
              width:26,height:26,borderRadius:7,
              border:`2px solid ${state.fieldSent?C.accent:C.borderHi}`,
              background:state.fieldSent?C.accent:"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
              cursor:role==="field"?"pointer":"default",
              transition:"all .15s",color:"#fff",fontSize:14,fontWeight:700,
            }}
          >{state.fieldSent?"✓":""}</div>
          <span style={{fontSize:8,color:state.fieldSent?C.accent:C.muted}}>{state.fieldSent?"ส่งแล้ว":"ยังไม่ส่ง"}</span>
        </div>

        <span style={{color:C.muted,fontSize:14}}>›</span>

        {/* HR checkbox */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:52}}>
          <span style={{fontSize:8,color:C.muted}}>🏢 HR รับ</span>
          <div
            onClick={() => role==="hr" && state.fieldSent && onToggleHR()}
            style={{
              width:26,height:26,borderRadius:7,
              border:`2px solid ${state.hrReceived?C.green:state.fieldSent?C.orange:C.border}`,
              background:state.hrReceived?C.green:"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",
              cursor:role==="hr"&&state.fieldSent?"pointer":"default",
              opacity:role==="hr"&&!state.fieldSent?0.35:1,
              transition:"all .15s",color:"#fff",fontSize:14,fontWeight:700,
            }}
          >{state.hrReceived?"✓":""}</div>
          <span style={{fontSize:8,color:state.hrReceived?C.green:state.fieldSent?C.orange:C.muted}}>
            {state.hrReceived?"รับแล้ว":state.fieldSent?"รอรับ":"รอส่ง"}
          </span>
        </div>

        {/* tracking btn (field only) */}
        {role==="field" && (
          <button onClick={() => setOpenT(v=>!v)} style={{
            background:state.trackingNo?C.purpleLo:"transparent",
            border:`1px solid ${state.trackingNo?C.purple:C.border}`,
            borderRadius:6,color:state.trackingNo?C.purple:C.muted,
            fontSize:10,cursor:"pointer",padding:"3px 7px",fontFamily:"inherit",
          }}>📦</button>
        )}
        <button onClick={() => setOpenN(v=>!v)} style={{
          background:state.note?C.accentLo:"transparent",
          border:`1px solid ${state.note?C.accent:C.border}`,
          borderRadius:6,color:state.note?C.accent:C.muted,
          fontSize:10,cursor:"pointer",padding:"3px 7px",fontFamily:"inherit",
        }}>📝</button>
      </div>

      {openT && role==="field" && (
        <div style={{padding:"0 12px 10px",display:"flex",gap:8}}>
          <input value={trackVal} onChange={e=>setTrackVal(e.target.value)}
            placeholder="เลขเทรคกิ้ง เช่น TH12345678, EMS001234"
            style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={() => {onTracking(trackVal);setOpenT(false);}}
            style={{background:C.purple,border:"none",borderRadius:7,color:"#fff",padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>บันทึก</button>
        </div>
      )}
      {openN && (
        <div style={{padding:"0 12px 10px",display:"flex",gap:8}}>
          <input value={noteVal} onChange={e=>setNoteVal(e.target.value)}
            placeholder="หมายเหตุ..."
            style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 10px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={() => {onNote(noteVal);setOpenN(false);}}
            style={{background:C.accent,border:"none",borderRadius:7,color:"#fff",padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>บันทึก</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailPanel
// ─────────────────────────────────────────────────────────────────────────────
function DetailPanel({ person, role, onUpdate, dynamicDefs }) {
  const docs  = getDocsForPosition(person.position, dynamicDefs);
  const prog  = calcProgress(docs, person.docState);
  const st    = calcStatus(docs, person.docState);
  const sm    = statusMeta(st);

  const notSent    = docs.filter(d=>d.required && !person.docState[d.id]?.fieldSent).length;
  const sentNotRcv = docs.filter(d=>d.required && person.docState[d.id]?.fieldSent && !person.docState[d.id]?.hrReceived).length;
  const missingTrk = docs.filter(d=>person.docState[d.id]?.fieldSent && !person.docState[d.id]?.trackingNo).length;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
      {/* header */}
      <div style={{padding:"16px 20px",background:C.surface,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{color:C.muted,fontSize:11}}>{person.position} · {person.area.replace(/_/g," ")}</div>
            <div style={{color:C.text,fontSize:18,fontWeight:800,margin:"2px 0"}}>{person.name}</div>
            <div style={{color:C.textSoft,fontSize:12}}>หัวหน้า: {person.head} · HR: {person.hr}</div>
          </div>
          <span style={{padding:"4px 12px",borderRadius:20,background:sm.bg,color:sm.color,fontSize:11,fontWeight:700}}>{sm.label}</span>
        </div>
        <div style={{display:"flex",gap:12,marginBottom:10}}>
          {[
            {label:`🚗 ภาคสนามส่ง ${prog.sent}/${prog.total}`,pct:prog.sentPct,color:C.accent},
            {label:`🏢 HR รับ ${prog.recv}/${prog.total}`,     pct:prog.recvPct,color:C.green},
          ].map(b => (
            <div key={b.label} style={{flex:1,background:C.card,borderRadius:8,padding:"8px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:11,color:C.textSoft}}>{b.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:b.color}}>{b.pct}%</span>
              </div>
              <Bar pct={b.pct} color={b.color}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {notSent>0    && <span style={{padding:"3px 10px",borderRadius:8,background:C.redLo,   border:`1px solid ${C.red}44`,   color:C.red,   fontSize:10,fontWeight:700}}>⚠ ยังไม่ส่ง {notSent} รายการ</span>}
          {sentNotRcv>0 && <span style={{padding:"3px 10px",borderRadius:8,background:C.orangeLo,border:`1px solid ${C.orange}44`,color:C.orange,fontSize:10,fontWeight:700}}>📬 รอ HR ยืนยัน {sentNotRcv} รายการ</span>}
          {role==="field"&&missingTrk>0 && <span style={{padding:"3px 10px",borderRadius:8,background:C.purpleLo,border:`1px solid ${C.purple}44`,color:C.purple,fontSize:10,fontWeight:700}}>📦 ยังไม่กรอกเทรคกิ้ง {missingTrk} รายการ</span>}
          {notSent===0&&sentNotRcv===0 && <span style={{padding:"3px 10px",borderRadius:8,background:C.greenLo,border:`1px solid ${C.green}44`,color:C.green,fontSize:10,fontWeight:700}}>✅ เอกสารครบทุกรายการ</span>}
        </div>
      </div>

      {/* legend */}
      <div style={{padding:"7px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:16,fontSize:10,color:C.muted,flexWrap:"wrap"}}>
        <span style={{color:C.accent}}>■ ภาคสนามส่ง</span>
        <span style={{color:C.green}}>■ HR รับแล้ว</span>
        <span style={{color:C.orange}}>■ รอ HR ยืนยัน</span>
        <span style={{color:C.purple}}>📦 เลขเทรคกิ้ง</span>
        {role==="field" ? <span>· คลิก ☐ ซ้ายเพื่อบันทึกส่ง · กด 📦 ใส่เลขส่ง</span>
                        : <span>· คลิก ☐ ขวาเพื่อยืนยันรับเอกสาร</span>}
      </div>

      {/* checklist */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 20px"}}>
        {docs.map(doc => (
          <CheckRow key={doc.id} docDef={doc} state={person.docState[doc.id]||{}} role={role}
            onToggleField={() => onUpdate(person.name, doc.id, "field")}
            onToggleHR={()    => onUpdate(person.name, doc.id, "hr")}
            onTracking={v     => onUpdate(person.name, doc.id, "tracking", v)}
            onNote={v         => onUpdate(person.name, doc.id, "note", v)}
          />
        ))}
      </div>

      <div style={{padding:"10px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:20,fontSize:11,color:C.muted}}>
        <span>📅 รายงานตัว: <b style={{color:C.textSoft}}>{person.reportDate}</b></span>
        <span>⏰ กำหนดครบ: <b style={{color:C.textSoft}}>{person.deadlineDate}</b></span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole]           = useState("hr");
  const [people, setPeople]       = useState([]);
  const [dynamicDefs, setDynDefs] = useState({});
  const [selected, setSelected]   = useState(null);
  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [loadMsg, setLoadMsg]     = useState("");
  const [usingReal, setUsingReal] = useState(false);

  // ── โหลดจาก Google Sheets CSV (ไม่ต้อง API Key) ──────────────────────────
  const loadSheets = useCallback(async () => {
    setLoading(true);
    setLoadMsg("กำลังดึงข้อมูลจาก Google Sheets...");
    try {
      // --- Sheet 1: รายชื่อ ---
      const r1 = await fetch(csvUrl(TRACKER_GID));
      if (!r1.ok) throw new Error("ไม่สามารถเข้าถึง Sheet ได้ — กรุณาตั้งค่า Sheet เป็น 'Anyone with link can view'");
      const csv1 = await r1.text();
      const rows1 = parseCSV(csv1).slice(1).filter(r => r[0] && r[0].trim());

      // --- Sheet 2: รายการเอกสาร ---
      const r2 = await fetch(csvUrl(DOCS_GID));
      const csv2 = await r2.text();
      const rows2 = parseCSV(csv2);

      // parse doc sheet: row0=header(รายการ, col1=ตำแหน่ง1, col2=ตำแหน่ง2, ...)
      // row1 = positions, row2+ = docs
      const positions = rows2[1]?.slice(1).filter(Boolean) || [];
      const docRows   = rows2.slice(2);
      const defs = {};
      positions.forEach((pos, pi) => {
        if (!pos.trim()) return;
        defs[pos.trim()] = docRows
          .filter(r => r[0]?.trim())
          .map((r, i) => ({
            id: `doc_${i}`,
            label: r[0].trim(),
            required: (r[pi+1]||"").trim() === "จำเป็น",
          }));
      });

      // build people
      const loaded = rows1.map(r => {
        const pos = r[2]?.trim() || "สาวบาวแดง";
        const docDefs = defs[pos] || DEFAULT_DOC_DEFS[pos] || DEFAULT_DOC_DEFS["สาวบาวแดง"];
        return {
          name:         r[0]?.trim() || "",
          area:         r[1]?.trim() || "",
          position:     pos,
          head:         r[3]?.trim() || "",
          hr:           r[4]?.trim() || "",
          reportDate:   r[5]?.trim() || "",
          deadlineDate: r[6]?.trim() || "",
          docState:     initDocState(docDefs),
        };
      }).filter(p => p.name);

      setDynDefs(defs);
      setPeople(loaded);
      setSelected(loaded[0] || null);
      setUsingReal(true);
      setLoadMsg(`✅ โหลดสำเร็จ ${loaded.length} คน จาก Google Sheets`);
    } catch(e) {
      setLoadMsg("⚠ " + e.message + " — แสดงข้อมูลตัวอย่างแทน");
      useSample();
    } finally {
      setLoading(false);
    }
  }, []);

  function useSample() {
    const p = SAMPLE_PEOPLE.map(r => ({ ...r, docState: initDocState(DEFAULT_DOC_DEFS[r.position] || DEFAULT_DOC_DEFS["สาวบาวแดง"]) }));
    setPeople(p);
    setSelected(p[0]);
    setDynDefs({});
    setUsingReal(false);
  }

  useEffect(() => { useSample(); }, []);

  function handleUpdate(personName, docId, action, value) {
    setPeople(prev => prev.map(p => {
      if (p.name !== personName) return p;
      const d = { ...p.docState[docId] };
      if (action==="field")    { d.fieldSent=!d.fieldSent; d.fieldSentAt=d.fieldSent?todayStr():null; if(!d.fieldSent){d.hrReceived=false;d.hrReceivedAt=null;} }
      else if (action==="hr") { d.hrReceived=!d.hrReceived; d.hrReceivedAt=d.hrReceived?todayStr():null; }
      else if (action==="tracking") { d.trackingNo=value; }
      else if (action==="note")     { d.note=value; }
      return { ...p, docState:{ ...p.docState, [docId]:d } };
    }));
  }

  useEffect(() => {
    if (selected) { const up=people.find(p=>p.name===selected.name); if(up) setSelected(up); }
  }, [people]);

  const withSt   = people.map(p => ({...p, _st: calcStatus(getDocsForPosition(p.position,dynamicDefs), p.docState)}));
  const filtered = withSt.filter(p => {
    const mf = filter==="all" || p._st===filter;
    const ms = p.name.includes(search) || p.area.includes(search) || p.position.includes(search) || p.hr.includes(search);
    return mf && ms;
  });

  const stats = {
    total:       people.length,
    complete:    withSt.filter(p=>p._st==="complete").length,
    gap:         withSt.filter(p=>p._st==="gap").length,
    in_progress: withSt.filter(p=>p._st==="in_progress").length,
    pending:     withSt.filter(p=>p._st==="pending").length,
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",color:C.text}}>

      {/* NAV */}
      <div style={{height:54,padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:200}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📂</div>
          <div>
            <div style={{fontWeight:800,fontSize:14}}>DocTrack HR</div>
            <div style={{color:C.muted,fontSize:9}}>
              {usingReal ? <span style={{color:C.green}}>● เชื่อม Google Sheets แล้ว</span> : <span style={{color:C.yellow}}>● ข้อมูลตัวอย่าง</span>}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button
            onClick={loadSheets}
            disabled={loading}
            style={{
              padding:"5px 14px",borderRadius:8,border:`1px solid ${C.accent}`,
              background:C.accentLo,color:C.accent,
              fontSize:11,cursor:loading?"wait":"pointer",fontFamily:"inherit",fontWeight:600,
            }}
          >{loading ? "⏳ กำลังโหลด..." : "🔄 ดึงข้อมูลจาก Sheets"}</button>
          <button onClick={useSample} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.card,color:C.textSoft,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>ตัวอย่าง</button>
          <div style={{display:"flex",background:C.bg,borderRadius:9,padding:3,border:`1px solid ${C.border}`}}>
            {[{id:"hr",label:"🏢 HR"},{id:"field",label:"🚗 ภาคสนาม"}].map(r=>(
              <button key={r.id} onClick={()=>setRole(r.id)} style={{padding:"4px 14px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"inherit",background:role===r.id?C.accent:"transparent",color:role===r.id?"#fff":C.muted,fontWeight:role===r.id?700:400,fontSize:12,transition:"all .18s"}}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* load status bar */}
      {loadMsg && (
        <div style={{padding:"7px 20px",background:loadMsg.startsWith("✅")?C.greenLo:loadMsg.startsWith("⚠")?C.orangeLo:C.accentLo,borderBottom:`1px solid ${C.border}`,fontSize:12,color:loadMsg.startsWith("✅")?C.green:loadMsg.startsWith("⚠")?C.orange:C.accent,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{loadMsg}</span>
          <button onClick={()=>setLoadMsg("")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>×</button>
        </div>
      )}

      {/* STATS */}
      <div style={{padding:"8px 20px",display:"flex",gap:8,background:C.surface,borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
        {[
          {label:"ทั้งหมด",   v:stats.total,       color:C.accent, f:"all"},
          {label:"HR รับครบ", v:stats.complete,    color:C.green,  f:"complete"},
          {label:"รอ HR ยืนยัน",v:stats.gap,      color:C.orange, f:"gap"},
          {label:"กำลังส่ง",  v:stats.in_progress, color:C.accent, f:"in_progress"},
          {label:"ยังไม่ส่ง", v:stats.pending,     color:C.yellow, f:"pending"},
        ].map(s=>(
          <div key={s.f} onClick={()=>setFilter(f=>f===s.f?"all":s.f)} style={{padding:"5px 12px",borderRadius:9,cursor:"pointer",transition:"all .18s",background:filter===s.f?`${s.color}20`:C.card,border:`1px solid ${filter===s.f?s.color:C.border}`,display:"flex",alignItems:"center",gap:6}}>
            <span style={{color:s.color,fontWeight:800,fontSize:16}}>{s.v}</span>
            <span style={{color:C.textSoft,fontSize:11}}>{s.label}</span>
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:7,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"5px 12px"}}>
          <span style={{color:C.muted}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ พื้นที่ ตำแหน่ง HR..." style={{background:"none",border:"none",outline:"none",color:C.text,fontSize:12,width:170,fontFamily:"inherit"}}/>
        </div>
      </div>

      {/* MAIN */}
      <div style={{display:"flex",height:"calc(100vh - 120px)"}}>
        <div style={{width:320,borderRight:`1px solid ${C.border}`,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:7}}>
          {filtered.length===0 && <div style={{textAlign:"center",color:C.muted,padding:40,fontSize:13}}>ไม่พบข้อมูล</div>}
          {filtered.map(p=>(
            <PersonCard key={p.name} person={p} selected={selected?.name===p.name} onClick={setSelected} dynamicDefs={dynamicDefs}/>
          ))}
        </div>
        <div style={{flex:1,padding:16,overflowY:"auto"}}>
          {selected
            ? <DetailPanel person={people.find(p=>p.name===selected.name)||selected} role={role} onUpdate={handleUpdate} dynamicDefs={dynamicDefs}/>
            : <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>เลือกพนักงานเพื่อดูรายละเอียด</div>
          }
        </div>
      </div>
    </div>
  );
}
