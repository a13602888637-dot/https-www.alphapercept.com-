import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { email } = body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    let user;
    if (existingUser) {
      // Update existing user
      user = await prisma.user.update({
        where: { clerkUserId },
        data: {
          email: email || existingUser.email,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email: email || null,
          settings: {
            notificationPreferences: {
              email: true,
              push: true,
            },
            theme: "dark",
            language: "zh-CN",
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}