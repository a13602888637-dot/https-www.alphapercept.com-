import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Alpha-Quant-Copilot API",
    version: "1.0.0",
    description: "AI量化投资分析系统API",
    endpoints: {
      auth: "/api/auth/*",
      market: "/api/market/*",
      signals: "/api/signals/*",
      portfolio: "/api/portfolio/*",
      webhooks: "/api/webhooks/*",
    },
  });
}