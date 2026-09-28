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
// (og-v4.png next time) rather than overwriting this one.
// Composition is center-safe: all content sits inside the middle 630×630
// square, because some surfaces crop the 1200×630 card to a square.
const OG_IMAGE_URL = "https://backbeat.video/og-v3.png";
// Icons keep their conventional filenames (browsers and iOS probe for
// /favicon.ico and /apple-touch-icon.png by name), so cache-busting is a
// query string instead of a new filename. Bump when the artwork changes.
const ICON_BASE = "https://backbeat.video";
const ICON_V = "?v=2";

export const metadata: Metadata = {
  metadataBase: new URL("https://backbeat.video"),
  alternates: { canonical: "https://backbeat.video" },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Every icon is a true square (the old /brand/favicon-gold.png was 323×498,
  // which link-preview cards stretched into a square box). Opaque #0a0a0f
  // tile: the gold mark on a transparent background is ~2.3:1 against white
  // and washes out in light-mode tabs and light-theme previews.
  // There is deliberately no src/app/favicon.ico — Next would emit its own
  // relative, hashed <link> for it alongside these.
  icons: {
    icon: [
      { url: `${ICON_BASE}/favicon.ico${ICON_V}`, sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: `${ICON_BASE}/icon-32.png${ICON_V}`, sizes: "32x32", type: "image/png" },
      { url: `${ICON_BASE}/icon-192.png${ICON_V}`, sizes: "192x192", type: "image/png" },
      { url: `${ICON_BASE}/icon-512.png${ICON_V}`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: `${ICON_BASE}/apple-touch-icon.png${ICON_V}`, sizes: "180x180", type: "image/png" },
    ],
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
