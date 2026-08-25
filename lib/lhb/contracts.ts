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
  stocks: Array<{ code: string; name: string; buyAmount: number; sellAmount: number; netAmount: number }>;
}

export interface LhbSnapshot {
  schemaVersion: "1.0";
  tradeDate: string;
  generatedAt: string;
  source: "eastmoney";
  stockCount: number;
  seatCount: number;
  stocks: LhbStock[];
  seatFlows: LhbSeatFlow[];
  disclaimer: string;
}
