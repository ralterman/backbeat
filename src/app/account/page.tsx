"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";

// Result flags set by GET /api/account/email/confirm's redirect.
const CONFIRM_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  confirmed:       { ok: true,  text: "Your email address has been updated." },
  expired:         { ok: false, text: "That confirmation link has expired. Request the change again to get a new one." },
  invalid:         { ok: false, text: "That confirmation link is invalid or has already been used." },
  taken:           { ok: false, text: "That email address is now associated with another account." },
  "wrong-account": { ok: false, text: "That link belongs to a different account. Sign in with the account that requested the change." },
  error:           { ok: false, text: "Something went wrong applying the change. Please try again." },
};

function Section({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-[#141414] border rounded-2xl p-6 mb-6 ${
        danger ? "border-red-900/40" : "border-[#2A2A2A]"
      }`}
    >
      <h2
        className={`text-lg font-semibold mb-4 ${
          danger ? "text-red-400" : "text-white"
        }`}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// useSearchParams() must sit under a Suspense boundary or `next build` fails
// when it tries to prerender this route.
export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      }
    >
      <AccountPageInner />
    </Suspense>
  );
}

function AccountPageInner() {
  const { data: session, status, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [billing, setBilling] = useState<{
    subscriptionStatus: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") redirect("/auth/signin?callbackUrl=/account");
  }, [status]);

  // Fetch plan + billing state
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.plan) setPlan(d.plan);
        if (d) setBilling({
          subscriptionStatus: d.subscriptionStatus ?? null,
          cancelAtPeriodEnd: !!d.cancelAtPeriodEnd,
          currentPeriodEnd: d.currentPeriodEnd ?? null,
        });
      })
      .catch(() => {});
  }, [status]);

  // --- Email update (two-step: request → confirm via link sent to the new address) ---
  const [emailValue, setEmailValue] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<{ newEmail: string; expiresAt: string } | null>(null);
  const [confirmFlag, setConfirmFlag] = useState<string | null>(null);

  // Load any in-flight request so the page survives a reload.
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/account/email")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.pending) setPendingEmail(d.pending); })
      .catch(() => {});
  }, [status]);

  // Handle the ?email=<flag> the confirm route redirects back with.
  useEffect(() => {
    const flag = searchParams.get("email");
    if (!flag || status !== "authenticated") return;
    setConfirmFlag(flag);
    if (flag === "confirmed") {
      setPendingEmail(null);
      updateSession(); // pull the new email into the JWT (see auth.ts jwt callback)
    }
    router.replace("/account"); // strip the flag so a refresh doesn't replay it
  }, [searchParams, status, router, updateSession]);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus("loading");
    setEmailError(null);
    setConfirmFlag(null);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error ?? "Something went wrong.");
        setEmailStatus("error");
      } else {
        setEmailStatus("success");
        setPendingEmail(data.pending ?? null);
        setEmailValue("");
      }
    } catch {
      setEmailError("Network error. Please try again.");
      setEmailStatus("error");
    }
  };

  const handleCancelPending = async () => {
    await fetch("/api/account/email", { method: "DELETE" }).catch(() => {});
    setPendingEmail(null);
    setEmailStatus("idle");
  };

  // --- Delete account ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleteStatus("loading");
    setDeleteError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete account.");
        setDeleteStatus("error");
        return;
      }
      // Sign out and go home
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeleteStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!session) return null;

  const currentEmail = session.user?.email ?? "";
  const planLabel = plan
    ? plan.charAt(0) + plan.slice(1).toLowerCase()
    : "…";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-[#a0a0b8] hover:text-white text-sm flex items-center gap-1.5 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white">Account</h1>
      </div>

      {/* Plan & billing */}
      <Section title="Plan & billing">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#a0a0b8] text-sm mb-0.5">Current plan</p>
            <p className="text-white font-semibold">{planLabel}</p>
            {billing?.cancelAtPeriodEnd && billing.currentPeriodEnd && (
              <p className="text-amber-300/90 text-xs mt-1">
                Cancels on{" "}
                {new Date(billing.currentPeriodEnd).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}{" "}
                — you keep paid features until then.
              </p>
            )}
            {billing?.subscriptionStatus === "PAST_DUE" && (
              <p className="text-red-400 text-xs mt-1">
                Your last payment failed — update your card in billing to keep your plan.
              </p>
            )}
          </div>
          {plan === "FREE" ? (
            <Link
              href="/pricing"
              className="bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              Upgrade
            </Link>
          ) : (
            <Link
              href="/api/stripe/portal"
              className="border border-[#2A2A2A] hover:border-[#9090aa] text-[#a0a0b8] hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              Manage billing
            </Link>
          )}
        </div>
      </Section>

      {/* Email */}
      <Section title="Email address">
        <p className="text-[#a0a0b8] text-sm mb-4">
          Current:{" "}
          <span className="text-white font-medium">{currentEmail}</span>
        </p>

        {confirmFlag && CONFIRM_MESSAGES[confirmFlag] && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm border ${
              CONFIRM_MESSAGES[confirmFlag].ok
                ? "bg-green-900/20 border-green-700/30 text-green-300"
                : "bg-red-900/20 border-red-800/30 text-red-400"
            }`}
          >
            {CONFIRM_MESSAGES[confirmFlag].ok ? "✓ " : ""}{CONFIRM_MESSAGES[confirmFlag].text}
          </div>
        )}

        {pendingEmail ? (
          <div className="bg-[#C8A96E]/10 border border-[#C8A96E]/30 rounded-xl px-4 py-3 text-sm">
            <p className="text-white font-medium mb-1">
              Confirmation sent to <span className="text-[#C8A96E]">{pendingEmail.newEmail}</span>
            </p>
            <p className="text-[#a0a0b8] mb-3">
              Click the link in that email to finish the change. Your address stays{" "}
              <span className="text-white">{currentEmail}</span> until you do. The link expires{" "}
              {new Date(pendingEmail.expiresAt).toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}.
            </p>
            <button
              type="button"
              onClick={handleCancelPending}
              className="text-[#a0a0b8] hover:text-white text-xs underline transition-colors"
            >
              Cancel this request
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailUpdate} className="flex gap-3">
            <input
              type="email"
              placeholder="New email address"
              value={emailValue}
              onChange={(e) => {
                setEmailValue(e.target.value);
                if (emailStatus === "error") setEmailStatus("idle");
              }}
              required
              className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] focus:border-[#9090aa] rounded-xl px-4 py-2.5 text-white placeholder-[#6a6a8a] text-sm outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={emailStatus === "loading" || !emailValue.trim()}
              className="bg-[#C8A96E] hover:bg-[#d4b87a] disabled:opacity-50 disabled:cursor-not-allowed text-[#0a0a0a] font-bold text-sm px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {emailStatus === "loading" ? "Sending…" : "Send confirmation"}
            </button>
          </form>
        )}
        {emailError && (
          <p className="mt-2 text-red-400 text-sm">{emailError}</p>
        )}
        <p className="mt-3 text-[#6a6a8a] text-xs">
          We&rsquo;ll email a confirmation link to the new address and a notice to your current one.
          If you signed in with Google, your email may revert to your Google email on next sign-in.
        </p>
      </Section>

      {/* Delete account */}
      <Section title="Delete account" danger>
        <p className="text-[#a0a0b8] text-sm mb-4">
          Permanently delete your account, all videos, and cancel any active
          subscription. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="border border-red-800/60 hover:border-red-600 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          Delete my account
        </button>
      </Section>

      {/* Confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => {
            if (deleteStatus !== "loading") setShowDeleteModal(false);
          }}
        >
          <div
            className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-3">
              Delete your account?
            </h3>
            <p className="text-[#a0a0b8] text-sm mb-6 leading-relaxed">
              This will permanently delete your account, all your videos, and
              cancel your subscription.{" "}
              <strong className="text-white">This cannot be undone.</strong>
            </p>

            {deleteError && (
              <div className="mb-4 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteStatus === "loading"}
                className="flex-1 border border-[#2A2A2A] hover:border-[#9090aa] text-[#a0a0b8] hover:text-white text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteStatus === "loading"}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
              >
                {deleteStatus === "loading" ? "Deleting…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
