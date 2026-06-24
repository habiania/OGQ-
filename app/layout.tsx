import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OGQ AI 스티커 메이커",
  description: "사진 한 장으로 OGQ 스티커 세트 자동 생성 (개인용)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
