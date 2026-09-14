import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeVerification, sendEmailChangeNotice } from "@/lib/email";
import { hashToken, normalizeEmail } from "@/lib/email-change";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * GET — the caller's pending email-change request, if any (for the account page).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pending = await prisma.emailChangeRequest.findFirst({
    where: { userId: session.user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { newEmail: true, expiresAt: true },
  });
  return NextResponse.json({ pending });
}

/**
 * POST — request an email change. Does NOT change User.email. Stores a
 * hashed token, emails a confirmation link to the NEW address and a
 * security notice to the OLD address. The change is applied by
 * GET /api/account/email/confirm?token=…
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const newEmail = normalizeEmail(body.email ?? "");

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const currentEmail = currentUser?.email ? normalizeEmail(currentUser.email) : null;

  if (newEmail === currentEmail) {
    return NextResponse.json({ error: "That is already your current email address." }, { status: 400 });
  }

  // Case-insensitive uniqueness check (Postgres text equality is case-sensitive,
  // so a plain findUnique let "Victim@x.com" slip past a stored "victim@x.com").
  const taken = await prisma.user.findFirst({
    where: { email: { equals: newEmail, mode: "insensitive" }, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: "That email address is already associated with another account." },
      { status: 409 }
    );
  }

  // One live request per user: replace any previous pending request.
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.$transaction([
    prisma.emailChangeRequest.deleteMany({ where: { userId } }),
    prisma.emailChangeRequest.create({
      data: { userId, newEmail, tokenHash: hashToken(rawToken), expiresAt },
    }),
  ]);

  const base = process.env.NEXTAUTH_URL ?? "https://backbeat.video";
  const confirmUrl = `${base}/api/account/email/confirm?token=${rawToken}`;

  // Verification → new address. If this send fails the request is useless,
  // so surface it (and clean up) rather than telling the user to check an inbox
  // that will never receive anything.
  let verificationId: string;
  try {
    verificationId = await sendEmailChangeVerification(newEmail, confirmUrl, currentEmail ?? "your account");
  } catch (err) {
    console.error("[account/email] verification email failed:", err);
    await prisma.emailChangeRequest.deleteMany({ where: { userId } }).catch(() => {});
    return NextResponse.json(
      { error: "We couldn't send the confirmation email. Please try again." },
      { status: 502 }
    );
  }

  // Security notice → old address. Awaited so it actually completes before the
  // function returns (a fire-and-forget promise can be frozen by the serverless
  // runtime once the response is sent, and its .catch never runs). A failure is
  // logged but must not block the user — the verification already went out.
  let noticeId: string | null = null;
  if (currentEmail) {
    try {
      noticeId = await sendEmailChangeNotice(currentEmail, newEmail);
    } catch (err) {
      console.error(`[account/email] notice to old address (${currentEmail}) failed:`, err);
    }
  }

  console.log(
    `[account/email] change requested for user ${userId} → ${newEmail} (expires ${expiresAt.toISOString()}); ` +
    `verification sent id=${verificationId} ; notice ${noticeId ? `sent id=${noticeId}` : currentEmail ? "FAILED" : "skipped (no current email)"}`
  );
  return NextResponse.json({ success: true, pending: { newEmail, expiresAt } });
}

/**
 * DELETE — cancel the caller's pending email-change request.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.emailChangeRequest.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ success: true });
}
