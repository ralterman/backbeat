import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashToken, normalizeEmail } from "@/lib/email-change";

/**
 * GET /api/account/email/confirm?token=…
 *
 * Applies a pending email change. Requires BOTH:
 *   1. a valid, unexpired token (proves control of the new inbox), and
 *   2. a signed-in session for the user who made the request — so a third
 *      party who is tricked into clicking the link can't have their address
 *      attached to someone else's account.
 *
 * Redirects back to /account with a status flag the page renders.
 */
export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const done = (flag: string) => NextResponse.redirect(`${base}/account?email=${flag}`);

  const rawToken = req.nextUrl.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return done("invalid");

  const session = await auth();
  if (!session?.user?.id) {
    // Sign in (to the CURRENT address) and come straight back to this link.
    const callback = encodeURIComponent(`/api/account/email/confirm?token=${rawToken}`);
    return NextResponse.redirect(`${base}/auth/signin?callbackUrl=${callback}`);
  }
  const userId = session.user.id;

  const request = await prisma.emailChangeRequest.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!request) return done("invalid");

  if (request.expiresAt.getTime() < Date.now()) {
    await prisma.emailChangeRequest.delete({ where: { id: request.id } }).catch(() => {});
    return done("expired");
  }

  if (request.userId !== userId) {
    console.warn(`[account/email/confirm] token for user ${request.userId} used by session ${userId}`);
    return done("wrong-account");
  }

  const newEmail = normalizeEmail(request.newEmail);

  // Re-check uniqueness at confirm time — someone may have registered this
  // address in the 24 h window. Catch the unique violation as well, since the
  // check-then-write is not atomic.
  const taken = await prisma.user.findFirst({
    where: { email: { equals: newEmail, mode: "insensitive" }, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) {
    await prisma.emailChangeRequest.deleteMany({ where: { userId } }).catch(() => {});
    return done("taken");
  }

  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        // The new address was just proven via the token, so it gets a fresh
        // emailVerified stamp rather than inheriting the old one.
        data: { email: newEmail, emailVerified: new Date() },
      }),
      prisma.emailChangeRequest.deleteMany({ where: { userId } }),
      // Outstanding magic links for the OLD address must not keep working.
      ...(previous?.email
        ? [prisma.verificationToken.deleteMany({
            where: { identifier: { equals: previous.email, mode: "insensitive" } },
          })]
        : []),
    ]);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return done("taken");
    console.error("[account/email/confirm] update failed:", err);
    return done("error");
  }

  console.log(`[account/email/confirm] user ${userId}: ${previous?.email ?? "?"} → ${newEmail}`);
  return done("confirmed");
}
