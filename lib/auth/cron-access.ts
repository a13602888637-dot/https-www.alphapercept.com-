import { timingSafeEqual } from "node:crypto";

export type CronAccessDecision = "allow" | "unauthorized" | "misconfigured";

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function cronAccessDecision(
  authorizationHeader: string | null | undefined,
  expectedSecret = process.env.CRON_SECRET ?? "",
  nodeEnv = process.env.NODE_ENV ?? "development",
): CronAccessDecision {
  if (!expectedSecret) return nodeEnv === "production" ? "misconfigured" : "allow";
  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) return "unauthorized";
  return secretsMatch(authorizationHeader.slice(prefix.length), expectedSecret)
    ? "allow"
    : "unauthorized";
}
