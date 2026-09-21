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

// Single source for the three places each of these appears (page, Open
// Graph, Twitter) so they can't drift apart again.
const SITE_TITLE = "Backbeat: AI Soundtracks for Your Videos";
const SITE_DESCRIPTION =
  "Upload your video and Backbeat generates a custom AI soundtrack to match it. Keeps your original audio by default. No copyright strikes.";
// Absolute URL, and a versioned filename: social platforms cache preview
// images by URL for a long time, so a new image needs a new name
// (og-v3.png next time) rather than overwriting this one.
const OG_IMAGE_URL = "https://backbeat.video/og-v2.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://backbeat.video"),
  alternates: { canonical: "https://backbeat.video" },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/brand/favicon-gold.png",
    shortcut: "/brand/favicon-gold.png",
    apple: "/brand/favicon-gold.png",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://backbeat.video",
    siteName: "Backbeat",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <link
          rel="preload"
          href="/fonts/TAN-PEARL.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col text-white">
        <SessionProvider>
          <Navbar />
          <main className="flex-1 pt-16">{children}</main>
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
                <a href="/contact" className="hover:text-[#C8A96E] transition-colors">Contact Us</a>
              </div>
              <p>© 2026 Backbeat. All rights reserved.</p>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
