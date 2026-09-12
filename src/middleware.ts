// Edge-level auth safety net.
// Unauthenticated requests to any matched path are redirected to /auth/signin.
// Per-page auth() checks remain in place — this middleware is the fallback,
// not the replacement, so a single missed check can't leak a protected route.
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/analyze/:path*",
    "/export/:path*",
    "/account/:path*",
  ],
};
