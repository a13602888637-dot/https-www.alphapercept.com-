import type { LhbSeat, LhbSeatFlow, LhbSnapshot, LhbStock } from "./contracts";
import { EXACT_SEAT_ALIASES } from "./seat-aliases";

type RawRow = Record<string, unknown>;

const CACHE_TTL_MS = 5 * 60 * 1_000;
const cache = new Map<string, { snapshot: LhbSnapshot; timestamp: number }>();

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function classifySeat(name: string): Pick<LhbSeat, "label" | "category" | "aliasConfidence"> {
  if (name.includes("机构专用")) return { label: "机构专用", category: "institution", aliasConfidence: null };
  if (name.includes("沪股通专用") || name.includes("深股通专用")) {
    return { label: name.includes("沪股通") ? "沪股通" : "深股通", category: "northbound", aliasConfidence: null };
  }
  const alias = EXACT_SEAT_ALIASES[name];
  if (alias) return { label: alias.label, category: alias.category, aliasConfidence: alias.confidence };
  const location = name
    .replace(/^.*?证券(?:股份)?有限公司/, "")
    .replace(/^.*?证券有限责任公司/, "")
    .replace(/证券营业部$/, "")
    .replace(/营业部$/, "")
    .trim();
  return { label: location || name, category: "broker", aliasConfidence: null };
}

function toSeat(row: RawRow): LhbSeat {
  const departmentName = stringValue(row.OPERATEDEPT_NAME);
  return {
    departmentCode: stringValue(row.OPERATEDEPT_CODE),
    departmentName,
    ...classifySeat(departmentName),
    buyAmount: numberValue(row.BUY),
    sellAmount: numberValue(row.SELL),
    netAmount: numberValue(row.NET),
  };
}

export function normalizeLhbSnapshot(
  tradeDate: string,
  summaryRows: RawRow[],
  buyRows: RawRow[],
  sellRows: RawRow[]
): LhbSnapshot {
  const summaryByCode = new Map<string, RawRow[]>();
  for (const row of summaryRows) {
    const code = stringValue(row.SECURITY_CODE);
    if (!code) continue;
    const rows = summaryByCode.get(code) ?? [];
    rows.push(row);
    summaryByCode.set(code, rows);
  }

  const buyByCode = new Map<string, LhbSeat[]>();
  const sellByCode = new Map<string, LhbSeat[]>();
  for (const row of buyRows) {
    const code = stringValue(row.SECURITY_CODE);
    if (!code) continue;
    buyByCode.set(code, [...(buyByCode.get(code) ?? []), toSeat(row)]);
  }
  for (const row of sellRows) {
    const code = stringValue(row.SECURITY_CODE);
    if (!code) continue;
    sellByCode.set(code, [...(sellByCode.get(code) ?? []), toSeat(row)]);
  }

  const stocks: LhbStock[] = [...summaryByCode.entries()].map(([code, rows]) => {
    const primary = [...rows].sort((left, right) => Math.abs(numberValue(right.BILLBOARD_NET_AMT)) - Math.abs(numberValue(left.BILLBOARD_NET_AMT)))[0];
    return {
      code,
      name: stringValue(primary.SECURITY_NAME_ABBR),
      changePercent: primary.CHANGE_RATE === null || primary.CHANGE_RATE === undefined ? null : numberValue(primary.CHANGE_RATE),
      buyAmount: numberValue(primary.BILLBOARD_BUY_AMT),
      sellAmount: numberValue(primary.BILLBOARD_SELL_AMT),
      netAmount: numberValue(primary.BILLBOARD_NET_AMT),
      reasons: [...new Set(rows.map((row) => stringValue(row.EXPLANATION)).filter(Boolean))],
      buySeats: [...(buyByCode.get(code) ?? [])].sort((left, right) => right.buyAmount - left.buyAmount),
      sellSeats: [...(sellByCode.get(code) ?? [])].sort((left, right) => right.sellAmount - left.sellAmount),
    };
  }).sort((left, right) => right.netAmount - left.netAmount);

  const stockNames = new Map(stocks.map((stock) => [stock.code, stock.name]));
  const uniqueSeatRows = new Map<string, { code: string; seat: LhbSeat }>();
  for (const row of [...buyRows, ...sellRows]) {
    const code = stringValue(row.SECURITY_CODE);
    const seat = toSeat(row);
    const key = `${code}|${seat.departmentCode || seat.departmentName}|${seat.buyAmount}|${seat.sellAmount}|${seat.netAmount}`;
    const previous = uniqueSeatRows.get(key);
    if (!previous || Math.abs(seat.netAmount) > Math.abs(previous.seat.netAmount)) uniqueSeatRows.set(key, { code, seat });
  }

  const flows = new Map<string, LhbSeatFlow>();
  for (const { code, seat } of uniqueSeatRows.values()) {
    const flowKey = seat.departmentCode || seat.departmentName;
    const flow = flows.get(flowKey) ?? { ...seat, buyAmount: 0, sellAmount: 0, netAmount: 0, stocks: [] };
    flow.buyAmount += seat.buyAmount;
    flow.sellAmount += seat.sellAmount;
    flow.netAmount += seat.netAmount;
    flow.stocks.push({ code, name: stockNames.get(code) ?? code, buyAmount: seat.buyAmount, sellAmount: seat.sellAmount, netAmount: seat.netAmount });
    flows.set(flowKey, flow);
  }
  const seatFlows = [...flows.values()].sort((left, right) => Math.abs(right.netAmount) - Math.abs(left.netAmount));

  return {
    schemaVersion: "1.0",
    tradeDate,
    generatedAt: new Date().toISOString(),
    source: "eastmoney",
    stockCount: stocks.length,
    seatCount: seatFlows.length,
    stocks,
    seatFlows,
    disclaimer: "龙虎榜金额来自公开盘后数据；游资别名仅为民间观察映射，不代表真实账户身份。",
  };
}

