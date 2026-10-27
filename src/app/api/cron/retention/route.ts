import { NextRequest, NextResponse } from "next/server";
import { runRetention } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily storage retention (vercel.json). Vercel invokes it with
// `Authorization: Bearer <CRON_SECRET>`; anything else is refused.
//
// Deletion is off until RETENTION_DELETE=1 is set in the environment: without
// it every run is a dry run that only reports what it would remove. Add
// `?dryRun=1` to force a dry run even when deletion is enabled. The rules
// themselves live in src/lib/retention.ts.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deletionEnabled = process.env.RETENTION_DELETE === "1";
  const dryRun = !deletionEnabled || req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runRetention({ dryRun });
    return NextResponse.json({ ok: result.errors === 0, deletionEnabled, ...result });
  } catch (err) {
    console.error("[cron:retention] run failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "retention failed" }, { status: 500 });
  }
}
