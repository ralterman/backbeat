import type { Metadata } from "next";

// contact/page.tsx is a client component ("use client") and therefore can't
// export metadata itself; this thin server layout supplies the page title.
export const metadata: Metadata = {
  title: "Contact — Backbeat",
  description: "Questions, feedback, issues, feature ideas — we'd love to hear from you.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
