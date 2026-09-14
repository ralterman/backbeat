import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "hello@backbeat.video";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email: newEmail } = (await req.json()) as { email: string };

  // Basic validation
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (newEmail.toLowerCase() === currentUser?.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "That is already your current email address." },
      { status: 400 }
    );
  }

  // Check if another user already has this email
  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "That email address is already associated with another account." },
      { status: 409 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email: newEmail },
  });

  // Notify old and new addresses
  await resend.emails.send({
    from: FROM,
    to: newEmail,
    subject: "Your Backbeat email has been updated",
    html: `<p>Hi,</p><p>Your Backbeat account email has been updated to <strong>${newEmail}</strong>.</p><p>Your next sign-in magic link will be sent to this address.</p><p>If you did not make this change, contact us at <a href="mailto:hello@backbeat.video">hello@backbeat.video</a> immediately.</p>`,
  }).catch((e) => console.error("[account/email] notification email failed:", e));

  return NextResponse.json({ success: true });
}
