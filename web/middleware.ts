import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRedirectHostForHost, isDevelopmentHost } from "./src/lib/site-config";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-search", request.nextUrl.search);

  const currentHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const redirectHost = getRedirectHostForHost(currentHost);

  if (!redirectHost) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.hostname = redirectHost;
  redirectUrl.protocol = isDevelopmentHost(redirectHost) ? "http:" : "https:";

  if (isDevelopmentHost(redirectHost)) {
    redirectUrl.port = request.nextUrl.port;
  } else {
    redirectUrl.port = "";
  }

  return NextResponse.redirect(redirectUrl, 308);
}
