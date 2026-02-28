export interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * 生成模拟K线数据
 * @param days 生成的天数
 * @param basePrice 基础价格
 * @returns K线数据数组
 */
export function generateMockKLineData(days: number = 60, basePrice: number = 100): KLineData[] {
  const data: KLineData[] = [];
  const today = new Date();
  let currentPrice = basePrice;

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // 跳过周末
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    // 生成随机涨跌
    const change = (Math.random() - 0.48) * (basePrice * 0.05); // 略微偏向上涨
    currentPrice = Math.max(currentPrice + change, basePrice * 0.5); // 价格不低于基础价格的50%

    const open = currentPrice;
    const closeChange = (Math.random() - 0.5) * (basePrice * 0.03);
    const close = Math.max(open + closeChange, basePrice * 0.5);

    // 生成高低价
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);

    // 生成成交量
    const isUp = close >= open;
    const baseVolume = 500000 + Math.random() * 500000;
    const volume = isUp ? baseVolume * (1 + Math.random() * 0.5) : baseVolume;

    data.push({
      time: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(volume),
    });
  }

  return data;
}

/**
 * 根据股票代码生成模拟K线数据（不同股票有不同的基础价格）
 */
export function generateMockKLineByStockCode(stockCode: string, days: number = 60): KLineData[] {
  // 根据股票代码确定基础价格
  const basePriceMap: { [key: string]: number } = {
    '000001': 12.5,  // 平安银行
    '600519': 1680,  // 贵州茅台
    '000333': 58,    // 美的集团
    '300750': 195,   // 宁德时代
    '002415': 35,    // 海康威视
    '601318': 45,    // 中国平安
  };

  const basePrice = basePriceMap[stockCode] || 50 + Math.random() * 100;

  return generateMockKLineData(days, basePrice);
}
