"use client";

import React, { useState, useEffect, useRef } from "react";

const RESEND_COOLDOWN_S = 30;

interface CheckEmailProps {
  email: string;
  /** Completes "We sent a magic link to <email>. Click it to …" — e.g. "sign in" or "activate your account". */
  actionText: string;
  /** Triggers a fresh magic-link send. Throw (or reject) on failure — the
   *  cooldown will not start and the error is shown inline. */
  onResend: () => Promise<void>;
  /** Optional "Use a different email" link below the resend button. */
  onUseDifferentEmail?: () => void;
}

/**
 * The "check your email" confirmation shown after a magic-link request, on
 * both /auth/signin and /auth/signup. Owns the resend cooldown/error state;
 * the page only supplies how to actually (re)send.
 */
export function CheckEmail({ email, actionText, onResend, onUseDifferentEmail }: CheckEmailProps) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
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

  useEffect(() => {
    return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); };
  }, []);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendError(null);
    try {
      await onResend();
      startCooldown();
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend. Please try again.");
    } finally {
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
      <h3 className="text-white font-semibold text-lg mb-2">Check your email</h3>
      <p className="text-[#a0a0b8] text-sm">
        We sent a magic link to <strong className="text-white">{email}</strong>. Click it to {actionText}.
      </p>
      <p className="text-[#6a6a8a] text-xs mt-3 leading-relaxed">
        Didn&apos;t get it? Check your spam or promotions folder, and mark it as not spam so future links land in your inbox.
      </p>

      {resendError && (
        <p className="text-red-400 text-xs mt-3">{resendError}</p>
      )}

      <button
        onClick={handleResend}
        disabled={resendCooldown > 0 || resending}
        className="mt-6 w-full border border-[#2A2A2A] hover:border-[#9090aa] disabled:hover:border-[#2A2A2A] text-[#a0a0b8] hover:text-white disabled:text-[#5a5a70] text-sm font-medium py-2.5 rounded-xl transition-colors"
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
