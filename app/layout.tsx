import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Amyrica 旅費",
    template: "%s · Amyrica 旅費",
  },
  description: "Aston × Amy 美國畢業旅行 · 記帳 + 分帳",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Amyrica 旅費",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
