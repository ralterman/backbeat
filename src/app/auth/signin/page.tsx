"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSendError(null);
    try {
      const result = await signIn("resend", { email, callbackUrl, redirect: false });
      if (result?.error) {
        setSendError(result.error);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8">
      {(error || sendError) && (
        <div className="mb-6 bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error === "OAuthAccountNotLinked"
            ? "This email is already associated with a different sign-in method."
            : sendError
            ? `Send failed: ${sendError}`
            : "Authentication failed. Please try again."}
        </div>
      )}

      {emailSent ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Check your email</h3>
          <p className="text-[#a0a0b8] text-sm">
            We sent a magic link to <strong className="text-white">{email}</strong>. Click it to sign in.
          </p>
          <button
            onClick={() => setEmailSent(false)}
            className="mt-6 text-[#a0a0b8] hover:text-white text-sm transition-colors"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={handleGoogleSignIn}
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
              <span className="bg-[#141414] px-3 text-[#6a6a8a]">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
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
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex mb-6">
            <Image
              src="/brand/logo-horizontal.svg"
              alt="Backbeat"
              width={156}
              height={44}
              priority
              className="h-11 w-auto"
            />
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-[#a0a0b8] mt-2">Sign in to your account</p>
        </div>

        <Suspense fallback={<div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 text-center text-[#a0a0b8]">Loading...</div>}>
          <SignInForm />
        </Suspense>

        <p className="text-center text-[#a0a0b8] text-sm mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-[#C8A96E] hover:text-white transition-colors">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
