import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 툴박스",
  description: "AI 도구 모음 (개인용)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
