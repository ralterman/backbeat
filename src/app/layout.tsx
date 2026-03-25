import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: "Backbeat — AI Music for Video Creators",
  description:
    "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
  icons: {
    icon: "/brand/favicon-gold.png",
    shortcut: "/brand/favicon-gold.png",
    apple: "/brand/favicon-gold.png",
  },
  openGraph: {
    title: "Backbeat — AI Music for Video Creators",
    description:
      "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
    images: [
      {
        url: "/brand/logo-stacked.png",
        width: 4434,
        height: 3801,
        alt: "Backbeat",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Backbeat — AI Music for Video Creators",
    description:
      "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
    images: ["/brand/logo-stacked.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0A0A0A] text-white">
        <SessionProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Analytics />
          <SpeedInsights />
          <footer className="border-t border-[#1E1E1E] py-8 text-center text-[#9090aa] text-sm">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-3">
              <a href="/privacy" className="hover:text-[#C8A96E] transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-[#C8A96E] transition-colors">Terms of Service</a>
              <a href="/cookies" className="hover:text-[#C8A96E] transition-colors">Cookie Policy</a>
            </div>
            <p>© 2026 Backbeat. All rights reserved.</p>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
