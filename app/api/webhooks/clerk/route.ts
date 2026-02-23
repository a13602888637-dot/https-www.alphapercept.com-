import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

// 定义Clerk用户数据类型
interface ClerkUserData {
  id: string;
  email_addresses?: Array<{
    email_address: string;
    verification?: {
      status: string;
    };
  }>;
  username?: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  public_metadata?: Record<string, any>;
  private_metadata?: Record<string, any>;
  created_at?: number;
  updated_at?: number;
}

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env.local"
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  // Handle different webhook events
  switch (eventType) {
    case "user.created":
      await handleUserCreated(evt.data as ClerkUserData);
      break;
    case "user.updated":
      await handleUserUpdated(evt.data as ClerkUserData);
      break;
    case "user.deleted":
      await handleUserDeleted(evt.data.id);
      break;
    case "session.created":
      console.log("Session created:", evt.data);
      break;
    case "session.ended":
      console.log("Session ended:", evt.data);
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  return NextResponse.json({ success: true });
}

// 辅助函数：重试数据库操作
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`操作失败，重试 ${i + 1}/${maxRetries}:`, error);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}

// 辅助函数：提取用户主要邮箱
function getPrimaryEmail(emailAddresses: ClerkUserData['email_addresses']): string | null {
  if (!emailAddresses || emailAddresses.length === 0) {
    return null;
  }

  // 优先返回已验证的邮箱
  const verifiedEmail = emailAddresses.find(email =>
    email.verification?.status === 'verified'
  );

  if (verifiedEmail) {
    return verifiedEmail.email_address;
  }

  // 如果没有已验证的邮箱，返回第一个邮箱
  return emailAddresses[0].email_address;
}

// 处理用户创建事件
async function handleUserCreated(userData: ClerkUserData) {
  console.log("处理用户创建事件:", userData.id);

  try {
    const email = getPrimaryEmail(userData.email_addresses);

    // 检查用户是否已存在（防止重复创建）
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId: userData.id }
    });

    if (existingUser) {
      console.warn(`用户已存在，跳过创建: ${userData.id}`);
      return;
    }

    await retryOperation(async () => {
      await prisma.user.create({
        data: {
          clerkUserId: userData.id,
          email: email,
          username: userData.username || null,
          firstName: userData.first_name || null,
          lastName: userData.last_name || null,
          imageUrl: userData.image_url || null,
          metadata: {
            publicMetadata: userData.public_metadata || {},
            privateMetadata: userData.private_metadata || {},
            clerkCreatedAt: userData.created_at,
            clerkUpdatedAt: userData.updated_at,
          },
          settings: {
            notificationPreferences: {
              email: true,
              push: true,
            },
            theme: "dark",
            language: "zh-CN",
            tradingPreferences: {
              riskLevel: "medium",
              autoStopLoss: true,
              notificationEnabled: true,
            },
          },
        },
      });
    });

    console.log("用户成功创建:", userData.id);
  } catch (error) {
    console.error("创建用户失败:", error);
    throw error;
  }
}

// 处理用户更新事件
async function handleUserUpdated(userData: ClerkUserData) {
  console.log("处理用户更新事件:", userData.id);

  try {
    const email = getPrimaryEmail(userData.email_addresses);

    await retryOperation(async () => {
      await prisma.user.update({
        where: {
          clerkUserId: userData.id,
        },
        data: {
          email: email,
          username: userData.username || null,
          firstName: userData.first_name || null,
          lastName: userData.last_name || null,
          imageUrl: userData.image_url || null,
          metadata: {
            publicMetadata: userData.public_metadata || {},
            privateMetadata: userData.private_metadata || {},
            clerkUpdatedAt: userData.updated_at,
          },
          updatedAt: new Date(),
        },
      });
    });

    console.log("用户成功更新:", userData.id);
  } catch (error) {
    // 如果用户不存在，尝试创建（处理边缘情况）
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      console.warn(`用户不存在，尝试创建: ${userData.id}`);
      await handleUserCreated(userData);
    } else {
      console.error("更新用户失败:", error);
      throw error;
    }
  }
}

// 处理用户删除事件
async function handleUserDeleted(userId: string) {
  console.log("处理用户删除事件:", userId);

  try {
    await retryOperation(async () => {
      await prisma.user.delete({
        where: {
          clerkUserId: userId,
        },
      });
    });

    console.log("用户成功删除:", userId);
  } catch (error) {
    // 如果用户不存在，记录警告但不抛出错误
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      console.warn(`用户不存在，跳过删除: ${userId}`);
    } else {
      console.error("删除用户失败:", error);
      throw error;
    }
  }
}