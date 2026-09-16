import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import ResendProvider from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { sendEmail, LOGO_ICON_EMAIL_URL } from "@/lib/email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ResendProvider({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM ?? "hello@backbeat.video",
      async sendVerificationRequest({ identifier: email, url }) {
        // Do not log `url` — it is a single-use bearer credential. Delivery is
        // auditable via the Resend message id logged below.
        console.log("[auth] Sending magic link to:", email);

        // Deliberately minimal — unlike the marketing-styled shell used by
        // upgrade/cancellation/etc. Deliverability for an auth email is hurt
        // by heavy HTML: a single embedded image, one link, a short plain
        // body, and a text alternative all reduce the odds of landing in
        // spam/promotions. No tracking is added anywhere in this template
        // (see sendEmail() in lib/email.ts — the Resend send call has no
        // open/click tracking option at all; that's a domain-level toggle,
        // not a per-email one, and this code never touches it).
        const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px">
        <tr><td align="center" style="padding-bottom:24px">
          <img src="${LOGO_ICON_EMAIL_URL}" width="36" height="55" alt="Backbeat" style="display:block;width:36px;height:55px;border:0">
        </td></tr>
        <tr><td style="color:#e0e0e8;font-size:15px;line-height:1.6">
          <p style="margin:0 0 20px">Click below to sign in to Backbeat:</p>
          <p style="margin:0 0 20px"><a href="${url}" style="color:#C8A96E;font-weight:600;text-decoration:underline">Sign in to Backbeat →</a></p>
          <p style="margin:0;color:#6a6a8a;font-size:13px">This link expires in 24 hours and can only be used once. Didn't request this? You can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const text = `Click below to sign in to Backbeat:\n\n${url}\n\nThis link expires in 24 hours and can only be used once. Didn't request this? You can ignore this email.`;

        try {
          const id = await sendEmail({
            to: email,
            subject: "Sign in to Backbeat",
            html,
            text,
            replyTo: "hello@backbeat.video",
          });
          console.log("[auth] Magic link sent successfully, id:", id);
        } catch (err) {
          console.error("[auth] sendVerificationRequest failed:", err);
          throw err;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Sessions are JWTs, so a changed email would otherwise stay stale until
      // re-login. The account page calls useSession().update() after a
      // confirmed email change; refresh the email claim from the DB then.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true },
        });
        if (fresh?.email) token.email = fresh.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/dashboard",
  },
});
