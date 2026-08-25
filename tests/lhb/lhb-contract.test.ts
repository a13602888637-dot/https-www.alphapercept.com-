import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeLhbSnapshot } from "../../lib/lhb/service";

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
];

const buyRows = [
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "10026937",
    OPERATEDEPT_NAME: "国泰海通证券股份有限公司武汉紫阳东路证券营业部",
    BUY: 174492120.33,
    SELL: 85042,
    NET: 174407078.33,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "10634757",
    OPERATEDEPT_NAME: "深股通专用",
    BUY: 45758299,
    SELL: 48218684.08,
    NET: -2460385.08,
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
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "0",
    OPERATEDEPT_NAME: "机构专用",
    BUY: 8433901,
    SELL: 23463297,
    NET: -15029396,
  },
  {
    SECURITY_CODE: "000620",
    OPERATEDEPT_CODE: "0",
    OPERATEDEPT_NAME: "机构专用",
    BUY: 10,
    SELL: 30,
    NET: -20,
  },
];

const snapshot = normalizeLhbSnapshot("2026-08-24", summaryRows, buyRows, sellRows);
assert.equal(snapshot.schemaVersion, "1.0");
assert.equal(snapshot.stocks.length, 1);
assert.equal(snapshot.stocks[0].netAmount, 372709471.19);
assert.equal(snapshot.stocks[0].buySeats.length, 2);
assert.equal(snapshot.stocks[0].sellSeats.length, 3);
assert.equal(snapshot.seatFlows.filter((seat) => seat.departmentCode === "10634757").length, 1);
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "10026937")?.label, "武汉紫阳东路");
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "10634757")?.category, "northbound");
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "0")?.category, "institution");
assert.equal(snapshot.seatFlows.find((seat) => seat.departmentCode === "0")?.netAmount, -15029416);

const routeSource = readFileSync(resolve("app/api/osint/v1/lhb/route.ts"), "utf8");
assert.equal(routeSource.includes("getLhbSnapshot"), true);
const boardSource = readFileSync(resolve("components/osint-v2/LhbBoard.tsx"), "utf8");
const screenSource = readFileSync(resolve("components/osint-v2/SituationScreen.tsx"), "utf8");
assert.equal(boardSource.includes("资金龙虎榜"), true);
assert.equal(boardSource.includes("/api/osint/v1/lhb"), true);
assert.equal(screenSource.includes("LhbBoard"), true);
console.log("LHB_CONTRACT_OK");
