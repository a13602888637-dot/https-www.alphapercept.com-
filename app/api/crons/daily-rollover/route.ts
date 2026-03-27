import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.portfolio.updateMany({
      where: { tradeStatus: "T_LOCKED" },
      data: { tradeStatus: "TRADABLE" },
    });

    console.log(`[Daily Rollover] Unlocked ${result.count} T+1 positions`);

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('[Daily Rollover] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// GET handler for Vercel Cron Jobs
export async function GET(req: Request) {
  return POST(req);
}
