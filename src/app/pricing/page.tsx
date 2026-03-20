import { PricingCard } from "@/components/PricingCard";
import Link from "next/link";

const FREE_FEATURES = [
  { text: "1 free video analysis, lifetime", included: true },
  { text: "Top 3 track recommendations", included: true },
  { text: "30-second audio previews", included: true },
  { text: "Export with watermark", included: true },
  { text: "No-watermark exports", included: false },
  { text: "Priority processing", included: false },
  { text: "Team seats", included: false },
];

const CREATOR_FEATURES = [
  { text: "30 video analyses per month", included: true },
  { text: "Top 5 track recommendations", included: true },
  { text: "Full-length audio previews", included: true },
  { text: "No-watermark exports", included: true },
  { text: "Priority processing", included: true },
  { text: "Email support", included: true },
  { text: "Team seats", included: false },
];

const TEAM_FEATURES = [
  { text: "Unlimited video analyses", included: true },
  { text: "Top 5 track recommendations", included: true },
  { text: "Full-length audio previews", included: true },
  { text: "No-watermark exports", included: true },
  { text: "Priority processing", included: true },
  { text: "Priority email support", included: true },
  { text: "Up to 5 team seats", included: true },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancellations take effect at the end of your billing period. You keep full access until then.",
  },
  {
    q: "What file formats are supported?",
    a: "We support MP4, MOV, AVI, and MKV files up to 500MB per video.",
  },
  {
    q: "Are the tracks licensed for commercial use?",
    a: "At launch, all tracks in the Backbeat library will be licensed for commercial use including YouTube, TikTok, Instagram, and client work — no copyright strikes. Our licensed music library will be integrated before the site goes live.",
  },
  {
    q: "What does the analysis count as?",
    a: "Each video you upload and run through AI analysis counts as one analysis. Previewing tracks and exporting do not count.",
  },
  {
    q: "What is the watermark on free exports?",
    a: "Free tier exports include a subtle Backbeat text overlay. Upgrade to Creator or Team to export without any watermark.",
  },
  {
    q: "How accurate is the music matching?",
    a: "Our algorithm uses mood, energy, BPM, scene type, and genre to match tracks. Most users find the top 1–2 recommendations are an excellent fit.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-[#a0a0b8] text-lg max-w-2xl mx-auto">
            Start free and upgrade when you need more. All plans include access to our track library and AI analysis.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mb-20">
          <PricingCard
            name="Try it free"
            price={0}
            priceSuffix=""
            description="One free analysis, no card needed"
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
            name="Team"
            price={39}
            priceSuffix="/mo"
            description="For agencies & production teams"
            features={TEAM_FEATURES}
            cta="Start Team plan"
            ctaHref="/api/stripe/checkout?plan=team"
          />
        </div>

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
                  <th className="text-center py-4 px-4 text-[#a0a0b8] font-normal text-sm">Team</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Analyses", "1 lifetime", "30/mo", "Unlimited"],
                  ["Track recommendations", "Top 3", "Top 5", "Top 5"],
                  ["AI video analysis", "✓", "✓", "✓"],
                  ["Audio preview", "30s cap", "Full", "Full"],
                  ["Exports", "Watermarked", "No watermark", "No watermark"],
                  ["Priority processing", "—", "✓", "✓"],
                  ["Team seats", "—", "—", "Up to 5"],
                  ["Support", "Community", "Email", "Priority email"],
                ].map(([feature, free, creator, team]) => (
                  <tr key={feature} className="border-b border-[#1E1E1E] hover:bg-[#141414]/60 transition-colors">
                    <td className="py-4 pr-8 text-white text-sm">{feature}</td>
                    <td className="py-4 px-4 text-center text-[#a0a0b8] text-sm">{free}</td>
                    <td className="py-4 px-4 text-center text-white text-sm font-medium">{creator}</td>
                    <td className="py-4 px-4 text-center text-white text-sm">{team}</td>
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
