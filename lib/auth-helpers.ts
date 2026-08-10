import { auth, verifyToken } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

const STATIC_AUTHORIZED_PARTIES = [
  "https://www.alphapercept.com",
  "https://alphapercept.com",
  "http://localhost:3000",
  "http://localhost:3100",
];

function toOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const withProtocol = value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `https://${value}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function getAuthorizedParties(): string[] {
  const configuredOrigins = [
    toOrigin(process.env.NEXT_PUBLIC_APP_URL),
    toOrigin(process.env.VERCEL_URL),
    toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ].filter((origin): origin is string => Boolean(origin));

  return Array.from(new Set([...STATIC_AUTHORIZED_PARTIES, ...configuredOrigins]));
}

/**
 * 统一鉴权：已验签的 Bearer Token 优先，Clerk middleware auth() 兜底。
 */
export async function getAuthUserId(req: Request | NextRequest): Promise<string | null> {
  const bearerUserId = await getUserIdFromRequest(req);
  if (bearerUserId) return bearerUserId;

  try {
    const authResult = await auth();
    return authResult.userId;
  } catch {
    return null;
  }
}

/**
 * 从 Authorization Bearer Header 获取经 Clerk 验签的 userId。
 *
 * 不直接解码 JWT payload：只有签名、时效和来源全部通过 Clerk 校验后，
 * 才能信任 token 的 sub claim。
 */
export async function getUserIdFromRequest(req: Request | NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token || !process.env.CLERK_SECRET_KEY) {
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("[auth-helpers] Clerk token verification is not configured");
    }
    return null;
  }

  try {
    const verifiedToken = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: getAuthorizedParties(),
    });

    return typeof verifiedToken.sub === "string" && verifiedToken.sub
      ? verifiedToken.sub
      : null;
  } catch {
    console.warn("[auth-helpers] Rejected invalid bearer token");
    return null;
  }
}

/**
 * 验证用户是否已认证（用于仅支持 Bearer Token 的 API 路由）。
 */
export async function requireAuth(req: Request | NextRequest): Promise<string> {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    throw new Error("Authentication required");
  }

  return userId;
}
