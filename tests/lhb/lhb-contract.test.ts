import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getLhbSnapshot, normalizeLhbSnapshot } from "../../lib/lhb/service";
import { EXACT_SEAT_ALIASES } from "../../lib/lhb/seat-aliases";

assert.ok(Object.keys(EXACT_SEAT_ALIASES).length >= 30);
assert.equal(EXACT_SEAT_ALIASES["国泰海通证券股份有限公司上海江苏路证券营业部"]?.label, "章盟主观察席");
assert.equal(EXACT_SEAT_ALIASES["华泰证券股份有限公司浙江分公司"]?.label, "消闲派观察席");

const summaryRows = [
  {
    TRADE_DATE: "2026-08-24 00:00:00",
    SECURITY_CODE: "000620",
    SECURITY_NAME_ABBR: "盈新发展",
    BILLBOARD_NET_AMT: 372709471.19,
    BILLBOARD_BUY_AMT: 515341280.27,
    BILLBOARD_SELL_AMT: 142631809.08,
    EXPLANATION: "日涨幅偏离值达到7%的前5只证券",
    CHANGE_RATE: 10.1587,
    TRADE_ID: 100400463,
  },
  {
    TRADE_DATE: "2026-08-24 00:00:00",
    SECURITY_CODE: "000620",
    SECURITY_NAME_ABBR: "盈新发展",
    BILLBOARD_NET_AMT: -197500000,
    BILLBOARD_BUY_AMT: 10000000,
    BILLBOARD_SELL_AMT: 207500000,
    EXPLANATION: "连续三个交易日内涨幅偏离值累计达到20%",
    CHANGE_RATE: 21,
    TRADE_ID: 200400463,
  },
  {
    TRADE_DATE: "2026-08-24 00:00:00",
    SECURITY_CODE: "999999",
    SECURITY_NAME_ABBR: "字段缺失样本",
    EXPLANATION: "测试",
    TRADE_ID: 999,
  },
];

const buyRows = [
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "10026937",
    OPERATEDEPT_NAME: "国泰海通证券股份有限公司武汉紫阳东路证券营业部",
    BUY: 174492120.33,
    SELL: 85042,
    NET: 174407078.33,
    TRADE_ID: 100400463,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "10634757",
    OPERATEDEPT_NAME: "深股通专用",
    BUY: 45758299,
    SELL: 48218684.08,
    NET: -2460385.08,
    TRADE_ID: 100400463,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "trade-2-buy",
    OPERATEDEPT_NAME: "测试三日榜买方证券营业部",
    BUY: 10000000,
    SELL: 0,
    NET: 10000000,
    TRADE_ID: 200400463,
  },
];

const sellRows = [
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "10634757",
    OPERATEDEPT_NAME: "深股通专用",
    BUY: 45758299,
    SELL: 48218684.08,
    NET: -2460385.08,
    TRADE_ID: 100400463,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "0",
    OPERATEDEPT_NAME: "机构专用",
    BUY: 8433901,
    SELL: 23463297,
    NET: -15029396,
    TRADE_ID: 100400463,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "0",
    OPERATEDEPT_NAME: "机构专用",
    BUY: 10,
    SELL: 30,
    NET: -20,
    TRADE_ID: 100400463,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "trade-2-sell",
    OPERATEDEPT_NAME: "测试三日榜卖方证券营业部",
    BUY: 0,
    SELL: 207500000,
    NET: -207500000,
    TRADE_ID: 200400463,
  },
];

const snapshot = normalizeLhbSnapshot("2026-08-24", summaryRows, buyRows, sellRows);
assert.equal(snapshot.schemaVersion, "1.0");
assert.equal(snapshot.status, "live");
assert.equal(snapshot.invalidRowCount, 1);
assert.equal(snapshot.stocks.length, 2);
assert.equal(snapshot.stocks[0].netAmount, 372709471.19);
assert.equal(snapshot.stocks[0].tradeId, "100400463");
assert.equal(snapshot.stocks[0].buySeats.length, 2);
assert.equal(snapshot.stocks[0].sellSeats.length, 3);
assert.equal(snapshot.seatFlows.filter((seat) => seat.departmentCode === "10634757").length, 1);
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "10026937")?.label, "武汉紫阳东路");
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "10634757")?.category, "northbound");
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "0")?.category, "institution");
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "0")?.netAmount, -15029416);
const secondWindow = snapshot.stocks.find((stock) => stock.tradeId === "200400463");
assert.equal(secondWindow?.netAmount, -197500000);
assert.deepEqual(secondWindow?.buySeats.map((seat) => seat.departmentCode), ["trade-2-buy"]);
assert.deepEqual(secondWindow?.sellSeats.map((seat) => seat.departmentCode), ["trade-2-sell"]);

const routeSource = readFileSync(resolve("app/api/osint/v1/lhb/route.ts"), "utf8");
assert.equal(routeSource.includes("getLhbSnapshot"), true);
assert.equal(routeSource.includes("status: 503"), true);
const boardSource = readFileSync(resolve("components/osint-v2/LhbBoard.tsx"), "utf8");
const screenSource = readFileSync(resolve("components/osint-v2/SituationScreen.tsx"), "utf8");
assert.equal(boardSource.includes("资金龙虎榜"), true);
assert.equal(boardSource.includes("/api/osint/v1/lhb"), true);
assert.equal(screenSource.includes("LhbBoard"), true);

async function verifyUnavailable() {
  const failed = await getLhbSnapshot({ fetchImpl: async () => new Response(null, { status: 500 }) });
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.stockCount, 0);
  assert.ok(failed.errors.length > 0);
  console.log("LHB_CONTRACT_OK");
}

void verifyUnavailable();
