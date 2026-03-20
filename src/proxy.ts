import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/analyze"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
