import Link from "next/link";
import { PricingCard } from "@/components/PricingCard";
import { HeroDemo } from "@/components/demo/HeroDemo";
import { HeroLockup } from "@/components/demo/HeroLockup";
import { GenreRow } from "@/components/demo/GenreRow";
import ScrollToTop from "@/components/ScrollToTop";

const features = [
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: "No prompt writing",
    description:
      "Backbeat watches your video and works out the mood, energy, pacing and scene type itself. You never describe what you want. There's nothing to get wrong.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    title: "No credits to manage",
    description:
      "A flat plan, not a meter. Every analysis gives you a finished track matched to your footage, and paid plans give you two plus regeneration.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
      </svg>
    ),
    title: "Keeps Your Audio",
    description:
      "Your original sound stays in by default, with the new soundtrack mixed underneath. Or drop it and go music only.",
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
      "Export with your original audio and the new soundtrack mixed together, or swap it out entirely. Fades and levels handled automatically.",
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

export default function LandingPage() {
  return (
    <div className="bg-transparent">
      <ScrollToTop />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      {/* From lg the hero is exactly one laptop screen: the viewport height
          minus the 4rem navbar (100svh so mobile-style browser chrome is
          excluded). The demo card's height is derived from what is left
          after the toggle, caption and padding; its width follows 9:16. */}
      <section className="relative overflow-hidden lg:h-[calc(100svh-4rem)]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 lg:h-full lg:py-6">
          {/* Before hydration the navbar logo is hidden on this page only;
              HeroLockup then keeps it hidden until the lockup scrolls past. */}
          <style>{`html:not([data-hero-lockup]) .nav-brand{opacity:0}`}</style>
          {/* Copy left, live demo right, the text block vertically centered
              against the card; stacked on phones with the demo under the CTAs. */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-16 items-center lg:h-full">
            {/* The grid centers this block against the whole demo column; the
                transform lifts it by half the toggle + caption block (51 px)
                so it is centered on the card itself, without adding to the
                block's layout height. */}
            <div className="text-center lg:text-left lg:-translate-y-[51px]">
              <HeroLockup />
              <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-5 lg:mb-[25px]">
                The simplest way to score a video
              </p>

              {/* hero-headline: one step smaller on laptop screens under 800 px tall (globals.css). */}
              <h1 className="hero-headline text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6 lg:mb-[30px]">
                Upload your video.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8A96E] to-[#E8C87A]">
                  Get your music.
                </span>
              </h1>

              <p className="text-lg text-gray-400 max-w-2xl mx-auto lg:mx-0 mb-10 lg:mb-[50px] leading-relaxed">
                No prompts to write, no credits to manage. Upload a clip, Backbeat reads it and writes the soundtrack, you export. A few minutes start to finish.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
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

              <p className="text-[#9090aa] text-sm mt-3">No credit card required. Analyze your first video free.</p>
            </div>

            <HeroDemo />
          </div>
        </div>
      </section>

      {/* ── Hear it on more kinds of video ─────────────────────────────── */}
      {/* Visual gap from the hero caption: 64 px on phones (the hero's own
          bottom padding), 96 px from lg (24 px hero padding + 72 px here). */}
      <section className="pb-16 lg:pt-[72px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-3">Real output</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Hear it on more kinds of video</h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto">Every track below was generated by Backbeat from the clip you see. Tap one to listen.</p>
          </div>
          <GenreRow />
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-4">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              One job, done simply
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Upload, get music, export. That&rsquo;s the whole workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-4">Process</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">How Backbeat works</h2>
            <p className="text-gray-400 text-lg">Three steps to a perfectly scored video</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Upload your video",
                desc: "Drag and drop your video file (MP4, MOV, AVI, MKV). Up to 150 MB.",
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
          </div>
        </div>
      </section>

      {/* ── Early Access CTA ──────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
        </div>
      </section>

      {/* ── Pricing Preview ───────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest text-[#C8A96E] uppercase mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
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
              description="For serious video creators"
              features={CREATOR_FEATURES}
              cta="Start Creator plan"
              ctaHref="/api/stripe/checkout?plan=creator"
              highlighted
              badge="Most Popular"
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
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div
            className="rounded-2xl py-12 px-8"
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
        </div>
      </section>
    </div>
  );
}
