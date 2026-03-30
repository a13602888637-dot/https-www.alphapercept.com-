import { clerkMiddleware } from "@clerk/nextjs/server";

// Use clerkMiddleware() without callback — it injects auth context for all routes.
// Each API route handler checks auth() itself and returns proper 401 errors.
// This avoids the "auth() can't detect clerkMiddleware()" issue that occurs
// with the callback pattern on Vercel serverless.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webp|mp4|webm|ogv|pdf|txt|xml|json)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};