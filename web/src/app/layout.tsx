import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kcontext",
  description: "Real Korean, Right in Context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
