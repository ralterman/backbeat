import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backbeat — AI Music for Video Creators",
  description:
    "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0A0A0A] text-white">
        <SessionProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[#1E1E1E] py-8 text-center text-[#3a3a5a] text-sm">
            <p>© {new Date().getFullYear()} Backbeat. AI-powered music for video creators.</p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
