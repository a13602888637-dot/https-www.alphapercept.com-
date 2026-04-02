import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existing = await prisma.personalNote.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      title, content, type, status, priority, tags, metadata,
      effectiveDate, dateRangeStart, dateRangeEnd, stockCode,
    } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (type !== undefined) data.type = type;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (tags !== undefined) data.tags = tags;
    if (metadata !== undefined) data.metadata = metadata;
    if (stockCode !== undefined) data.stockCode = stockCode;
    if (effectiveDate !== undefined) data.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;
    if (dateRangeStart !== undefined) data.dateRangeStart = dateRangeStart ? new Date(dateRangeStart) : null;
    if (dateRangeEnd !== undefined) data.dateRangeEnd = dateRangeEnd ? new Date(dateRangeEnd) : null;

    const note = await prisma.personalNote.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("[personal-notes PUT] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existing = await prisma.personalNote.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 }
      );
    }

    await prisma.personalNote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[personal-notes DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
