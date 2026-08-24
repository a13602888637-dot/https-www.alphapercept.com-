import assert from "node:assert/strict";

import { MARKET_MANIFEST } from "../../lib/osint/market-manifest";

const required = [
  "^GSPC",
  "^IXIC",
  "^DJI",
  "^N225",
  "^KS11",
  "GEISAC.FGI",
  "NQ=F",
  "ES=F",
  "YM=F",
  "NKD=F",
  "CN00Y",
  "CL=F",
  "BZ=F",
  "^VIX",
  "UST1Y",
  "UST10Y",
  "UST20Y",
  "UST30Y",
];

assert.deepEqual(required.filter((symbol) => !MARKET_MANIFEST[symbol]), []);
assert.equal(MARKET_MANIFEST["CL=F"].name, "WTI原油");
assert.equal(MARKET_MANIFEST["BZ=F"].name, "Brent原油");
assert.equal(MARKET_MANIFEST["^VIX"].instrumentType, "index");
assert.equal(
  new Set(Object.keys(MARKET_MANIFEST)).size,
  Object.keys(MARKET_MANIFEST).length
);

const serializedManifest = JSON.stringify(MARKET_MANIFEST);
for (const retiredSymbol of ["OANDA:BCO_USD", "VIXY", "zn.f", "stooq"]) {
  assert.equal(serializedManifest.includes(retiredSymbol), false);
}

console.log("MARKET_CONTRACT_OK");
