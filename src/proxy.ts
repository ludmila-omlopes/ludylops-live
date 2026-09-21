import { auth } from "@/auth";
import { getCreatorRootPath } from "@/lib/creators/hostname-routing";
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";

const passThrough: NextMiddleware = () => undefined;
const authenticatedProxy = auth(passThrough);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Keep session/database work off the new public-root routing path.
  if (request.nextUrl.pathname === "/") {
    const pathname = getCreatorRootPath(request);
    if (!pathname) return NextResponse.next();
    const destination = request.nextUrl.clone();
    destination.pathname = pathname;
    return NextResponse.rewrite(destination);
  }

  return authenticatedProxy(request, event);
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/admin/:path*", "/owner/:path*", "/api/owner/:path*", "/me/:path*"],
};
