import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (_auth, request) => {
  if (request.nextUrl.pathname.startsWith("/uzi-assets/")) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/uzi-reports", request.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|api/uzi/youzi-report|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webp|mp4|webm|ogv|pdf|txt|xml|json)).*)",
    // Keep Clerk context on APIs that read user data. The public Uzi quick
    // report is intentionally excluded and never touches account state.
    "/api/((?!uzi/youzi-report).*)",
    "/uzi-assets/(.*)",
    "/trpc(.*)",
  ],
};
