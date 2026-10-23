import type { Metadata } from "next";
import { PricingCard } from "@/components/PricingCard";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — Backbeat",
  description: "Start free and upgrade when you need more. All plans include AI video analysis and custom music generation.",
};

const FREE_FEATURES = [
  { text: "1 free video analysis, lifetime", included: true },
  { text: "1 AI-generated soundtrack, first 60 seconds of your video", included: true },
  { text: "Preview synced to your video (first 60 seconds)", included: true },
  { text: "Watermarked export of the first 60 seconds", included: true },
  { text: "Full-length, no-watermark exports", included: false },
];

const CREATOR_FEATURES = [
  { text: "15 video analyses per month", included: true },
  { text: "Up to 4 AI-generated soundtrack options per analysis", included: true },
  { text: "Full preview synced to your video", included: true },
  { text: "No-watermark exports", included: true },
];

// Marketed as "Pro"; the internal plan id is still TEAM (see src/lib/plans.ts).
const PRO_FEATURES = [
  { text: "40 video analyses per month", included: true },
  { text: "Up to 6 AI-generated soundtrack options per analysis", included: true },
  { text: "Full preview synced to your video", included: true },
  { text: "No-watermark exports", included: true },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancellations take effect at the end of your billing period. You keep full access until then.",
  },
  {
    q: "What file formats are supported?",
    a: "We support MP4, MOV, AVI, and MKV files up to 150 MB per video. Larger files aren't supported yet — trim or compress first.",
  },
  {
    q: "Are the tracks licensed for commercial use?",
    a: "Free-tier exports cover the first 60 seconds and are watermarked. All exports, free and paid, are cleared for commercial use online and offline, including social media and advertising, except film, TV, radio and games, which need separate licensing. The music is produced by ElevenLabs' Music API; see elevenlabs.io/music-rights for the full terms.",
  },
  {
    q: "What does the analysis count as?",
    a: "Each video you upload and run through AI analysis counts as one analysis. Previewing tracks and exporting do not count.",
  },
  {
    q: "What is the watermark on free exports?",
    a: "Free tier exports cover the first 60 seconds of your video and include a subtle Backbeat text overlay. Upgrade to Creator or Pro to export the full video without any watermark.",
  },
  {
    q: "How good is the AI-generated music?",
    a: "Backbeat uses Claude to deeply analyze your video's mood, energy, pacing, and scene context, then generates a soundtrack via ElevenLabs. Each generation is unique to your video. The free tier gets one track per analysis, covering the first 60 seconds of the video. Paid plans get two distinct full-length options per analysis and, if neither fits, can regenerate two more without using another analysis — Creator up to 4 options per video, Pro up to 6.",
  },
];

export default function PricingPage() {
  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-[#a0a0b8] text-lg max-w-2xl mx-auto">
            Start free and upgrade when you need more. All plans include AI video analysis and custom music generation.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mb-20">
          <PricingCard
            name="Try it free"
            price={0}
            priceSuffix=""
            description="One free analysis, first 60 seconds, no card needed"
            features={FREE_FEATURES}
            cta="Try it free"
            ctaHref="/auth/signup"
          />
          <PricingCard
            name="Creator"
            price={15}
            priceSuffix="/mo"
            description="For active video creators"
            features={CREATOR_FEATURES}
            cta="Start Creator plan"
            ctaHref="/api/stripe/checkout?plan=creator"
            highlighted
            badge="Recommended"
            priceNote="Introductory price — lock it in now."
          />
          <PricingCard
            name="Pro"
            price={39}
            priceSuffix="/mo"
            description="For high-volume creators"
            features={PRO_FEATURES}
            cta="Start Pro plan"
            ctaHref="/api/stripe/checkout?plan=team"
          />
        </div>

        {/* Licensing note — mirrors Terms §6 */}
        <p className="text-center text-[#9090aa] text-sm max-w-2xl mx-auto -mt-8 mb-3 leading-relaxed">
          Free-tier exports cover the first 60 seconds and are watermarked. All exports, free and paid, are cleared for commercial use online and offline, including social media and advertising, except film, TV, radio and games, which need separate licensing.
        </p>
        <p className="text-center text-[#9090aa] text-sm max-w-2xl mx-auto mb-20 leading-relaxed">
          Music is generated by ElevenLabs and licensed for commercial use under their{" "}
          <a href="https://elevenlabs.io/music-terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#C8A96E] transition-colors">
            Music Terms
          </a>.
        </p>

        {/* Comparison table */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Full feature comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  <th className="text-left py-4 pr-8 text-[#a0a0b8] font-normal text-sm w-1/2">Feature</th>
                  <th className="text-center py-4 px-4 text-[#a0a0b8] font-normal text-sm">Free</th>
                  <th className="text-center py-4 px-4 text-white font-semibold text-sm">Creator</th>
                  <th className="text-center py-4 px-4 text-white font-semibold text-sm">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Analyses", "1 lifetime", "15/mo", "40/mo"],
                  ["Generated soundtrack options", "1 per analysis", "Up to 4 per analysis", "Up to 6 per analysis"],
                  ["Soundtrack length", "First 60 seconds", "Full video", "Full video"],
                  ["Regenerate options", "—", "1× per video", "2× per video"],
                  ["AI video analysis", "✓", "✓", "✓"],
                  ["Audio preview", "First 60 seconds", "Full", "Full"],
                  ["Exports", "First 60 seconds, watermarked", "Full video, no watermark", "Full video, no watermark"],
                ].map(([feature, free, creator, team]) => (
                  <tr key={feature} className="border-b border-[#1E1E1E] hover:bg-[#141414]/60 transition-colors">
                    <td className="py-4 pr-8 text-white text-sm">{feature}</td>
                    <td className="py-4 px-4 text-center text-[#a0a0b8] text-sm">{free}</td>
                    <td className="py-4 px-4 text-center text-white text-sm font-medium">{creator}</td>
                    <td className="py-4 px-4 text-center text-white text-sm font-medium">{team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-[#a0a0b8] text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-br from-[#C8A96E]/8 to-[#1E1608]/20 border border-[#C8A96E]/20 rounded-2xl py-16 px-8">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-[#a0a0b8] text-lg mb-8 max-w-xl mx-auto">
            Analyze your first video free. No credit card required.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold px-8 py-4 rounded-xl transition-all shadow-lg"
            >
              Try it free
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white border border-white/30 bg-transparent hover:bg-white/[0.08] font-semibold px-8 py-4 rounded-xl transition-all"
            >
              Learn more
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
