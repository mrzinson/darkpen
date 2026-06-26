import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0084FF",
};

export const metadata: Metadata = {
  title: "Darkpen — AI Assistant for Somali Students",
  description: "Darkpen is your AI-powered study assistant. Chat, revise exams, read books, and connect with your community — all in one app.",
  keywords: ["Darkpen", "Somali AI", "study assistant", "exams", "books"],
  appleWebApp: {
    capable: true,
    title: "Darkpen",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/darkpen-logo-blue.png",
    apple: "/darkpen-logo-blue.png",
  },
};

import { ThemeProvider } from "./context/ThemeContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