function reportUrl(reportName: string, date: string | null, sortColumns: string, pageSize: number): string {
  const params = new URLSearchParams({
    reportName,
    columns: "ALL",
    source: "WEB",
    client: "WEB",
    pageNumber: "1",
    pageSize: String(pageSize),
    sortTypes: "-1",
    sortColumns,
  });
  if (date) params.set("filter", `(TRADE_DATE='${date}')`);
  return `https://datacenter-web.eastmoney.com/api/data/v1/get?${params.toString()}`;
}

async function fetchRows(reportName: string, date: string | null, sortColumns: string, pageSize: number, fetchImpl: typeof fetch): Promise<RawRow[]> {
  const response = await fetchImpl(reportUrl(reportName, date, sortColumns, pageSize), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaQuant/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.result?.data) ? payload.result.data : [];
}

async function latestTradeDate(fetchImpl: typeof fetch): Promise<string | null> {
  const rows = await fetchRows("RPT_DAILYBILLBOARD_DETAILSNEW", null, "TRADE_DATE", 1, fetchImpl);
  const raw = stringValue(rows[0]?.TRADE_DATE);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
}

export async function getLhbSnapshot(options: { date?: string; fetchImpl?: typeof fetch } = {}): Promise<LhbSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestedDate = options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : null;
  const tradeDate = requestedDate ?? await latestTradeDate(fetchImpl);
  if (!tradeDate) return normalizeLhbSnapshot("", [], [], []);
  const cached = cache.get(tradeDate);
  if (fetchImpl === fetch && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.snapshot;

  const [summaryRows, buyRows, sellRows] = await Promise.all([
    fetchRows("RPT_DAILYBILLBOARD_DETAILSNEW", tradeDate, "BILLBOARD_NET_AMT", 500, fetchImpl),
    fetchRows("RPT_BILLBOARD_DAILYDETAILSBUY", tradeDate, "BUY", 500, fetchImpl),
    fetchRows("RPT_BILLBOARD_DAILYDETAILSSELL", tradeDate, "SELL", 500, fetchImpl),
  ]);
  const snapshot = normalizeLhbSnapshot(tradeDate, summaryRows, buyRows, sellRows);
  if (fetchImpl === fetch && snapshot.stocks.length > 0) cache.set(tradeDate, { snapshot, timestamp: Date.now() });
  return snapshot;
}
