import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kcontext · YouTube로 배우는 한국어",
  description: "Learn Korean through authentic YouTube videos. Watch, listen, and study with interactive transcripts and vocabulary flashcards.",
  keywords: ["Korean", "한국어", "language learning", "K-drama", "vocabulary"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
