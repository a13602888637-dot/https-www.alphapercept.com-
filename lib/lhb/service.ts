import type { LhbDashboardSnapshot, LhbHotMoneyFlow, LhbHotMoneyStock, LhbSeat, LhbSeatFlow, LhbSnapshot, LhbStock } from "./contracts";
import { EXACT_SEAT_ALIASES } from "./seat-aliases";

type RawRow = Record<string, unknown>;
type FetchRowsResult = { rows: RawRow[]; ok: boolean; error: string | null };

const CACHE_TTL_MS = 5 * 60 * 1_000;
const cache = new Map<string, { snapshot: LhbSnapshot; timestamp: number }>();
let latestSnapshotCache: { snapshot: LhbSnapshot; timestamp: number } | null = null;
let latestSnapshotInFlight: Promise<LhbSnapshot> | null = null;

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function moneyValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function tradeIdForRow(row: RawRow): string {
  return stringValue(row.TRADE_ID) || `${stringValue(row.SECURITY_CODE)}|${stringValue(row.EXPLANATION)}`;
}

function isMultiSessionReason(reason: string): boolean {
  return /连续.{0,12}(?:三个|3个?)交易日|(?:三个|3个?)交易日.{0,12}累计/.test(reason);
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
  let invalidRowCount = 0;
  const summaryByTrade = new Map<string, RawRow[]>();
  for (const row of summaryRows) {
    const code = stringValue(row.SECURITY_CODE);
    const requiredAmounts = [row.BILLBOARD_BUY_AMT, row.BILLBOARD_SELL_AMT, row.BILLBOARD_NET_AMT];
    if (!code || requiredAmounts.some((value) => value === null || value === undefined || !Number.isFinite(Number(value)))) {
      invalidRowCount += 1;
      continue;
    }
    const key = `${code}|${tradeIdForRow(row)}`;
    const rows = summaryByTrade.get(key) ?? [];
    rows.push(row);
    summaryByTrade.set(key, rows);
  }

  const buyByTrade = new Map<string, LhbSeat[]>();
  const sellByTrade = new Map<string, LhbSeat[]>();
  for (const row of buyRows) {
    const code = stringValue(row.SECURITY_CODE);
    if (!code || !stringValue(row.OPERATEDEPT_NAME) || [row.BUY, row.SELL, row.NET].every((value) => value === undefined)) {
      invalidRowCount += 1;
      continue;
    }
    const key = `${code}|${tradeIdForRow(row)}`;
    buyByTrade.set(key, [...(buyByTrade.get(key) ?? []), toSeat(row)]);
  }
  for (const row of sellRows) {
    const code = stringValue(row.SECURITY_CODE);
    if (!code || !stringValue(row.OPERATEDEPT_NAME) || [row.BUY, row.SELL, row.NET].every((value) => value === undefined)) {
      invalidRowCount += 1;
      continue;
    }
    const key = `${code}|${tradeIdForRow(row)}`;
    sellByTrade.set(key, [...(sellByTrade.get(key) ?? []), toSeat(row)]);
  }

  const stocks: LhbStock[] = [...summaryByTrade.entries()].map(([key, rows]) => {
    const primary = [...rows].sort((left, right) => Math.abs(numberValue(right.BILLBOARD_NET_AMT)) - Math.abs(numberValue(left.BILLBOARD_NET_AMT)))[0];
    const code = stringValue(primary.SECURITY_CODE);
    return {
      tradeId: tradeIdForRow(primary),
      code,
      name: stringValue(primary.SECURITY_NAME_ABBR),
      changePercent: primary.CHANGE_RATE === null || primary.CHANGE_RATE === undefined ? null : numberValue(primary.CHANGE_RATE),
      buyAmount: numberValue(primary.BILLBOARD_BUY_AMT),
      sellAmount: numberValue(primary.BILLBOARD_SELL_AMT),
      netAmount: numberValue(primary.BILLBOARD_NET_AMT),
      reasons: [...new Set(rows.map((row) => stringValue(row.EXPLANATION)).filter(Boolean))],
      buySeats: [...(buyByTrade.get(key) ?? [])].sort((left, right) => right.buyAmount - left.buyAmount),
      sellSeats: [...(sellByTrade.get(key) ?? [])].sort((left, right) => right.sellAmount - left.sellAmount),
    };
  }).sort((left, right) => right.netAmount - left.netAmount);

  const stocksByTrade = new Map(stocks.map((stock) => [`${stock.code}|${stock.tradeId}`, stock]));
  const uniqueSeatRows = new Map<string, { code: string; tradeId: string; seat: LhbSeat }>();
  for (const row of [...buyRows, ...sellRows]) {
    const code = stringValue(row.SECURITY_CODE);
    if (!code || !stringValue(row.OPERATEDEPT_NAME) || [row.BUY, row.SELL, row.NET].every((value) => value === undefined)) continue;
    const tradeId = tradeIdForRow(row);
    const seat = toSeat(row);
    const key = `${tradeId}|${code}|${seat.departmentCode || seat.departmentName}|${seat.buyAmount}|${seat.sellAmount}|${seat.netAmount}`;
    const previous = uniqueSeatRows.get(key);
    if (!previous || Math.abs(seat.netAmount) > Math.abs(previous.seat.netAmount)) uniqueSeatRows.set(key, { code, tradeId, seat });
  }

  const flows = new Map<string, LhbSeatFlow>();
  for (const { code, tradeId, seat } of uniqueSeatRows.values()) {
    const departmentKey = seat.departmentCode || seat.departmentName;
    const flowKey = `${tradeId}|${code}|${departmentKey}`;
    const stock = stocksByTrade.get(`${code}|${tradeId}`);
    const reason = stock?.reasons.join(" / ") ?? "";
    const flow = flows.get(flowKey) ?? { ...seat, flowId: flowKey, tradeId, reason, buyAmount: 0, sellAmount: 0, netAmount: 0, stocks: [] };
    flow.buyAmount += seat.buyAmount;
    flow.sellAmount += seat.sellAmount;
    flow.netAmount += seat.netAmount;
    if (flow.stocks.length === 0) {
      flow.stocks.push({ tradeId, code, name: stock?.name ?? code, reason, buyAmount: seat.buyAmount, sellAmount: seat.sellAmount, netAmount: seat.netAmount });
    } else {
      flow.stocks[0].buyAmount += seat.buyAmount;
      flow.stocks[0].sellAmount += seat.sellAmount;
      flow.stocks[0].netAmount += seat.netAmount;
    }
    flows.set(flowKey, flow);
  }
  const seatFlows = [...flows.values()].sort((left, right) => Math.abs(right.netAmount) - Math.abs(left.netAmount));
  const hotMoneyBySeat = new Map<string, LhbHotMoneyFlow & { stocksByCode: Map<string, LhbHotMoneyStock> }>();
  const confidenceRank = { A: 0, B: 1, C: 2 } as const;
  for (const seat of seatFlows) {
    if (seat.category === "institution" || seat.category === "northbound" || seat.buyAmount <= 0 || isMultiSessionReason(seat.reason)) continue;
    const kind = seat.category === "known-seat" ? "known" as const : "active" as const;
    const departmentKey = seat.departmentCode || seat.departmentName;
    const flowId = kind === "known" ? `known:${seat.label}` : `active:${departmentKey}`;
    const flow = hotMoneyBySeat.get(flowId) ?? {
      flowId,
      kind,
      label: seat.label,
      confidence: seat.aliasConfidence,
      departmentNames: [],
      totalBuyAmount: 0,
      totalSellAmount: 0,
      totalNetAmount: 0,
      stockCount: 0,
      stocks: [],
      stocksByCode: new Map<string, LhbHotMoneyStock>(),
    };
    if (seat.aliasConfidence && (!flow.confidence || confidenceRank[seat.aliasConfidence] < confidenceRank[flow.confidence])) flow.confidence = seat.aliasConfidence;
    if (!flow.departmentNames.includes(seat.departmentName)) flow.departmentNames.push(seat.departmentName);
    flow.totalBuyAmount += seat.buyAmount;
    flow.totalSellAmount += seat.sellAmount;
    flow.totalNetAmount += seat.netAmount;
    for (const stock of seat.stocks) {
      const current = flow.stocksByCode.get(stock.code) ?? {
        code: stock.code,
        name: stock.name,
        reasons: [],
        buyAmount: 0,
        sellAmount: 0,
        netAmount: 0,
      };
      current.buyAmount += stock.buyAmount;
      current.sellAmount += stock.sellAmount;
      current.netAmount += stock.netAmount;
      if (stock.reason && !current.reasons.includes(stock.reason)) current.reasons.push(stock.reason);
      flow.stocksByCode.set(stock.code, current);
    }
    hotMoneyBySeat.set(flowId, flow);
  }
  const hotMoneyFlows = [...hotMoneyBySeat.values()]
    .map(({ stocksByCode, ...flow }) => ({
      ...flow,
      totalBuyAmount: moneyValue(flow.totalBuyAmount),
      totalSellAmount: moneyValue(flow.totalSellAmount),
      totalNetAmount: moneyValue(flow.totalNetAmount),
      departmentNames: [...flow.departmentNames].sort(),
      stockCount: stocksByCode.size,
      stocks: [...stocksByCode.values()]
        .map((stock) => ({
          ...stock,
          buyAmount: moneyValue(stock.buyAmount),
          sellAmount: moneyValue(stock.sellAmount),
          netAmount: moneyValue(stock.netAmount),
        }))
        .sort((left, right) => right.buyAmount - left.buyAmount),
    }))
    .sort((left, right) => right.totalBuyAmount - left.totalBuyAmount);

  return {
    schemaVersion: "1.0",
    status: "live",
    tradeDate,
    generatedAt: new Date().toISOString(),
    asOf: tradeDate ? `${tradeDate}T00:00:00+08:00` : null,
    source: "eastmoney",
    sourceHealth: { summary: true, buySeats: true, sellSeats: true },
    errors: [],
    invalidRowCount,
    stockCount: stocks.length,
    seatCount: seatFlows.length,
    stocks,
    seatFlows,
    hotMoneyFlows,
    disclaimer: "龙虎榜金额来自公开盘后数据；游资别名仅为民间观察映射，不代表真实账户身份；连续多日榜不与单日榜加总。",
  };
}

