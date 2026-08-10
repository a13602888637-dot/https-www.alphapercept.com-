export interface RadarPosition {
  userId: string;
  stockCode: string;
  stockName: string;
  avgCost: number;
  currentPrice: number | null;
  changePercent: number | null;
  priceSource: string;
  priceAsOf: string | null;
  stopLossPrice: number | null;
  targetPrice: number | null;
}
export interface RadarTrigger {
  triggerKey: string;
  type: "QUOTE_UNAVAILABLE" | "STOP_LOSS" | "TARGET_REACHED" | "DRAWDOWN" | "VOLATILITY";
  severity: "critical" | "warning" | "info";
  title: string;
  summary: string;
  evidence: Record<string, string | number | null>;
}

function pct(current: number, base: number): number {
  return base > 0 ? ((current - base) / base) * 100 : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function detectRadarTriggers(position: RadarPosition): RadarTrigger[] {
  const commonEvidence = {
    currentPrice: position.currentPrice,
    avgCost: position.avgCost,
    stopLossPrice: position.stopLossPrice,
    targetPrice: position.targetPrice,
    changePercent: position.changePercent,
    priceSource: position.priceSource,
    priceAsOf: position.priceAsOf,
  };

  if (position.currentPrice === null || position.currentPrice <= 0 || position.priceSource === "unavailable") {
    return [{
      triggerKey: `${position.stockCode}:QUOTE_UNAVAILABLE`,
      type: "QUOTE_UNAVAILABLE",
      severity: "warning",
      title: `${position.stockName} 行情不可用`,
      summary: "本轮未取得可信行情，暂停价格类判断；不会用成本价冒充当前价。",
      evidence: commonEvidence,
    }];
  }

  const triggers: RadarTrigger[] = [];
  const pnlPercent = pct(position.currentPrice, position.avgCost);

  if (position.stopLossPrice !== null && position.currentPrice <= position.stopLossPrice) {
    triggers.push({
      triggerKey: `${position.stockCode}:STOP_LOSS`,
      type: "STOP_LOSS",
      severity: "critical",
      title: `${position.stockName} 触及止损线`,
      summary: `现价 ${position.currentPrice.toFixed(2)}，已低于止损 ${position.stopLossPrice.toFixed(2)}。`,
      evidence: { ...commonEvidence, pnlPercent: round2(pnlPercent) },
    });
  } else if (position.stopLossPrice === null && pnlPercent <= -5) {
    triggers.push({
      triggerKey: `${position.stockCode}:DRAWDOWN_5`,
      type: "DRAWDOWN",
      severity: "warning",
      title: `${position.stockName} 回撤超过 5%`,
      summary: `相对成本回撤 ${Math.abs(pnlPercent).toFixed(1)}%，且尚未设置止损线。`,
      evidence: { ...commonEvidence, pnlPercent: round2(pnlPercent) },
    });
  }

  if (position.targetPrice !== null && position.currentPrice >= position.targetPrice) {
    triggers.push({
      triggerKey: `${position.stockCode}:TARGET_REACHED`,
      type: "TARGET_REACHED",
      severity: "info",
      title: `${position.stockName} 到达目标价`,
      summary: `现价 ${position.currentPrice.toFixed(2)}，已达到目标 ${position.targetPrice.toFixed(2)}。`,
      evidence: { ...commonEvidence, pnlPercent: round2(pnlPercent) },
    });
  }

  if (position.changePercent !== null && Math.abs(position.changePercent) >= 5) {
    triggers.push({
      triggerKey: `${position.stockCode}:VOLATILITY_5`,
      type: "VOLATILITY",
      severity: position.changePercent <= -5 ? "warning" : "info",
      title: `${position.stockName} 日内异动`,
      summary: `本轮行情显示日涨跌 ${position.changePercent > 0 ? "+" : ""}${position.changePercent.toFixed(2)}%。`,
      evidence: { ...commonEvidence, pnlPercent: round2(pnlPercent) },
    });
  }

  return triggers;
}
