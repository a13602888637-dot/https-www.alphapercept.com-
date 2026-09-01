export type OwnerAccessDecision =
  | "allow"
  | "unauthenticated"
  | "forbidden"
  | "misconfigured";

export function ownerAccessDecision(
  userId: string | null | undefined,
  allowlistValue = process.env.OSINT_ALLOWED_CLERK_USER_IDS ?? "",
  nodeEnv = process.env.NODE_ENV ?? "development",
): OwnerAccessDecision {
  if (!userId) return "unauthenticated";

  const allowedUserIds = new Set(
    allowlistValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (allowedUserIds.size === 0) {
    return nodeEnv === "production" ? "misconfigured" : "allow";
  }

  return allowedUserIds.has(userId) ? "allow" : "forbidden";
}