export function toLhbDashboardSnapshot(snapshot: LhbSnapshot): LhbDashboardSnapshot {
  const { seatFlows: _seatFlows, stocks, hotMoneyFlows, ...metadata } = snapshot;
  const knownFlows = hotMoneyFlows.filter((flow) => flow.kind === "known");
  const activeFlows = hotMoneyFlows.filter((flow) => flow.kind === "active").slice(0, 20);
  return {
    ...metadata,
    stocks: stocks.map(({ buySeats: _buySeats, sellSeats: _sellSeats, ...stock }) => stock),
    hotMoneyFlows: [...knownFlows, ...activeFlows]
      .sort((left, right) => right.totalBuyAmount - left.totalBuyAmount)
      .map((flow) => ({ ...flow, stockCount: Math.max(flow.stockCount, flow.stocks.length), stocks: flow.stocks.slice(0, 3) })),
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

async function fetchRows(reportName: string, date: string | null, sortColumns: string, pageSize: number, fetchImpl: typeof fetch): Promise<FetchRowsResult> {
  try {
    const response = await fetchImpl(reportUrl(reportName, date, sortColumns, pageSize), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaQuant/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { rows: [], ok: false, error: `${reportName}: HTTP ${response.status}` };
    const payload = await response.json();
    if (!Array.isArray(payload?.result?.data)) return { rows: [], ok: false, error: `${reportName}: invalid payload` };
    return { rows: payload.result.data, ok: true, error: null };
  } catch (error) {
    return { rows: [], ok: false, error: `${reportName}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function latestTradeDate(fetchImpl: typeof fetch): Promise<{ date: string | null; error: string | null }> {
  const result = await fetchRows("RPT_DAILYBILLBOARD_DETAILSNEW", null, "TRADE_DATE", 1, fetchImpl);
  const raw = stringValue(result.rows[0]?.TRADE_DATE);
  return {
    date: /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null,
    error: result.ok ? null : result.error,
  };
}

async function loadLhbSnapshot(options: { date?: string; fetchImpl?: typeof fetch } = {}): Promise<LhbSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestedDate = options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : null;
  const latest = requestedDate ? { date: requestedDate, error: null } : await latestTradeDate(fetchImpl);
  const tradeDate = latest.date;
  if (!tradeDate) {
    return {
      ...normalizeLhbSnapshot("", [], [], []),
      status: "unavailable",
      sourceHealth: { summary: false, buySeats: false, sellSeats: false },
      errors: [latest.error ?? "无法确定最近龙虎榜交易日"],
    };
  }
  const cached = cache.get(tradeDate);
  if (fetchImpl === fetch && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.snapshot;

  const [summaryResult, buyResult, sellResult] = await Promise.all([
    fetchRows("RPT_DAILYBILLBOARD_DETAILSNEW", tradeDate, "BILLBOARD_NET_AMT", 500, fetchImpl),
    fetchRows("RPT_BILLBOARD_DAILYDETAILSBUY", tradeDate, "BUY", 500, fetchImpl),
    fetchRows("RPT_BILLBOARD_DAILYDETAILSSELL", tradeDate, "SELL", 500, fetchImpl),
  ]);
  const seatDataComplete = buyResult.ok && sellResult.ok;
  const snapshot = normalizeLhbSnapshot(
    tradeDate,
    summaryResult.rows,
    seatDataComplete ? buyResult.rows : [],
    seatDataComplete ? sellResult.rows : []
  );
  snapshot.status = !summaryResult.ok ? "unavailable" : seatDataComplete ? "live" : "degraded";
  snapshot.sourceHealth = { summary: summaryResult.ok, buySeats: buyResult.ok, sellSeats: sellResult.ok };
  snapshot.errors = [summaryResult.error, buyResult.error, sellResult.error].filter((error): error is string => Boolean(error));
  if (snapshot.invalidRowCount > 0) {
    if (snapshot.status === "live") snapshot.status = "degraded";
    snapshot.errors.push(`${snapshot.invalidRowCount} 条龙虎榜记录字段缺失，已丢弃`);
  }
  if (fetchImpl === fetch && snapshot.status !== "unavailable" && snapshot.stocks.length > 0) {
    cache.set(tradeDate, { snapshot, timestamp: Date.now() });
  }
  return snapshot;
}

export async function getLhbSnapshot(options: { date?: string; fetchImpl?: typeof fetch } = {}): Promise<LhbSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const hasRequestedDate = Boolean(options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date));
  if (fetchImpl !== fetch || hasRequestedDate) return loadLhbSnapshot(options);
  if (latestSnapshotCache && Date.now() - latestSnapshotCache.timestamp < CACHE_TTL_MS) {
    return latestSnapshotCache.snapshot;
  }
  if (latestSnapshotInFlight) return latestSnapshotInFlight;
  latestSnapshotInFlight = loadLhbSnapshot(options);
  try {
    const snapshot = await latestSnapshotInFlight;
    if (snapshot.status !== "unavailable" && snapshot.stocks.length > 0) {
      latestSnapshotCache = { snapshot, timestamp: Date.now() };
    }
    return snapshot;
  } finally {
    latestSnapshotInFlight = null;
  }
}
