import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function jsonWithEtag(request: NextRequest, body: unknown, cacheControl: string): NextResponse {
  const serialized = JSON.stringify(body);
  const etag = `"${createHash("sha256").update(serialized).digest("hex")}"`;
  const headers = { ETag: etag, "Cache-Control": cacheControl };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(serialized, {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
