import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { ConditionalAnalytics } from "@/components/ConditionalAnalytics";
import { CookiePreferencesButton } from "@/components/CookiePreferencesButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://backbeat.me"),
  alternates: { canonical: "https://backbeat.me" },
  title: "Backbeat — Find the Perfect Music for Your Videos",
  description:
    "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
  icons: {
    icon: "/brand/favicon-gold.png",
    shortcut: "/brand/favicon-gold.png",
    apple: "/brand/favicon-gold.png",
  },
  openGraph: {
    title: "Backbeat — Find the Perfect Music for Your Videos",
    description:
      "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
    url: "https://backbeat.me",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Backbeat — Find the Perfect Music for Your Videos",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Backbeat — Find the Perfect Music for Your Videos",
    description:
      "Upload your video and get AI-powered background music recommendations. Find the perfect track in seconds.",
    images: ["/brand/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-white">
        <SessionProvider>
          <Navbar />
          {/* pt-20 = navbar height (h-16/64px) + safe clearance below it */}
          <main className="flex-1 pt-20">{children}</main>
          <ConditionalAnalytics />
          <footer className="border-t border-white/5 py-12 text-center text-[#9090aa] text-sm bg-gradient-to-t from-[#C8A96E]/5 to-transparent">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="mb-5" style={{ color: "#C8A96E", fontSize: "20px", fontWeight: 400, letterSpacing: "0.04em", fontFamily: "'TAN Pearl', serif" }}>
                Backbeat
              </p>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-5">
                <a href="/privacy" className="hover:text-[#C8A96E] transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-[#C8A96E] transition-colors">Terms of Service</a>
                <a href="/cookies" className="hover:text-[#C8A96E] transition-colors">Cookie Policy</a>
                <CookiePreferencesButton />
              </div>
              <p>© 2026 Backbeat. All rights reserved.</p>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
