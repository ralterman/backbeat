"use client";

import React, { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-6 py-16">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-3xl font-bold mb-1" style={{ color: "#C8A96E" }}>Contact Us</h1>
        <p className="text-sm text-[#9090aa] mb-10">
          Questions, feedback, bug reports, feature ideas — we&rsquo;d love to hear from you.
        </p>

        {success ? (
          <div className="bg-green-900/20 border border-green-800/30 rounded-2xl px-8 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg">Thanks! We&rsquo;ll get back to you soon.</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-5 mb-8">
              <div>
                <label htmlFor="name" className="block text-sm text-[#a0a0b8] mb-1.5">Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#6a6a8a] focus:outline-none focus:border-[#C8A96E]/60 transition-colors text-sm"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm text-[#a0a0b8] mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#6a6a8a] focus:outline-none focus:border-[#C8A96E]/60 transition-colors text-sm"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm text-[#a0a0b8] mb-1.5">Message</label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder-[#6a6a8a] focus:outline-none focus:border-[#C8A96E]/60 transition-colors text-sm resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-3 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
                style={{ background: "#C8A96E", color: "#0a0a0f" }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Sending...
                  </span>
                ) : "Send Message"}
              </button>
            </form>

            <p className="text-sm text-[#9090aa]">
              Or email us directly at{" "}
              <a href="mailto:hello@backbeat.video" className="hover:text-[#C8A96E] transition-colors underline">
                hello@backbeat.video
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
