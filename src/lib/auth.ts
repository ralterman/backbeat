import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import ResendProvider from "next-auth/providers/resend";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resendClient = new Resend(process.env.RESEND_API_KEY);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ResendProvider({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM ?? "hello@backbeat.me",
      async sendVerificationRequest({ identifier: email, url }) {
        console.log("[auth] Sending magic link to:", email, "| url:", url);
        try {
          const { data, error } = await resendClient.emails.send({
            from: process.env.EMAIL_FROM ?? "hello@backbeat.me",
            to: email,
            subject: "Sign in to Backbeat",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="color:#C8A96E;margin-bottom:8px">Sign in to Backbeat</h2>
                <p style="color:#666;margin-bottom:24px">Click the button below to sign in. This link expires in 24 hours.</p>
                <a href="${url}" style="display:inline-block;background:#ffffff;color:#0a0a0f;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none">
                  Sign in to Backbeat
                </a>
                <p style="color:#999;font-size:12px;margin-top:24px">Or copy this link: ${url}</p>
              </div>
            `,
          });
          if (error) {
            console.error("[auth] Resend error:", JSON.stringify(error));
            throw new Error(`Resend error: ${JSON.stringify(error)}`);
          }
          console.log("[auth] Magic link sent successfully, id:", data?.id);
        } catch (err) {
          console.error("[auth] sendVerificationRequest exception:", err);
          throw err;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
