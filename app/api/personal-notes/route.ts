import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const clerkUserId = await getAuthUserId(req);
    if (!clerkUserId) {
      return NextResponse.json({ success: true, notes: [], count: 0 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ success: true, notes: [], count: 0 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const stockCode = searchParams.get("stockCode");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { userId: user.id };
    if (type) where.type = type;
    if (status) where.status = status;
    if (stockCode) where.stockCode = stockCode;
    if (from || to) {
      where.effectiveDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const notes = await prisma.personalNote.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, notes, count: notes.length });
  } catch (error) {
    console.error("[personal-notes GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const clerkUserId = await getAuthUserId(req);
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      type, title, content, effectiveDate, dateRangeStart, dateRangeEnd,
      stockCode, priority, tags, metadata,
    } = body;

    if (!type || !title) {
      return NextResponse.json(
        { success: false, error: "type and title are required" },
        { status: 400 }
      );
    }

    const note = await prisma.personalNote.create({
      data: {
        userId: user.id,
        type,
        title,
        content: content || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : null,
        dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : null,
        stockCode: stockCode || null,
        priority: priority ?? 0,
        tags: tags || null,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("[personal-notes POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
