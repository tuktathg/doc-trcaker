import "./globals.css";

export const metadata = {
  title: "DocTrack HR",
  description: "ระบบติดตามเอกสารพนักงานใหม่",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
