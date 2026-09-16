"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { CheckEmail } from "@/components/CheckEmail";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Pre-existing gap, unchanged here: result?.error is not checked, so
    // emailSent flips to true even if the send failed. Out of scope for this
    // change — flagging rather than fixing silently.
    await signIn("resend", { email, callbackUrl: "/dashboard", redirect: false });
    setEmailSent(true);
    setLoading(false);
  };

  // Passed to CheckEmail, which owns the cooldown/error UI for this action —
  // throw so it knows the send failed and shouldn't start the cooldown.
  const handleResend = async () => {
    const result = await signIn("resend", { email, callbackUrl: "/dashboard", redirect: false });
    if (result?.error) throw new Error(result.error);
  };

  const handleGoogleSignUp = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="flex flex-col items-center gap-6 mb-10">
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
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-[#a0a0b8] mt-2">Start free — no credit card required</p>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8">
          <div className="flex gap-2 mb-6 flex-wrap sm:flex-nowrap">
            {[
              { icon: "🎬", text: "1 free analysis" },
              { icon: "🎵", text: "Top 3 tracks" },
              { icon: "⚡", text: "Instant results" },
            ].map((item) => (
              <div key={item.text} className="flex-1 text-center bg-[#1E1E1E] rounded-lg py-2 px-1">
                <p className="text-lg mb-0.5">{item.icon}</p>
                <p className="text-[#a0a0b8] text-xs">{item.text}</p>
              </div>
            ))}
          </div>

          {emailSent ? (
            <CheckEmail email={email} actionText="activate your account" onResend={handleResend} />
          ) : (
            <>
              <button
                onClick={handleGoogleSignUp}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#f0f0f0] text-[#0A0A0A] font-bold py-3 px-4 rounded-xl transition-colors mb-6"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2A2A2A]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#141414] px-3 text-[#6a6a8a]">or sign up with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-[#1E1E1E] border border-[#2A2A2A] text-white placeholder-[#6a6a8a] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#C8A96E] focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-white hover:bg-[#f0f0f0] disabled:bg-[#1E1E1E] disabled:text-[#6a6a8a] text-[#0a0a0f] font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  {loading ? "Sending..." : "Create free account"}
                </button>
              </form>

              <p className="text-[#6a6a8a] text-xs text-center mt-4">
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[#a0a0b8] text-sm mt-6">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-[#C8A96E] hover:text-white transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
