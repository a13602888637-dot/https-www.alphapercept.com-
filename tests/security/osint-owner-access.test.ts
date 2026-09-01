import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerAccessDecision } from "../../lib/auth/owner-access";

assert.equal(ownerAccessDecision(null, "user_a,user_b", "production"), "unauthenticated");
assert.equal(ownerAccessDecision("user_x", "user_a,user_b", "production"), "forbidden");
assert.equal(ownerAccessDecision("user_a", "user_a,user_b", "production"), "allow");
assert.equal(ownerAccessDecision("user_a", " user_a, user_b, user_a ", "production"), "allow");
assert.equal(ownerAccessDecision("user_a", "", "production"), "misconfigured");
assert.equal(ownerAccessDecision("user_a", "", "development"), "allow");

const middleware = readFileSync(resolve("middleware.ts"), "utf8");
const signUpPage = readFileSync(resolve("app/(auth)/sign-up/[[...sign-up]]/page.tsx"), "utf8");

for (const protectedPath of [
  "/api/osint/v1/stories(.*)",
  "/api/osint/v1/context(.*)",
  "/api/news-feed(.*)",
  "/api/ai/stream(.*)",
  "/api/ai/situation-analysis(.*)",
  "/api/ai/generate-strategy(.*)",
  "/api/strategy-recommendation(.*)",
  "/api/analyze-watchlist(.*)",
]) {
  assert.equal(middleware.includes(protectedPath), true, `middleware must protect ${protectedPath}`);
}

assert.equal(middleware.includes('"/osint/reports(.*)"'), true);
assert.equal(middleware.includes('"/api/osint/v1/reports(.*)"'), true);
assert.equal(middleware.includes('"/osint(.*)"'), true);
assert.equal(middleware.includes("OSINT_ALLOWED_CLERK_USER_IDS"), true);
assert.equal(middleware.includes("ownerAccessDecision"), true);
assert.equal(signUpPage.includes('redirect("/sign-in?reason=registration-closed")'), true);
assert.equal(signUpPage.includes("<SignUp"), false);

console.log("OSINT_OWNER_ACCESS_OK");
