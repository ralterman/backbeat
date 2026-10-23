/**
 * ElevenLabs credit monitoring: fetch the current balance and recent burn,
 * decide whether to alert, and format the alert email. The network calls and
 * the arithmetic are separate functions so the arithmetic can be unit-tested.
 *
 * Requires the API key to have the "User" permission (user_read) for
 * /v1/user/subscription; the usage endpoint needs no extra scope.
 */

const SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";
const USAGE_URL = "https://api.elevenlabs.io/v1/usage/character-stats";

/** Thrown when the key lacks the user_read scope — a configuration problem,
 *  not a transient failure, so the cron reports it instead of retrying. */
export class ElevenLabsScopeError extends Error {
  readonly name = "ElevenLabsScopeError";
}

export interface CreditSnapshot {
  tier: string;
  status: string;
  used: number;
  limit: number;
  remaining: number;
  /** 0..1 */
  remainingFraction: number;
  resetAt: Date | null;
  /** Whether overage / usage-based billing is enabled, i.e. hitting 0 may not hard-stop generation. */
  overageEnabled: boolean;
  /** Credits used per UTC day over the lookback window (oldest first). */
  dailyBurn: number[];
  lookbackDays: number;
  avgDailyBurn: number;
  /** Credits used on the last complete UTC day. */
  yesterdayBurn: number;
  /** Days until credits run out at the average burn; null when burn is 0. */
  runwayDays: number | null;
  fetchedAt: Date;
}

