import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "衡鑑 | 雙重重大性評估平台",
  description: "高等教育雙重重大性評估與利害關係人參與平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

