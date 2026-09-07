import assert from "node:assert/strict";

import {
  probeCloseReport,
  readPngDimensions,
} from "../../scripts/probe-osint-close-report.mjs";

function png(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

assert.deepEqual(readPngDimensions(png(1080, 1920)), { width: 1080, height: 1920 });
assert.throws(() => readPngDimensions(Buffer.from("not-png")), /INVALID_PNG/);

const report = {
  id: "report-1",
  reportDate: "2026-09-07",
  edition: "close",
  status: "healthy",
};
const requested = [];
const fetchImpl = async (url) => {
  requested.push(String(url));
  if (String(url).includes("?limit=")) {
    return new Response(JSON.stringify({ reports: [report] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (String(url).endsWith("/report-1")) {
    return new Response(JSON.stringify({
      report: {
        id: report.id,
        snapshot: { lhb: { status: "live", tradeDate: "2026-09-07" } },
      },
      exportReady: true,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(png(1080, 1920), {
    status: 200,
    headers: { "content-type": "image/png" },
  });
};

const result = await probeCloseReport({
  baseUrl: "https://example.com",
  reportDate: "2026-09-07",
  fetchImpl,
});

assert.equal(result.ok, true);
assert.equal(result.reportId, "report-1");
assert.equal(result.exports.stories.width, 1080);
assert.equal(result.exports.hotlist.height, 1920);
assert.equal(requested.length, 4);

console.log("CLOSE_REPORT_PROBE_OK");
