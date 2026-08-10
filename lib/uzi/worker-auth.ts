import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
export function isAuthorizedUziWorker(request: Request): boolean {
  const configured = process.env.UZI_WORKER_SECRET;
  const header = request.headers.get("authorization");
  if (!configured || !header?.startsWith("Bearer ")) return false;

  const supplied = header.slice(7).trim();
  if (!supplied) return false;
  return timingSafeEqual(digest(configured), digest(supplied));
}

export function safeWorkerId(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{3,64}$/.test(value)
    ? value
    : "local-mac";
}
