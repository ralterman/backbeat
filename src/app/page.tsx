import Link from "next/link";
import Image from "next/image";
import { PricingCard } from "@/components/PricingCard";
import { DemoWidget } from "@/components/DemoWidget";
import { RevealSection } from "@/components/RevealSection";

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
    title: "Custom AI Soundtrack",
    description:
      "Your AI generates two unique tracks specifically for your video — matched to its mood, energy, scene type, and pacing. No catalog. No guesswork.",
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
    title: "Instant Results",
    description:
      "Upload your video and get two AI-generated soundtrack options in minutes. Pick the one that fits, or generate two more.",
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
      "Music generated through Backbeat is cleared for commercial use on YouTube, TikTok, and Instagram — no copyright strikes, no fees beyond your subscription.",
  },
];

const FREE_FEATURES = [
  { text: "1 free video analysis, lifetime", included: true },
  { text: "2 AI-generated soundtrack options per analysis", included: true },
  { text: "Full preview synced to your video", included: true },
  { text: "Export with watermark", included: true },
  { text: "No-watermark exports", included: false },
  { text: "Priority processing", included: false },
];

const CREATOR_FEATURES = [
  { text: "30 video analyses per month", included: true },
  { text: "2 AI-generated soundtrack options per analysis", included: true },
  { text: "Full preview synced to your video", included: true },
  { text: "No-watermark exports", included: true },
  { text: "Priority processing", included: true },
  { text: "Team seats", included: false },
];

const TEAM_FEATURES = [
  { text: "Unlimited video analyses", included: true },
  { text: "2 AI-generated soundtrack options per analysis", included: true },
  { text: "Full preview synced to your video", included: true },
  { text: "No-watermark exports", included: true },
  { text: "Priority processing", included: true },
  { text: "Up to 5 team seats", included: true },
];

export default function LandingPage() {
  return (
    <div className="bg-transparent">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Radial glow behind headline */}
        <div
          className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(200,169,110,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 text-center">
          {/* Logo lockup */}
          <div className="flex flex-col items-center gap-6 mb-10">
            <Image
              src="/brand/logo-icon.png"
              alt="Backbeat icon"
              width={120}
              height={120}
              priority
              className="h-[120px] w-auto"
            />
            <span style={{ color: "#C8A96E", fontSize: "56px", fontWeight: 400, lineHeight: 1, letterSpacing: "0.05em", fontFamily: "'TAN Pearl', serif" }}>
              Backbeat
            </span>
          </div>

          {/* Section label */}
          <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-5">
            AI Music Generation
          </p>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Upload your video.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8A96E] to-[#E8C87A]">
              Get your music.
            </span>
          </h1>

          {/* Sub */}
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Backbeat analyzes your video and generates a custom soundtrack in minutes — no music theory, no searching, no copyright strikes.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f0f0] hover:-translate-y-0.5 text-[#0a0a0f] font-bold text-base px-8 py-4 rounded-xl transition-all duration-200 shadow-lg"
            >
              Try it free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 text-white border border-white/20 bg-white/[0.04] hover:bg-white/[0.08] hover:-translate-y-0.5 font-semibold text-base px-8 py-4 rounded-xl transition-all duration-200"
            >
              See pricing
            </Link>
          </div>

          <p className="text-[#9090aa] text-sm mt-5">No credit card required — analyze your first video free</p>

          <DemoWidget />
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="py-28" style={{ background: "rgba(255,255,255,0.01)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RevealSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-4">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Everything you need to score your videos
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              From upload to export in minutes. No music theory knowledge required.
            </p>
          </RevealSection>

          <RevealSection stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 border border-white/[0.06] hover:border-[#C8A96E]/30 hover:shadow-[0_0_20px_rgba(200,169,110,0.08)]"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(200,169,110,0.08)",
                    boxShadow: "0 0 12px rgba(200,169,110,0.15)",
                  }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </RevealSection>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <RevealSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-4">Process</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">How Backbeat works</h2>
            <p className="text-gray-400 text-lg">Three steps to a perfectly scored video</p>
          </RevealSection>

          <RevealSection stagger className="grid grid-cols-1 md:grid-cols-3 gap-10">
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
                desc: "Choose your favorite option, preview it synced to your video, then export with music mixed in.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center relative">
                {/* Decorative step number */}
                <div className="text-[80px] font-bold leading-none mb-2 select-none" style={{ color: "rgba(200,169,110,0.12)" }}>
                  {item.step}
                </div>
                <div className="w-10 h-10 bg-[#C8A96E] rounded-full flex items-center justify-center mx-auto mb-4 -mt-2">
                  <span className="text-[#0a0a0f] font-bold text-xs">{item.step}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2 tracking-tight">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </RevealSection>
        </div>
      </section>

      {/* ── Early Access CTA ──────────────────────────────────────────── */}
      <section className="py-28" style={{ background: "rgba(255,255,255,0.01)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <RevealSection>
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-5">Early access</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Be one of our first creators.
            </h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              Try Backbeat free — no credit card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f0f0] hover:-translate-y-0.5 text-[#0a0a0f] font-bold text-base px-8 py-4 rounded-xl transition-all duration-200 shadow-lg"
              style={{ animation: "pulse-gold 3s ease-in-out infinite" }}
            >
              Try it free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ── Pricing Preview ───────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <RevealSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg">Start free. Upgrade when you need more.</p>
          </RevealSection>

          <RevealSection stagger delay={100} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
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
              badge="Most Popular"
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
          </RevealSection>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <RevealSection>
            <div
              className="rounded-2xl py-16 px-8"
              style={{
                background: "linear-gradient(135deg, rgba(200,169,110,0.07) 0%, rgba(30,22,8,0.15) 100%)",
                border: "1px solid rgba(200,169,110,0.15)",
              }}
            >
              <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-5">Get started</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Ready to score your video?
              </h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Analyze your first video free. No credit card required.
              </p>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f0f0] hover:-translate-y-0.5 text-[#0a0a0f] font-bold text-base px-8 py-4 rounded-xl transition-all duration-200 shadow-lg"
              >
                Upload your first video — free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
