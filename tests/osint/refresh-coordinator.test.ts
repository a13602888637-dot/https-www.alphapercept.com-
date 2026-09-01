import assert from "node:assert/strict";
import { createRefreshCoordinator } from "../../lib/osint/refresh-coordinator";

async function main() {
  let now = 1_000_000;
  let calls = 0;
  let resolveFirst: ((value: number) => void) | undefined;
  const coordinator = createRefreshCoordinator<number>(300_000, () => now);

  const first = coordinator.run("all|1|20", async () => {
    calls += 1;
    return new Promise<number>((resolve) => {
      resolveFirst = resolve;
    });
  });
  const concurrent = coordinator.run("all|1|20", async () => {
    calls += 1;
    return 8;
  });

  assert.equal(calls, 1);
  resolveFirst?.(7);
  assert.equal(await first, 7);
  assert.equal(await concurrent, 7);
  assert.equal(calls, 1);

  assert.equal(await coordinator.run("all|1|20", async () => {
    calls += 1;
    return 8;
  }), 7);
  assert.equal(calls, 1);

  now += 300_001;
  assert.equal(await coordinator.run("all|1|20", async () => {
    calls += 1;
    return 9;
  }), 9);
  assert.equal(calls, 2);

  await assert.rejects(
    coordinator.run("failed", async () => {
      throw new Error("refresh failed");
    }),
    /refresh failed/,
  );
  assert.equal(await coordinator.run("failed", async () => 11), 11);

  coordinator.clear();
  assert.equal(await coordinator.run("all|1|20", async () => 12), 12);

  console.log("REFRESH_COORDINATOR_OK");
}

void main();
