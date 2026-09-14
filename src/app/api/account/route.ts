import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Prefix, INPUT_BUCKET, OUTPUT_BUCKET } from "@/lib/s3";
import Stripe from "stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): any {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tag = `[account/delete][${userId}]`;

  // 0. Snapshot what we need BEFORE the cascade removes it.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, videos: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const videoIds = user.videos.map((v) => v.id);

  // 1. Cancel active Stripe subscription (log and continue on failure)
  try {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (sub?.stripeSubscriptionId && sub.status !== "CANCELED") {
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
      console.log(`${tag} canceled Stripe subscription ${sub.stripeSubscriptionId}`);
    }
  } catch (err) {
    console.error(`${tag} Stripe cancellation failed:`, err);
  }

  // 2. Delete S3 objects. Keys are user-prefixed for uploads/exports, but
  //    generated music is keyed by videoId, so walk each video's prefix too.
  //    Failures are logged with the exact prefix for manual cleanup and do not
  //    block deletion — the user asked for their account gone; a transient S3
  //    error shouldn't trap them here.
  const prefixes: Array<[string, string]> = [
    [INPUT_BUCKET,  `uploads/${userId}/`],
    [OUTPUT_BUCKET, `exports/${userId}/`],
    ...videoIds.map((id): [string, string] => [OUTPUT_BUCKET, `generated-music/${id}/`]),
  ];
  const s3Failures: string[] = [];
  let s3Deleted = 0;
  for (const [bucket, prefix] of prefixes) {
    try {
      s3Deleted += await deleteS3Prefix(bucket, prefix);
    } catch (err) {
      s3Failures.push(`${bucket}/${prefix}`);
      console.error(`${tag} S3 delete failed for ${bucket}/${prefix}:`, err);
    }
  }
  console.log(`${tag} S3: deleted ${s3Deleted} object(s) across ${prefixes.length} prefix(es)` +
    (s3Failures.length ? `; ${s3Failures.length} prefix(es) FAILED — manual cleanup needed: ${s3Failures.join(", ")}` : ""));

  // 3. Delete DB rows. User cascades to Video → Analysis/Export/TrackMatch,
  //    Subscription, UsageRecord, Account, Session, EmailChangeRequest.
  //    VerificationToken has NO user FK (it's keyed by email), so remove
  //    outstanding magic links explicitly or one could re-create the account.
  try {
    await prisma.$transaction([
      ...(user.email
        ? [prisma.verificationToken.deleteMany({
            where: { identifier: { equals: user.email, mode: "insensitive" } },
          })]
        : []),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    console.log(`${tag} deleted user row (email ${user.email ?? "n/a"})`);
  } catch (err) {
    console.error(`${tag} DB deletion failed:`, err);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again or contact support." },
      { status: 500 }
    );
  }

  // The client calls next-auth's signOut() after this resolves; the server-side
  // signOut() previously here is unreliable inside a Route Handler and could
  // turn a successful deletion into a 500.
  return NextResponse.json({ success: true, s3Deleted, s3Failures });
}
