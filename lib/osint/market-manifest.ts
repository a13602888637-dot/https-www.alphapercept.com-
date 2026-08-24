import type { MarketManifestEntry } from "./contracts";

const entries: MarketManifestEntry[] = [
  { symbol: "^DJI", name: "道琼斯", category: "index", instrumentType: "index", region: "us", provider: "yahoo", providerSymbol: "^DJI" },
  { symbol: "^IXIC", name: "纳斯达克", category: "index", instrumentType: "index", region: "us", provider: "yahoo", providerSymbol: "^IXIC" },
  { symbol: "^GSPC", name: "标普500", category: "index", instrumentType: "index", region: "us", provider: "yahoo", providerSymbol: "^GSPC" },
  { symbol: "^HSI", name: "恒生指数", category: "index", instrumentType: "index", region: "hk", provider: "yahoo", providerSymbol: "^HSI" },
  { symbol: "^N225", name: "日经225", category: "index", instrumentType: "index", region: "jp", provider: "yahoo", providerSymbol: "^N225" },
  { symbol: "^KS11", name: "韩国综合", category: "index", instrumentType: "index", region: "kr", provider: "yahoo", providerSymbol: "^KS11" },
  { symbol: "^FTSE", name: "富时100", category: "index", instrumentType: "index", region: "uk", provider: "yahoo", providerSymbol: "^FTSE" },
  { symbol: "^DAX", name: "德国DAX", category: "index", instrumentType: "index", region: "eu", provider: "yahoo", providerSymbol: "^GDAXI" },
  { symbol: "GEISAC.FGI", name: "富时全球", category: "index", instrumentType: "index", region: "global", provider: "yahoo", providerSymbol: "GEISAC.FGI" },

  { symbol: "000001", name: "上证指数", category: "index", instrumentType: "index", region: "cn", provider: "eastmoney", providerSymbol: "1.000001" },
  { symbol: "399001", name: "深证成指", category: "index", instrumentType: "index", region: "cn", provider: "eastmoney", providerSymbol: "0.399001" },
  { symbol: "399006", name: "创业板指", category: "index", instrumentType: "index", region: "cn", provider: "eastmoney", providerSymbol: "0.399006" },
  { symbol: "000300", name: "沪深300", category: "index", instrumentType: "index", region: "cn", provider: "eastmoney", providerSymbol: "1.000300" },
  { symbol: "000905", name: "中证500", category: "index", instrumentType: "index", region: "cn", provider: "eastmoney", providerSymbol: "1.000905" },

  { symbol: "NQ=F", name: "纳斯达克100期指连续", category: "future", instrumentType: "future", region: "us", provider: "yahoo", providerSymbol: "NQ=F" },
  { symbol: "ES=F", name: "标普500期指连续", category: "future", instrumentType: "future", region: "us", provider: "yahoo", providerSymbol: "ES=F" },
  { symbol: "YM=F", name: "道指期指连续", category: "future", instrumentType: "future", region: "us", provider: "yahoo", providerSymbol: "YM=F" },
  { symbol: "NKD=F", name: "日经期指连续", category: "future", instrumentType: "future", region: "jp", provider: "yahoo", providerSymbol: "NKD=F" },
  { symbol: "CN00Y", name: "富时A50期指连续", category: "future", instrumentType: "future", region: "cn", provider: "eastmoney", providerSymbol: "104.CN00Y" },

  { symbol: "CL=F", name: "WTI原油", category: "commodity", instrumentType: "commodity", region: "global", provider: "yahoo", providerSymbol: "CL=F" },
  { symbol: "BZ=F", name: "Brent原油", category: "commodity", instrumentType: "commodity", region: "global", provider: "yahoo", providerSymbol: "BZ=F" },
  { symbol: "GC=F", name: "黄金", category: "commodity", instrumentType: "commodity", region: "global", provider: "yahoo", providerSymbol: "GC=F" },
  { symbol: "SI=F", name: "白银", category: "commodity", instrumentType: "commodity", region: "global", provider: "yahoo", providerSymbol: "SI=F" },
  { symbol: "HG=F", name: "铜", category: "commodity", instrumentType: "commodity", region: "global", provider: "yahoo", providerSymbol: "HG=F" },
  { symbol: "NG=F", name: "天然气", category: "commodity", instrumentType: "commodity", region: "global", provider: "yahoo", providerSymbol: "NG=F" },

  { symbol: "DXY", name: "美元指数", category: "fx", instrumentType: "fx", region: "global", provider: "yahoo", providerSymbol: "DX-Y.NYB" },
  { symbol: "USDCNH=X", name: "美元/离岸人民币", category: "fx", instrumentType: "fx", region: "global", provider: "yahoo", providerSymbol: "CNH=X" },
  { symbol: "USDJPY=X", name: "美元/日元", category: "fx", instrumentType: "fx", region: "global", provider: "yahoo", providerSymbol: "JPY=X" },

  { symbol: "^VIX", name: "VIX恐慌指数", category: "rate", instrumentType: "index", region: "us", provider: "yahoo", providerSymbol: "^VIX" },
  { symbol: "UST1Y", name: "美国1年期国债收益率", category: "rate", instrumentType: "yield", region: "us", provider: "us-treasury", providerSymbol: "BC_1YEAR" },
  { symbol: "UST10Y", name: "美国10年期国债收益率", category: "rate", instrumentType: "yield", region: "us", provider: "us-treasury", providerSymbol: "BC_10YEAR" },
  { symbol: "UST20Y", name: "美国20年期国债收益率", category: "rate", instrumentType: "yield", region: "us", provider: "us-treasury", providerSymbol: "BC_20YEAR" },
  { symbol: "UST30Y", name: "美国30年期国债收益率", category: "rate", instrumentType: "yield", region: "us", provider: "us-treasury", providerSymbol: "BC_30YEAR" },
];

export const MARKET_MANIFEST: Record<string, MarketManifestEntry> =
  Object.fromEntries(entries.map((entry) => [entry.symbol, entry]));
