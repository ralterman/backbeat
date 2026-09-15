import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import ResendProvider from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell, ctaButton, divider } from "@/lib/email";

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

        // Same shell/button/divider as every other transactional email
        // (upgrade, cancellation, email-change, etc.) — this was previously
        // its own hand-rolled template with the old #0a0a0a background, old
        // SVG mark, and a non-serif white wordmark.
        const html = emailShell(`
          <p style="margin:0 0 8px;color:#C8A96E;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Magic link</p>
          <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">Your sign-in link is ready</h1>
          <p style="margin:0 0 32px;color:#a0a0b8;font-size:15px;line-height:1.6">
            Click the button below to sign in to Backbeat. This link expires in <strong style="color:#ffffff">24 hours</strong> and can only be used once.
          </p>
          ${ctaButton("Sign in to Backbeat →", url)}
          ${divider()}
          <p style="margin:0 0 8px;color:#6a6a8a;font-size:12px">Didn't request this? You can safely ignore this email.</p>
          <p style="margin:0;color:#6a6a8a;font-size:12px">If the button doesn't work, copy and paste this link:</p>
          <p style="margin:8px 0 0;word-break:break-all">
            <a href="${url}" style="color:#C8A96E;font-size:12px;text-decoration:none">${url}</a>
          </p>
        `);

        try {
          const id = await sendEmail({ to: email, subject: "Sign in to Backbeat", html });
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
