import { auth } from "@/auth";

export default auth(() => {
  return;
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/owner/:path*", "/api/owner/:path*", "/me/:path*"],
};
