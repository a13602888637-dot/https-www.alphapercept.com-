import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateAndSaveDailyReport } from "@/lib/osint/daily-report/service";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const report = await generateAndSaveDailyReport();
    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error("[osint reports] generation failed", error);
    return NextResponse.json(
      { success: false, error: "日报生成失败，请稍后重试" },
      { status: 503 }
    );
  }
}
