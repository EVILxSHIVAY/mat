import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth/session";

// Public routes that unauthenticated users are allowed to access
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
  "/api/auth",
];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Pass through static files, images, icons, and API auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // 2. Read and verify session cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;
  if (token) {
    session = await verifySessionToken(token);
  }

  // 3. API Route Protection: NEVER redirect API fetch requests to HTML pages
  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Session required." },
        { status: 401 }
      );
    }
    // Strict Server-Side Scope for Role APIs
    if (pathname.startsWith("/api/supplier")) {
      if (session.role !== "SUPPLIER" && session.role !== "ADMIN") {
        return NextResponse.json(
          { success: false, error: "Forbidden. Supplier role required." },
          { status: 403 }
        );
      }
    } else if (pathname.startsWith("/api/vendor")) {
      if (session.role !== "VENDOR" && session.role !== "ADMIN") {
        return NextResponse.json(
          { success: false, error: "Forbidden. Vendor role required." },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  // 4. Page Protection: If unauthenticated and accessing protected page -> Redirect to /login
  if (!session) {
    if (!isPublicRoute) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("from", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 5. Page Role Restrictions: Suppliers and Vendors cannot access unpermitted areas
  if (session.role === "SUPPLIER" && !pathname.startsWith("/supplier") && !isPublicRoute) {
    return NextResponse.redirect(new URL("/supplier", request.url));
  }
  if (session.role === "VENDOR" && !pathname.startsWith("/vendor") && !isPublicRoute) {
    return NextResponse.redirect(new URL("/vendor", request.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
