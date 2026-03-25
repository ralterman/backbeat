import Link from "next/link";
import Image from "next/image";
import { PricingCard } from "@/components/PricingCard";
import { DemoWidget } from "@/components/DemoWidget";

const features = [
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: "Smart Video Analysis",
    description:
      "Our AI extracts keyframes from your video and analyzes mood, energy, scene type, and pacing to understand exactly what kind of music fits.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    title: "Perfect Track Matching",
    description:
      "Match your video against a curated library spanning cinematic, lo-fi, electronic, jazz, rock, and more — with precision match scores.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15.536 8.464a5 5 0 010 7.072M12 9.5v5m-3.536-6.036a5 5 0 000 7.072M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Preview Before Export",
    description:
      "Listen to any track playing alongside your video with our synchronized audio player before committing to an export.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    title: "One-Click Export",
    description:
      "Export your video with music automatically merged, fade in/out applied, and audio normalized to broadcast standards (-14 LUFS).",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M5 3l1.5 1.5M12 3v2m4.5-1.5L15 5M3 12h2m14 0h2M5.5 18.5L7 17M17 7l1.5-1.5M12 19v2m-5-2.5L8.5 17M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
    title: "Instant results",
    description:
      "Upload your video and get matched tracks in under 20 seconds. No manual searching, no guesswork — just the right music, right away.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Licensed for Commercial Use",
    description:
      "All matched tracks will be licensed for commercial use on YouTube, TikTok, and Instagram — no copyright strikes.* Powered by licensed music library — integrated at launch.",
  },
];

const FREE_FEATURES = [
  { text: "1 free video analysis, lifetime", included: true },
  { text: "Top 3 track recommendations", included: true },
  { text: "15-second audio previews", included: true },
  { text: "Export with watermark", included: true },
  { text: "No-watermark exports", included: false },
  { text: "Priority processing", included: false },
];

const CREATOR_FEATURES = [
  { text: "30 video analyses per month", included: true },
  { text: "Top 5 track recommendations", included: true },
  { text: "Full-length audio previews", included: true },
  { text: "No-watermark exports", included: true },
  { text: "Priority processing", included: true },
  { text: "Team seats", included: false },
];

const TEAM_FEATURES = [
  { text: "Unlimited video analyses", included: true },
  { text: "Top 5 track recommendations", included: true },
  { text: "Full-length audio previews", included: true },
  { text: "No-watermark exports", included: true },
  { text: "Priority processing", included: true },
  { text: "Up to 5 team seats", included: true },
];

export default function LandingPage() {
  return (
    <div className="bg-[#0A0A0A]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/5 via-transparent to-[#C8A96E]/3 pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#C8A96E]/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/brand/logo-stacked.svg"
              alt="Backbeat"
              width={160}
              height={137}
              priority
              className="h-28 w-auto"
            />
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Upload your video.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8A96E] to-[#E8C87A]">
              Get your music.
            </span>
          </h1>

          <p className="text-xl text-[#a0a0b8] max-w-2xl mx-auto mb-10 leading-relaxed">
            Backbeat analyzes your video&apos;s mood, energy, and scene to recommend
            perfectly matched background tracks in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg"
            >
              Try it free
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 text-white border border-white/30 bg-transparent hover:bg-white/[0.08] font-semibold text-lg px-8 py-4 rounded-xl transition-all"
            >
              See pricing
            </Link>
          </div>

          <p className="text-[#9090aa] text-sm mt-6">No credit card required — analyze your first video free</p>

          <DemoWidget />
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to score your videos
            </h2>
            <p className="text-[#a0a0b8] text-lg max-w-2xl mx-auto">
              From upload to export in minutes. No music theory knowledge required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-6 hover:border-[#C8A96E]/30 transition-colors"
              >
                <div className="w-12 h-12 bg-[#C8A96E]/8 rounded-xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-[#a0a0b8] text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How Backbeat works</h2>
            <p className="text-[#a0a0b8] text-lg">Three steps to perfectly scored video</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload your video",
                desc: "Drag and drop your video file (MP4, MOV, AVI, MKV). Up to 500MB.",
              },
              {
                step: "02",
                title: "AI analysis",
                desc: "Our AI extracts keyframes and analyzes mood, energy, scene type, and ideal BPM range in seconds.",
              },
              {
                step: "03",
                title: "Export with music",
                desc: "Pick a track, preview it, then export your video with music mixed in.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-[#C8A96E] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#0a0a0f] font-bold text-sm">{item.step}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-[#a0a0b8] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pre-launch CTA — replaces testimonials */}
      <section className="py-24 bg-[#0D0D0D]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-white text-sm font-medium uppercase tracking-widest mb-4">Early access</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Be one of our first creators.
          </h2>
          <p className="text-[#a0a0b8] text-lg mb-8">
            Try Backbeat free — no credit card required.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg"
          >
            Try it free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-[#a0a0b8] text-lg">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
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
              description="For serious video creators"
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
              description="For agencies and teams"
              features={TEAM_FEATURES}
              cta="Start Team plan"
              ctaHref="/api/stripe/checkout?plan=team"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-[#C8A96E]/8 to-[#1E1608]/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to find the perfect soundtrack?
          </h2>
          <p className="text-[#a0a0b8] text-lg mb-8">
            Analyze your first video free. No credit card required.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold text-lg px-8 py-4 rounded-xl transition-all shadow-lg"
          >
            Upload your first video — free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
