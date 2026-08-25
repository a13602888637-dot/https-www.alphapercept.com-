import assert from "node:assert/strict";

import { MARKET_MANIFEST } from "../../lib/osint/market-manifest";
import { getMarketSnapshot } from "../../lib/osint/market-service";

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

function yahooPayload(symbol: string) {
  if (symbol !== "CL=F") {
    return { chart: { result: null, error: { code: "Not Found" } } };
  }
  return {
    chart: {
      result: [
        {
          meta: {
            symbol,
            regularMarketPrice: 85.4,
            chartPreviousClose: 84.9,
            regularMarketTime: 1787580000,
          },
        },
      ],
      error: null,
    },
  };
}

const treasuryXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry><content><m:properties><d:NEW_DATE>2026-08-22T00:00:00</d:NEW_DATE><d:BC_1YEAR>4.91</d:BC_1YEAR><d:BC_10YEAR>4.70</d:BC_10YEAR><d:BC_20YEAR>5.00</d:BC_20YEAR><d:BC_30YEAR>4.85</d:BC_30YEAR></m:properties></content></entry>
  <entry><content><m:properties><d:NEW_DATE>2026-08-21T00:00:00</d:NEW_DATE><d:BC_1YEAR>4.89</d:BC_1YEAR><d:BC_10YEAR>4.68</d:BC_10YEAR><d:BC_20YEAR>4.98</d:BC_20YEAR><d:BC_30YEAR>4.83</d:BC_30YEAR></m:properties></content></entry>
</feed>`;

const fetchFixture: typeof fetch = async (input) => {
  const url = String(input);
  if (url.includes("query1.finance.yahoo.com")) {
    const symbol = decodeURIComponent(url.split("/chart/")[1].split("?")[0]);
    return Response.json(yahooPayload(symbol));
  }
  if (url.includes("push2.eastmoney.com")) {
    return Response.json({
      data: {
        diff: [
          { f2: 14657, f3: 0.03, f4: 5, f12: "CN00Y", f14: "A50期指当月连续", f18: 14652, f124: 1787565310 },
        ],
      },
    });
  }
  if (url.includes("home.treasury.gov")) {
    return new Response(treasuryXml, { status: 200, headers: { "Content-Type": "application/xml" } });
  }
  return new Response(null, { status: 404 });
};

async function verifyMarketService() {
  const snapshot = await getMarketSnapshot(fetchFixture);
  assert.equal(snapshot.markets.find((market) => market.symbol === "CL=F")?.value, 85.4);
  assert.equal(snapshot.markets.find((market) => market.symbol === "CN00Y")?.source, "eastmoney");
  assert.equal(snapshot.markets.find((market) => market.symbol === "UST20Y")?.confidence, "official");
  assert.equal(snapshot.markets.find((market) => market.symbol === "BZ=F")?.status, "unavailable");
  assert.equal(snapshot.coverage.total, Object.keys(MARKET_MANIFEST).length);

  let concurrentYahoo = 0;
  let maxConcurrentYahoo = 0;
  const concurrencyFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("query1.finance.yahoo.com")) {
      concurrentYahoo += 1;
      maxConcurrentYahoo = Math.max(maxConcurrentYahoo, concurrentYahoo);
      await new Promise((resolve) => setTimeout(resolve, 15));
      concurrentYahoo -= 1;
      return Response.json({ chart: { result: null, error: { code: "Not Found" } } });
    }
    if (url.includes("push2.eastmoney.com")) return Response.json({ data: { diff: [] } });
    if (url.includes("home.treasury.gov")) return new Response(treasuryXml, { status: 200 });
    return new Response(null, { status: 404 });
  };
  await getMarketSnapshot(concurrencyFetch);
  assert.ok(
    maxConcurrentYahoo >= 10 && maxConcurrentYahoo <= 12,
    `Yahoo requests should use bounded parallelism, observed ${maxConcurrentYahoo}`
  );

  let nkdAttempts = 0;
  const retryFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("query1.finance.yahoo.com") || url.includes("query2.finance.yahoo.com")) {
      const symbol = decodeURIComponent(url.split("/chart/")[1].split("?")[0]);
      if (symbol === "NKD=F") {
        nkdAttempts += 1;
        if (url.includes("query2.finance.yahoo.com")) {
          return Response.json({ chart: { result: [{ meta: { regularMarketPrice: 38150, chartPreviousClose: 38300, regularMarketTime: 1787580000 } }], error: null } });
        }
      }
      return Response.json({ chart: { result: null, error: { code: "Not Found" } } });
    }
    if (url.includes("push2.eastmoney.com")) return Response.json({ data: { diff: [] } });
    if (url.includes("home.treasury.gov")) return new Response(treasuryXml, { status: 200 });
    return new Response(null, { status: 404 });
  };
  const retried = await getMarketSnapshot(retryFetch);
  assert.equal(nkdAttempts, 2);
  assert.equal(retried.markets.find((market) => market.symbol === "NKD=F")?.value, 38150);
  console.log("MARKET_SERVICE_OK");
}

void verifyMarketService();
