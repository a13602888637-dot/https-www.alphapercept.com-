export type LhbSeatCategory = "institution" | "northbound" | "known-seat" | "broker";
export type LhbAliasConfidence = "A" | "B" | "C" | null;

export interface LhbSeat {
  departmentCode: string;
  departmentName: string;
  label: string;
  category: LhbSeatCategory;
  aliasConfidence: LhbAliasConfidence;
  buyAmount: number;
  sellAmount: number;
  netAmount: number;
}

export interface LhbStock {
  tradeId: string;
  code: string;
  name: string;
  changePercent: number | null;
  buyAmount: number;
  sellAmount: number;
  netAmount: number;
  reasons: string[];
  buySeats: LhbSeat[];
  sellSeats: LhbSeat[];
}

export interface LhbSeatFlow extends LhbSeat {
  flowId: string;
  tradeId: string;
  reason: string;
  stocks: Array<{ tradeId: string; code: string; name: string; reason: string; buyAmount: number; sellAmount: number; netAmount: number }>;
}

export interface LhbHotMoneyStock {
  code: string;
  name: string;
  reasons: string[];
  buyAmount: number;
  sellAmount: number;
  netAmount: number;
}

export interface LhbHotMoneyFlow {
  flowId: string;
  kind: "known" | "active";
  label: string;
  confidence: LhbAliasConfidence;
  departmentNames: string[];
  totalBuyAmount: number;
  totalSellAmount: number;
  totalNetAmount: number;
  stockCount: number;
  stocks: LhbHotMoneyStock[];
}

export interface LhbSnapshot {
  schemaVersion: "1.0";
  status: "live" | "degraded" | "unavailable";
  tradeDate: string;
  generatedAt: string;
  asOf: string | null;
  source: "eastmoney";
  sourceHealth: { summary: boolean; buySeats: boolean; sellSeats: boolean };
  errors: string[];
  invalidRowCount: number;
  stockCount: number;
  seatCount: number;
  stocks: LhbStock[];
  seatFlows: LhbSeatFlow[];
  hotMoneyFlows: LhbHotMoneyFlow[];
  disclaimer: string;
}

export type LhbStockRank = Omit<LhbStock, "buySeats" | "sellSeats">;

export type LhbDashboardSnapshot = Omit<LhbSnapshot, "stocks" | "seatFlows"> & {
  stocks: LhbStockRank[];
};
