"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

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

export default function AccountPage() {
  const { data: session, status, update: updateSession } = useSession();
  const [plan, setPlan] = useState<string | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") redirect("/auth/signin?callbackUrl=/account");
  }, [status]);

  // Fetch plan
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.plan) setPlan(d.plan); })
      .catch(() => {});
  }, [status]);

  // --- Email update ---
  const [emailValue, setEmailValue] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus("loading");
    setEmailError(null);
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
        setEmailValue("");
        await updateSession(); // refresh client-side session with new email
      }
    } catch {
      setEmailError("Network error. Please try again.");
      setEmailStatus("error");
    }
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
        {emailStatus === "success" ? (
          <div className="bg-green-900/20 border border-green-700/30 rounded-xl px-4 py-3 text-green-300 text-sm">
            ✓ Email updated. Your next magic link will be sent to the new address.
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
              {emailStatus === "loading" ? "Saving…" : "Update email"}
            </button>
          </form>
        )}
        {emailError && (
          <p className="mt-2 text-red-400 text-sm">{emailError}</p>
        )}
        <p className="mt-3 text-[#6a6a8a] text-xs">
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
