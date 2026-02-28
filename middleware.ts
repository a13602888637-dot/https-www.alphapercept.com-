import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  publicRoutes: [
    "/",
    "/api/webhooks/clerk",
    "/api/stock-prices(.*)",
    "/api/stock-price-history(.*)",
    "/api/stocks/search(.*)",
    "/api/intelligence-feed(.*)",
    "/api/analyze-watchlist(.*)",
    // "/api/watchlist(.*)",  // 移除 - 需要认证才能操作自选股
    // "/api/users/sync(.*)",  // 移除 - 需要认证才能同步用户数据
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/ai-inference-demo",
    "/market-pulse-test",
    "/ai-inference-test",
    "/watchlist",  // 页面保持公开，但API需要认证
    "/test",
  ],
  ignoredRoutes: [
    "/api/webhooks/clerk",
  ],
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webp|mp4|webm|ogv|pdf|txt|xml|json)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};