export interface Thresholds {
  /** Alert when remaining / limit is below this. */
  minRemainingFraction: number;
  /** Alert when runway is below this many days. */
  minRunwayDays: number;
  /** Below this many days of runway the alert is "critical": it bypasses the
   *  once-a-day throttle and repeats on every 6-hourly run. */
  criticalRunwayDays: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { minRemainingFraction: 0.5, minRunwayDays: 7, criticalRunwayDays: 2 };

export async function fetchCreditSnapshot(apiKey: string, lookbackDays = 7, now = new Date()): Promise<CreditSnapshot> {
  const headers = { "xi-api-key": apiKey };

  const subRes = await fetch(SUBSCRIPTION_URL, { headers, signal: AbortSignal.timeout(15000) });
  const sub = (await subRes.json()) as Record<string, unknown>;
  if (!subRes.ok) {
    const detail = sub?.detail as { status?: string; message?: string } | undefined;
    if (subRes.status === 401 && detail?.status === "missing_permissions") {
      throw new ElevenLabsScopeError(detail.message ?? "API key is missing the user_read permission");
    }
    throw new Error(`ElevenLabs subscription endpoint ${subRes.status}: ${JSON.stringify(sub).slice(0, 300)}`);
  }

  const end = now.getTime();
  const start = end - lookbackDays * 24 * 60 * 60 * 1000;
  const usageRes = await fetch(
    `${USAGE_URL}?start_unix=${start}&end_unix=${end}&aggregation_interval=day`,
    { headers, signal: AbortSignal.timeout(15000) }
  );
  const usage = (await usageRes.json()) as { time?: number[]; usage?: Record<string, number[]> };
  if (!usageRes.ok) throw new Error(`ElevenLabs usage endpoint ${usageRes.status}: ${JSON.stringify(usage).slice(0, 300)}`);

  // With no breakdown the map has one series (usually "All"); sum every series defensively.
  const seriesList = Object.values(usage.usage ?? {});
  const dayCount = usage.time?.length ?? 0;
  const dailyBurn = Array.from({ length: dayCount }, (_, i) => seriesList.reduce((s, series) => s + (series[i] ?? 0), 0));

  // Yesterday = the bucket starting at the previous UTC midnight. Bucket
  // timestamps are ms like the query; if they don't line up (API change),
  // fall back to the second-to-last bucket, since the last one is today so far.
  const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = todayStart.getTime() - 24 * 60 * 60 * 1000;
  let yesterdayIdx = (usage.time ?? []).findIndex((t) => t === yesterdayStart);
  if (yesterdayIdx < 0) yesterdayIdx = dailyBurn.length - 2;
  const yesterdayBurn = yesterdayIdx >= 0 ? dailyBurn[yesterdayIdx] ?? 0 : 0;

  return computeSnapshot({
    tier: String(sub.tier ?? "unknown"),
    status: String(sub.status ?? "unknown"),
    used: Number(sub.character_count ?? 0),
    limit: Number(sub.character_limit ?? 0),
    resetUnix: typeof sub.next_character_count_reset_unix === "number" ? sub.next_character_count_reset_unix : null,
    overageEnabled: sub.can_extend_character_limit === true || (sub.max_credit_limit_extension !== 0 && sub.max_credit_limit_extension != null),
    dailyBurn,
    yesterdayBurn,
    lookbackDays,
    now,
  });
}

/** Pure: everything derived from raw numbers lives here so it can be tested. */
export function computeSnapshot(input: {
  tier: string; status: string; used: number; limit: number; resetUnix: number | null;
  overageEnabled: boolean; dailyBurn: number[]; yesterdayBurn: number; lookbackDays: number; now: Date;
}): CreditSnapshot {
  const remaining = Math.max(0, input.limit - input.used);
  const remainingFraction = input.limit > 0 ? remaining / input.limit : 0;
  const total = input.dailyBurn.reduce((s, v) => s + v, 0);
  // Average over the whole lookback window, not just days with activity:
  // quiet days are real days of runway.
  const avgDailyBurn = input.lookbackDays > 0 ? total / input.lookbackDays : 0;
  const runwayDays = avgDailyBurn > 0 ? remaining / avgDailyBurn : null;
  return {
    tier: input.tier,
    status: input.status,
    used: input.used,
    limit: input.limit,
    remaining,
    remainingFraction,
    resetAt: input.resetUnix ? new Date(input.resetUnix * 1000) : null,
    overageEnabled: input.overageEnabled,
    dailyBurn: input.dailyBurn,
    lookbackDays: input.lookbackDays,
    avgDailyBurn,
    yesterdayBurn: input.yesterdayBurn,
    runwayDays,
    fetchedAt: input.now,
  };
}

export interface Verdict {
  alert: boolean;
  /** Runway under the critical threshold: email on every run, not once a day. */
  critical: boolean;
  reasons: string[];
}

export function evaluateSnapshot(s: CreditSnapshot, t: Thresholds = DEFAULT_THRESHOLDS): Verdict {
  const reasons: string[] = [];
  if (s.remainingFraction < t.minRemainingFraction) {
    reasons.push(`${Math.round(s.remainingFraction * 100)}% of credits remaining (threshold ${Math.round(t.minRemainingFraction * 100)}%)`);
  }
  const critical = s.runwayDays !== null && s.runwayDays < t.criticalRunwayDays;
  if (critical) {
    reasons.push(`under ${t.criticalRunwayDays} days of runway (about ${s.runwayDays!.toFixed(1)}) at the current burn`);
  } else if (s.runwayDays !== null && s.runwayDays < t.minRunwayDays) {
    reasons.push(`about ${s.runwayDays.toFixed(1)} days of runway at the current burn (threshold ${t.minRunwayDays} days)`);
  }
  return { alert: reasons.length > 0, critical, reasons };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtDate = (d: Date | null) =>
  d ? d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET" : "unknown";

export function creditAlertEmail(s: CreditSnapshot, v: Verdict): { subject: string; text: string; html: string } {
  const runway = s.runwayDays === null ? "no usage in the last 7 days" : `~${s.runwayDays.toFixed(1)} days`;
  const cadence = v.critical
    ? "Runway is under 2 days, so this repeats every 6 hours until it recovers."
    : "Sent at most once a day (every 6 hours once runway drops under 2 days).";
  const subject =
    `Backbeat: ElevenLabs credits ${v.critical ? "critical" : "low"} — ` +
    `${fmt(s.remaining)} left, yesterday ${fmt(s.yesterdayBurn)}, 7d avg ${fmt(s.avgDailyBurn)}`;
  const lines = [
    `Credits remaining: ${fmt(s.remaining)} of ${fmt(s.limit)} (${Math.round(s.remainingFraction * 100)}%)`,
    `Yesterday's burn: ${fmt(s.yesterdayBurn)} credits`,
    `Average daily burn (last ${s.lookbackDays} days): ${fmt(s.avgDailyBurn)} credits/day`,
    `Runway at the average burn: ${runway}`,
    `Credits reset: ${fmtDate(s.resetAt)}`,
    `Plan: ${s.tier} (${s.status}); usage-based billing / overage: ${s.overageEnabled ? "enabled" : "not enabled — generation stops at 0"}`,
    ``,
    `Why this email: ${v.reasons.join("; ")}.`,
    `Daily burn, oldest → newest: ${s.dailyBurn.map(fmt).join(", ")}`,
    ``,
    `Top up: https://elevenlabs.io/app/subscription`,
    `Checked ${s.fetchedAt.toISOString()}. ${cadence}`,
  ];
  const rows = [
    ["Credits remaining", `${fmt(s.remaining)} of ${fmt(s.limit)} (<strong>${Math.round(s.remainingFraction * 100)}%</strong>)`],
    ["Yesterday's burn", `${fmt(s.yesterdayBurn)} credits`],
    [`Average daily burn (${s.lookbackDays}d)`, `${fmt(s.avgDailyBurn)} credits/day`],
    ["Runway at the average burn", `<strong>${runway}</strong>`],
    ["Credits reset", fmtDate(s.resetAt)],
    ["Plan", `${s.tier} (${s.status}) — overage ${s.overageEnabled ? "enabled" : "not enabled: generation stops at 0"}`],
  ].map(([k, val]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">${k}</td><td style="padding:6px 0">${val}</td></tr>`).join("");
  const html =
    `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a">` +
    `<h2 style="margin-bottom:4px">ElevenLabs credits are ${v.critical ? "critically low" : "running low"}</h2>` +
    `<p style="color:#666;margin-top:0">${v.reasons.join("; ")}.</p>` +
    `<table style="border-collapse:collapse">${rows}</table>` +
    `<p style="font-size:13px;color:#666">Daily burn, oldest → newest: ${s.dailyBurn.map(fmt).join(", ")}</p>` +
    `<p><a href="https://elevenlabs.io/app/subscription" style="color:#C8A96E;font-weight:600">Top up credits →</a></p>` +
    `<p style="color:#9090aa;font-size:12px">Checked ${s.fetchedAt.toISOString()}. ${cadence}</p></div>`;
  return { subject, text: lines.join("\n"), html };
}

export function scopeMissingEmail(detail: string): { subject: string; text: string; html: string } {
  const fix =
    "Fix: elevenlabs.io → Developers → API Keys → ⋯ next to the Backbeat key → Edit → set \"User\" to Access (read) → Save. No redeploy needed; the next daily run will work.";
  return {
    subject: "Backbeat: the daily ElevenLabs credit check can't read your balance",
    text: `The ElevenLabs API key is missing the user_read permission, so the daily credit check cannot call /v1/user/subscription.\n\n${fix}\n\nElevenLabs said: ${detail}\n\nYou'll get this at most once a day until it's fixed.`,
    html:
      `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a"><h2>Daily ElevenLabs credit check can't read your balance</h2>` +
      `<p>The API key is missing the <code>user_read</code> permission, so <code>/v1/user/subscription</code> returns 401.</p>` +
      `<p>${fix.replace(/→/g, "&rarr;")}</p><p style="color:#666;font-size:13px">ElevenLabs said: ${detail}</p>` +
      `<p style="color:#9090aa;font-size:12px">At most once a day until fixed.</p></div>`,
  };
}
