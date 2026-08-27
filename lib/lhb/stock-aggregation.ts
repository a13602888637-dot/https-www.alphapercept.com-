import type { LhbStock } from "./contracts";

function hasSingleDayReason(stock: LhbStock): boolean {
  return stock.reasons.some((reason) => !/连续.{0,12}(?:三个|3个?)交易日|(?:三个|3个?)交易日.{0,12}累计/.test(reason));
}

function preferredStock(left: LhbStock, right: LhbStock): LhbStock {
  const leftSingleDay = hasSingleDayReason(left);
  const rightSingleDay = hasSingleDayReason(right);
  if (leftSingleDay !== rightSingleDay) return rightSingleDay ? right : left;
  const leftTurnover = left.buyAmount + left.sellAmount;
  const rightTurnover = right.buyAmount + right.sellAmount;
  return rightTurnover > leftTurnover ? right : left;
}

export function aggregateLhbStocksByCode(stocks: LhbStock[]): LhbStock[] {
  const byCode = new Map<string, LhbStock>();
  for (const stock of stocks) {
    const existing = byCode.get(stock.code);
    if (!existing) {
      byCode.set(stock.code, { ...stock, reasons: [...new Set(stock.reasons)] });
      continue;
    }
    const preferred = preferredStock(existing, stock);
    byCode.set(stock.code, {
      ...preferred,
      reasons: [...new Set([...existing.reasons, ...stock.reasons])],
    });
  }
  return [...byCode.values()].sort((left, right) =>
    right.netAmount - left.netAmount || right.buyAmount - left.buyAmount
  );
}
