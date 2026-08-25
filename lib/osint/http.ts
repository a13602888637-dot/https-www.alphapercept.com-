import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function withoutGeneratedAt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutGeneratedAt);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "generatedAt")
        .map(([key, nested]) => [key, withoutGeneratedAt(nested)])
    );
  }
  return value;
}

export function etagForBody(body: unknown): string {
  return `"${createHash("sha256").update(JSON.stringify(withoutGeneratedAt(body))).digest("hex")}"`;
}

export function jsonWithEtag(request: NextRequest, body: unknown, cacheControl: string): NextResponse {
  const serialized = JSON.stringify(body);
  const etag = etagForBody(body);
  const headers = { ETag: etag, "Cache-Control": cacheControl };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(serialized, {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
