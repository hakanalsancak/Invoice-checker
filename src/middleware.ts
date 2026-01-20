import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get the session token from cookies
  const sessionToken = request.cookies.get("authjs.session-token")?.value ||
                       request.cookies.get("__Secure-authjs.session-token")?.value;
  
  const isLoggedIn = !!sessionToken;

  const isAuthPage = pathname.startsWith("/login") || 
                     pathname.startsWith("/register");
  
  const isApiRoute = pathname.startsWith("/api");
  const isPublicRoute = pathname === "/" || 
                        pathname.startsWith("/_next") ||
                        pathname.startsWith("/favicon");

  // Allow API routes to handle their own auth
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Allow public routes
  if (isPublicRoute || isAuthPage) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/auth).*)",
  ],
};
