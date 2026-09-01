import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cronAccessDecision } from "../../lib/auth/cron-access";

assert.equal(cronAccessDecision(null, "secret", "production"), "unauthorized");
assert.equal(cronAccessDecision("Bearer wrong", "secret", "production"), "unauthorized");
assert.equal(cronAccessDecision("Bearer secret", "secret", "production"), "allow");
assert.equal(cronAccessDecision(null, "", "production"), "misconfigured");
assert.equal(cronAccessDecision(null, "", "development"), "allow");

const route = readFileSync(resolve("app/api/intelligence-feed/generate/route.ts"), "utf8");
assert.equal(route.includes("export const GET = handleGenerate"), true);
assert.equal(route.includes("export const POST = handleGenerate"), true);
assert.equal(route.includes('req.headers.get("authorization")'), true);
assert.equal(route.includes("searchParams.get('secret')"), false);

console.log("INTELLIGENCE_CRON_AUTH_OK");
