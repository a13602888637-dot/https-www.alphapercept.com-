import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ownerAccessDecision } from "@/lib/auth/owner-access";

const isPublicOsintReport = createRouteMatcher([
  "/osint/reports(.*)",
  "/api/osint/v1/reports(.*)",
]);

const isOwnerPage = createRouteMatcher([
  "/osint(.*)",
]);

const isOwnerApi = createRouteMatcher([
  "/api/osint/v1/stories(.*)",
  "/api/osint/v1/context(.*)",
  "/api/news-feed(.*)",
  "/api/ai/stream(.*)",
  "/api/ai/situation-analysis(.*)",
  "/api/ai/generate-strategy(.*)",
  "/api/strategy-recommendation",
  "/api/analyze-watchlist(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (request.nextUrl.pathname.startsWith("/uzi-assets/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ownerProtected = !isPublicOsintReport(request) && (isOwnerPage(request) || isOwnerApi(request));
  if (ownerProtected) {
    const { userId } = await auth();
    const access = ownerAccessDecision(
      userId,
      process.env.OSINT_ALLOWED_CLERK_USER_IDS,
      process.env.NODE_ENV,
    );

    if (access === "unauthenticated") {
      if (isOwnerApi(request)) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    if (access !== "allow") {
      if (isOwnerApi(request)) {
        return NextResponse.json({ error: "Owner access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/sign-in?reason=unauthorized", request.url));
    }
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
