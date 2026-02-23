import { NextResponse } from "next/server";

export default function middleware() {
  // 暂时禁用所有认证，直接放行所有请求
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webp|mp4|webm|ogv|pdf|txt|xml|json)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};