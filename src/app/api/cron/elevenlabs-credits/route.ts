import { NextRequest, NextResponse } from "next/server";
import {
  fetchCreditSnapshot,
  evaluateSnapshot,
  creditAlertEmail,
  scopeMissingEmail,
  ElevenLabsScopeError,
  DEFAULT_THRESHOLDS,
} from "@/lib/elevenlabsCredits";
import { notifyAdminThrottled } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily ElevenLabs credit check (vercel.json; Vercel Hobby allows one cron
// run per day, so the schedule cannot be tighter). Vercel invokes it with
// `Authorization: Bearer <CRON_SECRET>`; anything else is refused, so the
// route can't be used to make us email ourselves.
//
// Emails the admin via the throttled alert helper when credits are under
// 50 % or under 7 days of runway at the 7-day average burn: at most once a
// day (a ~20 h window, so a manual re-run the same day doesn't double-send).
// Under 2 days of runway the alert is critical and uses its own key with a
// short window, so it is never suppressed by an earlier "low" email and
// repeats on every run (daily on Hobby; every run if the cron is ever made
// more frequent). If the key can't read the balance (missing user_read
// scope), that's reported the same way instead of failing silently.
const DAILY_WINDOW_MS = 20 * 60 * 60 * 1000;
const CRITICAL_WINDOW_MS = 5.5 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const snapshot = await fetchCreditSnapshot(apiKey);
    const verdict = evaluateSnapshot(snapshot, DEFAULT_THRESHOLDS);
    let emailed = false;
    if (verdict.critical) {
      emailed = await notifyAdminThrottled("elevenlabs-credits-critical", CRITICAL_WINDOW_MS, creditAlertEmail(snapshot, verdict));
    } else if (verdict.alert) {
      emailed = await notifyAdminThrottled("elevenlabs-credits-low", DAILY_WINDOW_MS, creditAlertEmail(snapshot, verdict));
    }
    console.log(
      `[cron:elevenlabs-credits] remaining=${snapshot.remaining}/${snapshot.limit} (${Math.round(snapshot.remainingFraction * 100)}%) ` +
      `yesterday=${Math.round(snapshot.yesterdayBurn)} avg=${Math.round(snapshot.avgDailyBurn)}/day runway=${snapshot.runwayDays?.toFixed(1) ?? "∞"}d ` +
      `alert=${verdict.alert} critical=${verdict.critical} emailed=${emailed}`
    );
    return NextResponse.json({
      ok: true,
      remaining: snapshot.remaining,
      limit: snapshot.limit,
      remainingPercent: Math.round(snapshot.remainingFraction * 100),
      avgDailyBurn: Math.round(snapshot.avgDailyBurn),
      yesterdayBurn: Math.round(snapshot.yesterdayBurn),
      runwayDays: snapshot.runwayDays === null ? null : Number(snapshot.runwayDays.toFixed(1)),
      resetAt: snapshot.resetAt?.toISOString() ?? null,
      tier: snapshot.tier,
      overageEnabled: snapshot.overageEnabled,
      dailyBurn: snapshot.dailyBurn,
      alert: verdict.alert,
      critical: verdict.critical,
      reasons: verdict.reasons,
      emailed,
    });
  } catch (err) {
    if (err instanceof ElevenLabsScopeError) {
      const emailed = await notifyAdminThrottled("elevenlabs-credits-scope", DAILY_WINDOW_MS, scopeMissingEmail(err.message));
      console.error(`[cron:elevenlabs-credits] key lacks user_read: ${err.message} (emailed=${emailed})`);
      return NextResponse.json({ ok: false, error: "api-key-missing-user_read", detail: err.message, emailed }, { status: 200 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:elevenlabs-credits] failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
