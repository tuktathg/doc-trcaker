# DocTrack HR — ระบบติดตามเอกสารพนักงานใหม่

## วิธี Deploy บน Vercel (ฟรี, ตั้งครั้งเดียว ~10 นาที)

### ขั้นตอนที่ 1 — อัปโหลดโค้ดขึ้น GitHub

1. ไปที่ [github.com](https://github.com) → สร้าง repository ใหม่ชื่อ `doctrack`
2. ดาวน์โหลดโฟลเดอร์นี้แล้วอัปโหลดทั้งหมด หรือใช้ Git:

```bash
git init
git add .
git commit -m "init doctrack"
git remote add origin https://github.com/YOUR_USERNAME/doctrack.git
git push -u origin main
```

### ขั้นตอนที่ 2 — Deploy บน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → Sign up ด้วย GitHub (ฟรี)
2. กด **"Add New Project"** → เลือก repository `doctrack`
3. กด **Deploy** — รอ ~2 นาที
4. ได้ URL เช่น `https://doctrack-xxx.vercel.app` ← ใช้งานได้เลย!

### ขั้นตอนที่ 3 — ใช้งาน

- เปิด URL ที่ได้ → ระบบดึงข้อมูลจาก Google Sheets อัตโนมัติ
- กด 🔄 รีเฟรชทุกครั้งที่มีรายชื่อใหม่
- สลับโหมด HR / ภาคสนาม ที่มุมขวาบน

## โครงสร้างโปรเจกต์

```
doctrack/
├── app/
│   ├── api/sheets/route.js   ← proxy ดึง Sheets (ไม่ติด CORS)
│   ├── page.js               ← UI หลัก
│   ├── layout.js
│   └── globals.css
├── lib/
│   └── parsers.js            ← parse ข้อมูลจาก Sheet
├── package.json
└── next.config.js
```

## หากต้องการเปลี่ยน Apps Script URL

แก้ไขไฟล์ `app/api/sheets/route.js` บรรทัด:
```js
const SCRIPT_URL = "https://script.google.com/macros/s/...";
```
