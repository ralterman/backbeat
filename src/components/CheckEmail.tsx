"use client";

import React, { useState, useEffect, useRef } from "react";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "@/components/Turnstile";

const RESEND_COOLDOWN_S = 30;

interface CheckEmailProps {
  email: string;
  /** Triggers a fresh magic-link send with the resend widget's token. Throw
   *  (or reject) on failure — the cooldown will not start and the error is
   *  shown inline. */
  onResend: (turnstileToken: string | null) => Promise<void>;
  /** Optional "Use a different email" link below the resend button. */
  onUseDifferentEmail?: () => void;
}

/**
 * The "check your email" confirmation shown after a magic-link request, on
 * both /auth/signin and /auth/signup. Owns the resend cooldown/error state
 * and its own Turnstile widget (tokens are single-use, and the form's widget
 * is gone by the time this renders); the page only supplies how to send.
 */
export function CheckEmail({ email, onResend, onUseDifferentEmail }: CheckEmailProps) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendToken, setResendToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_S);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // This screen only appears right after a magic link was sent, so the
  // cooldown starts immediately on mount — otherwise "Resend link" is
  // clickable the instant the first email goes out and a double-tap sends
  // two emails within a second. Cleared on unmount.
  useEffect(() => {
    startCooldown();
    return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsToken = !!TURNSTILE_SITE_KEY && !resendToken;

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || needsToken) return;
    setResending(true);
    setResendError(null);
    try {
      await onResend(resendToken);
      startCooldown();
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend. Please try again.");
    } finally {
      // Either way the token is spent; get a fresh one for the next attempt.
      turnstileRef.current?.reset();
      setResending(false);
    }
  };

  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-white font-semibold text-lg mb-3">Check your email</h3>
      {/* The spam note is the main message on purpose: most "didn't get the
          link" reports are a promotions/spam filing, not a failed send. */}
      <p className="text-[#d0d0d8] text-sm leading-relaxed">
        Our sign-in emails often land in spam or promotions. Check there first, then mark it{" "}
        <strong className="text-white">Not Spam</strong> so future links reach your inbox.
      </p>
      <p className="text-[#6a6a8a] text-xs mt-3">
        Sent to <span className="text-[#a0a0b8]">{email}</span>.
      </p>

      {resendError && (
        <p className="text-red-400 text-xs mt-3">{resendError}</p>
      )}

      <div className="mt-5 flex justify-center">
        <Turnstile
          onToken={setResendToken}
          onReady={(h) => { turnstileRef.current = h; }}
        />
      </div>

      <button
        onClick={handleResend}
        disabled={resendCooldown > 0 || resending || needsToken}
        className="mt-3 w-full border border-[#2A2A2A] hover:border-[#9090aa] disabled:hover:border-[#2A2A2A] text-[#a0a0b8] hover:text-white disabled:text-[#5a5a70] text-sm font-medium py-2.5 rounded-xl transition-colors"
      >
        {resending
          ? "Resending…"
          : resendCooldown > 0
          ? `Resend link (${resendCooldown}s)`
          : "Resend link"}
      </button>

      {onUseDifferentEmail && (
        <button
          onClick={onUseDifferentEmail}
          className="mt-4 text-[#a0a0b8] hover:text-white text-sm transition-colors"
        >
          Use a different email
        </button>
      )}
    </div>
  );
}
