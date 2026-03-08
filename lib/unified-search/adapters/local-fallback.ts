/**
 * 本地降级数据适配器
 * 当所有外部数据源失败时使用
 */

import { UnifiedAsset } from '../types';

// 沪深300+核心股票（完整列表）
const CN_FALLBACK_STOCKS: UnifiedAsset[] = [
  // 深圳交易所
  { symbol: "000001", code: "000001", name: "平安银行", market: "SZ", type: "STOCK" },
  { symbol: "000002", code: "000002", name: "万科A", market: "SZ", type: "STOCK" },
  { symbol: "000063", code: "000063", name: "中兴通讯", market: "SZ", type: "STOCK" },
  { symbol: "000100", code: "000100", name: "TCL科技", market: "SZ", type: "STOCK" },
  { symbol: "000166", code: "000166", name: "申万宏源", market: "SZ", type: "STOCK" },
  { symbol: "000333", code: "000333", name: "美的集团", market: "SZ", type: "STOCK" },
  { symbol: "000338", code: "000338", name: "潍柴动力", market: "SZ", type: "STOCK" },
  { symbol: "000425", code: "000425", name: "徐工机械", market: "SZ", type: "STOCK" },
  { symbol: "000538", code: "000538", name: "云南白药", market: "SZ", type: "STOCK" },
  { symbol: "000568", code: "000568", name: "泸州老窖", market: "SZ", type: "STOCK" },
  { symbol: "000591", code: "000591", name: "太阳能", market: "SZ", type: "STOCK" },
  { symbol: "000625", code: "000625", name: "长安汽车", market: "SZ", type: "STOCK" },
  { symbol: "000651", code: "000651", name: "格力电器", market: "SZ", type: "STOCK" },
  { symbol: "000661", code: "000661", name: "长春高新", market: "SZ", type: "STOCK" },
  { symbol: "000725", code: "000725", name: "京东方A", market: "SZ", type: "STOCK" },
  { symbol: "000776", code: "000776", name: "广发证券", market: "SZ", type: "STOCK" },
  { symbol: "000800", code: "000800", name: "一汽解放", market: "SZ", type: "STOCK" },
  { symbol: "000858", code: "000858", name: "五粮液", market: "SZ", type: "STOCK" },
  { symbol: "000876", code: "000876", name: "新希望", market: "SZ", type: "STOCK" },
  { symbol: "000895", code: "000895", name: "双汇发展", market: "SZ", type: "STOCK" },
  { symbol: "000938", code: "000938", name: "紫光股份", market: "SZ", type: "STOCK" },
  { symbol: "000963", code: "000963", name: "华东医药", market: "SZ", type: "STOCK" },
  { symbol: "000977", code: "000977", name: "浪潮信息", market: "SZ", type: "STOCK" },
  { symbol: "002001", code: "002001", name: "新和成", market: "SZ", type: "STOCK" },
  { symbol: "002007", code: "002007", name: "华兰生物", market: "SZ", type: "STOCK" },
  { symbol: "002024", code: "002024", name: "苏宁易购", market: "SZ", type: "STOCK" },
  { symbol: "002027", code: "002027", name: "分众传媒", market: "SZ", type: "STOCK" },
  { symbol: "002049", code: "002049", name: "紫光国微", market: "SZ", type: "STOCK" },
  { symbol: "002120", code: "002120", name: "韵达股份", market: "SZ", type: "STOCK" },
  { symbol: "002129", code: "002129", name: "TCL中环", market: "SZ", type: "STOCK" },
  { symbol: "002142", code: "002142", name: "宁波银行", market: "SZ", type: "STOCK" },
  { symbol: "002153", code: "002153", name: "石基信息", market: "SZ", type: "STOCK" },
  { symbol: "002179", code: "002179", name: "中航光电", market: "SZ", type: "STOCK" },
  { symbol: "002230", code: "002230", name: "科大讯飞", market: "SZ", type: "STOCK" },
  { symbol: "002236", code: "002236", name: "大华股份", market: "SZ", type: "STOCK" },
  { symbol: "002241", code: "002241", name: "歌尔股份", market: "SZ", type: "STOCK" },
  { symbol: "002271", code: "002271", name: "东方雨虹", market: "SZ", type: "STOCK" },
  { symbol: "002304", code: "002304", name: "洋河股份", market: "SZ", type: "STOCK" },
  { symbol: "002352", code: "002352", name: "顺丰控股", market: "SZ", type: "STOCK" },
  { symbol: "002371", code: "002371", name: "北方华创", market: "SZ", type: "STOCK" },
  { symbol: "002415", code: "002415", name: "海康威视", market: "SZ", type: "STOCK" },
  { symbol: "002460", code: "002460", name: "赣锋锂业", market: "SZ", type: "STOCK" },
  { symbol: "002475", code: "002475", name: "立讯精密", market: "SZ", type: "STOCK" },
  { symbol: "002493", code: "002493", name: "荣盛石化", market: "SZ", type: "STOCK" },
  { symbol: "002555", code: "002555", name: "三七互娱", market: "SZ", type: "STOCK" },
  { symbol: "002594", code: "002594", name: "比亚迪", market: "SZ", type: "STOCK" },
  { symbol: "002601", code: "002601", name: "龙蟒佰利", market: "SZ", type: "STOCK" },
  { symbol: "002602", code: "002602", name: "世纪华通", market: "SZ", type: "STOCK" },
  { symbol: "002714", code: "002714", name: "牧原股份", market: "SZ", type: "STOCK" },
  { symbol: "002812", code: "002812", name: "恩捷股份", market: "SZ", type: "STOCK" },
  { symbol: "002916", code: "002916", name: "深南电路", market: "SZ", type: "STOCK" },
  { symbol: "300003", code: "300003", name: "乐普医疗", market: "SZ", type: "STOCK" },
  { symbol: "300014", code: "300014", name: "亿纬锂能", market: "SZ", type: "STOCK" },
  { symbol: "300015", code: "300015", name: "爱尔眼科", market: "SZ", type: "STOCK" },
  { symbol: "300059", code: "300059", name: "东方财富", market: "SZ", type: "STOCK" },
  { symbol: "300122", code: "300122", name: "智飞生物", market: "SZ", type: "STOCK" },
  { symbol: "300124", code: "300124", name: "汇川技术", market: "SZ", type: "STOCK" },
  { symbol: "300142", code: "300142", name: "沃森生物", market: "SZ", type: "STOCK" },
  { symbol: "300347", code: "300347", name: "泰格医药", market: "SZ", type: "STOCK" },
  { symbol: "300408", code: "300408", name: "三环集团", market: "SZ", type: "STOCK" },
  { symbol: "300413", code: "300413", name: "芒果超媒", market: "SZ", type: "STOCK" },
  { symbol: "300433", code: "300433", name: "蓝思科技", market: "SZ", type: "STOCK" },
  { symbol: "300498", code: "300498", name: "温氏股份", market: "SZ", type: "STOCK" },
  { symbol: "300529", code: "300529", name: "健帆生物", market: "SZ", type: "STOCK" },
  { symbol: "300601", code: "300601", name: "康泰生物", market: "SZ", type: "STOCK" },
  { symbol: "300628", code: "300628", name: "领益智造", market: "SZ", type: "STOCK" },
  { symbol: "300750", code: "300750", name: "宁德时代", market: "SZ", type: "STOCK" },
  { symbol: "300760", code: "300760", name: "迈瑞医疗", market: "SZ", type: "STOCK" },
  { symbol: "300999", code: "300999", name: "金龙鱼", market: "SZ", type: "STOCK" },
  // 上海交易所
  { symbol: "600000", code: "600000", name: "浦发银行", market: "SH", type: "STOCK" },
  { symbol: "600009", code: "600009", name: "上海机场", market: "SH", type: "STOCK" },
  { symbol: "600010", code: "600010", name: "包钢股份", market: "SH", type: "STOCK" },
  { symbol: "600011", code: "600011", name: "华能国际", market: "SH", type: "STOCK" },
  { symbol: "600016", code: "600016", name: "民生银行", market: "SH", type: "STOCK" },
  { symbol: "600018", code: "600018", name: "上港集团", market: "SH", type: "STOCK" },
  { symbol: "600019", code: "600019", name: "宝钢股份", market: "SH", type: "STOCK" },
  { symbol: "600023", code: "600023", name: "浙能电力", market: "SH", type: "STOCK" },
  { symbol: "600025", code: "600025", name: "华能水电", market: "SH", type: "STOCK" },
  { symbol: "600026", code: "600026", name: "中远海能", market: "SH", type: "STOCK" },
  { symbol: "600027", code: "600027", name: "华电国际", market: "SH", type: "STOCK" },
  { symbol: "600028", code: "600028", name: "中国石化", market: "SH", type: "STOCK" },
  { symbol: "600029", code: "600029", name: "南方航空", market: "SH", type: "STOCK" },
  { symbol: "600030", code: "600030", name: "中信证券", market: "SH", type: "STOCK" },
  { symbol: "600031", code: "600031", name: "三一重工", market: "SH", type: "STOCK" },
  { symbol: "600036", code: "600036", name: "招商银行", market: "SH", type: "STOCK" },
  { symbol: "600048", code: "600048", name: "保利发展", market: "SH", type: "STOCK" },
  { symbol: "600050", code: "600050", name: "中国联通", market: "SH", type: "STOCK" },
  { symbol: "600056", code: "600056", name: "中国医药", market: "SH", type: "STOCK" },
  { symbol: "600061", code: "600061", name: "国投资本", market: "SH", type: "STOCK" },
  { symbol: "600085", code: "600085", name: "同仁堂", market: "SH", type: "STOCK" },
  { symbol: "600089", code: "600089", name: "特变电工", market: "SH", type: "STOCK" },
  { symbol: "600104", code: "600104", name: "上汽集团", market: "SH", type: "STOCK" },
  { symbol: "600111", code: "600111", name: "北方稀土", market: "SH", type: "STOCK" },
  { symbol: "600115", code: "600115", name: "东方航空", market: "SH", type: "STOCK" },
  { symbol: "600132", code: "600132", name: "重庆啤酒", market: "SH", type: "STOCK" },
  { symbol: "600150", code: "600150", name: "中国船舶", market: "SH", type: "STOCK" },
  { symbol: "600176", code: "600176", name: "中国巨石", market: "SH", type: "STOCK" },
  { symbol: "600183", code: "600183", name: "生益科技", market: "SH", type: "STOCK" },
  { symbol: "600196", code: "600196", name: "复星医药", market: "SH", type: "STOCK" },
  { symbol: "600276", code: "600276", name: "恒瑞医药", market: "SH", type: "STOCK" },
  { symbol: "600309", code: "600309", name: "万华化学", market: "SH", type: "STOCK" },
  { symbol: "600332", code: "600332", name: "白云山", market: "SH", type: "STOCK" },
  { symbol: "600346", code: "600346", name: "恒力石化", market: "SH", type: "STOCK" },
  { symbol: "600352", code: "600352", name: "浙江龙盛", market: "SH", type: "STOCK" },
  { symbol: "600406", code: "600406", name: "国电南瑞", market: "SH", type: "STOCK" },
  { symbol: "600436", code: "600436", name: "片仔癀", market: "SH", type: "STOCK" },
  { symbol: "600438", code: "600438", name: "通威股份", market: "SH", type: "STOCK" },
  { symbol: "600489", code: "600489", name: "中金黄金", market: "SH", type: "STOCK" },
  { symbol: "600519", code: "600519", name: "贵州茅台", market: "SH", type: "STOCK" },
  { symbol: "600547", code: "600547", name: "山东黄金", market: "SH", type: "STOCK" },
  { symbol: "600570", code: "600570", name: "恒生电子", market: "SH", type: "STOCK" },
  { symbol: "600585", code: "600585", name: "海螺水泥", market: "SH", type: "STOCK" },
  { symbol: "600588", code: "600588", name: "用友网络", market: "SH", type: "STOCK" },
  { symbol: "600600", code: "600600", name: "青岛啤酒", market: "SH", type: "STOCK" },
  { symbol: "600690", code: "600690", name: "海尔智家", market: "SH", type: "STOCK" },
  { symbol: "600703", code: "600703", name: "三安光电", market: "SH", type: "STOCK" },
  { symbol: "600745", code: "600745", name: "闻泰科技", market: "SH", type: "STOCK" },
  { symbol: "600795", code: "600795", name: "国电电力", market: "SH", type: "STOCK" },
  { symbol: "600809", code: "600809", name: "山西汾酒", market: "SH", type: "STOCK" },
  { symbol: "600837", code: "600837", name: "海通证券", market: "SH", type: "STOCK" },
  { symbol: "600845", code: "600845", name: "宝信软件", market: "SH", type: "STOCK" },
  { symbol: "600887", code: "600887", name: "伊利股份", market: "SH", type: "STOCK" },
  { symbol: "600893", code: "600893", name: "航发动力", market: "SH", type: "STOCK" },
  { symbol: "600900", code: "600900", name: "长江电力", market: "SH", type: "STOCK" },
  { symbol: "600919", code: "600919", name: "江苏银行", market: "SH", type: "STOCK" },
  { symbol: "600958", code: "600958", name: "东方证券", market: "SH", type: "STOCK" },
  { symbol: "600999", code: "600999", name: "招商证券", market: "SH", type: "STOCK" },
  { symbol: "601006", code: "601006", name: "大秦铁路", market: "SH", type: "STOCK" },
  { symbol: "601012", code: "601012", name: "隆基绿能", market: "SH", type: "STOCK" },
  { symbol: "601066", code: "601066", name: "中信建投", market: "SH", type: "STOCK" },
  { symbol: "601088", code: "601088", name: "中国神华", market: "SH", type: "STOCK" },
  { symbol: "601111", code: "601111", name: "中国国航", market: "SH", type: "STOCK" },
  { symbol: "601138", code: "601138", name: "工业富联", market: "SH", type: "STOCK" },
  { symbol: "601155", code: "601155", name: "新城控股", market: "SH", type: "STOCK" },
  { symbol: "601166", code: "601166", name: "兴业银行", market: "SH", type: "STOCK" },
  { symbol: "601169", code: "601169", name: "北京银行", market: "SH", type: "STOCK" },
  { symbol: "601186", code: "601186", name: "中国铁建", market: "SH", type: "STOCK" },
  { symbol: "601211", code: "601211", name: "国泰君安", market: "SH", type: "STOCK" },
  { symbol: "601225", code: "601225", name: "陕西煤业", market: "SH", type: "STOCK" },
  { symbol: "601229", code: "601229", name: "上海银行", market: "SH", type: "STOCK" },
  { symbol: "601236", code: "601236", name: "红塔证券", market: "SH", type: "STOCK" },
  { symbol: "601288", code: "601288", name: "农业银行", market: "SH", type: "STOCK" },
  { symbol: "601318", code: "601318", name: "中国平安", market: "SH", type: "STOCK" },
  { symbol: "601328", code: "601328", name: "交通银行", market: "SH", type: "STOCK" },
  { symbol: "601336", code: "601336", name: "新华保险", market: "SH", type: "STOCK" },
  { symbol: "601390", code: "601390", name: "中国中铁", market: "SH", type: "STOCK" },
  { symbol: "601398", code: "601398", name: "工商银行", market: "SH", type: "STOCK" },
  { symbol: "601601", code: "601601", name: "中国太保", market: "SH", type: "STOCK" },
  { symbol: "601628", code: "601628", name: "中国人寿", market: "SH", type: "STOCK" },
  { symbol: "601633", code: "601633", name: "长城汽车", market: "SH", type: "STOCK" },
  { symbol: "601668", code: "601668", name: "中国建筑", market: "SH", type: "STOCK" },
  { symbol: "601688", code: "601688", name: "华泰证券", market: "SH", type: "STOCK" },
  { symbol: "601698", code: "601698", name: "中国卫通", market: "SH", type: "STOCK" },
  { symbol: "601766", code: "601766", name: "中国中车", market: "SH", type: "STOCK" },
  { symbol: "601788", code: "601788", name: "光大证券", market: "SH", type: "STOCK" },
  { symbol: "601800", code: "601800", name: "中国交建", market: "SH", type: "STOCK" },
  { symbol: "601818", code: "601818", name: "光大银行", market: "SH", type: "STOCK" },
  { symbol: "601857", code: "601857", name: "中国石油", market: "SH", type: "STOCK" },
  { symbol: "601888", code: "601888", name: "中国中免", market: "SH", type: "STOCK" },
  { symbol: "601899", code: "601899", name: "紫金矿业", market: "SH", type: "STOCK" },
  { symbol: "601919", code: "601919", name: "中远海控", market: "SH", type: "STOCK" },
  { symbol: "601939", code: "601939", name: "建设银行", market: "SH", type: "STOCK" },
  { symbol: "601985", code: "601985", name: "中国核电", market: "SH", type: "STOCK" },
  { symbol: "601988", code: "601988", name: "中国银行", market: "SH", type: "STOCK" },
  { symbol: "601998", code: "601998", name: "中信银行", market: "SH", type: "STOCK" },
  { symbol: "603019", code: "603019", name: "中科曙光", market: "SH", type: "STOCK" },
  { symbol: "603259", code: "603259", name: "药明康德", market: "SH", type: "STOCK" },
  { symbol: "603288", code: "603288", name: "海天味业", market: "SH", type: "STOCK" },
  { symbol: "603501", code: "603501", name: "韦尔股份", market: "SH", type: "STOCK" },
  { symbol: "603799", code: "603799", name: "华友钴业", market: "SH", type: "STOCK" },
  { symbol: "603986", code: "603986", name: "兆易创新", market: "SH", type: "STOCK" },
  { symbol: "688009", code: "688009", name: "中国通号", market: "SH", type: "STOCK" },
  { symbol: "688012", code: "688012", name: "中微公司", market: "SH", type: "STOCK" },
  { symbol: "688036", code: "688036", name: "传音控股", market: "SH", type: "STOCK" },
  { symbol: "688111", code: "688111", name: "金山办公", market: "SH", type: "STOCK" },
  { symbol: "688981", code: "688981", name: "中芯国际", market: "SH", type: "STOCK" },
];

const US_FALLBACK_STOCKS: UnifiedAsset[] = [
  { symbol: "AAPL", name: "Apple Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corporation", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon.com Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corporation", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "META", name: "Meta Platforms Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "V", name: "Visa Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "JNJ", name: "Johnson & Johnson", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "WMT", name: "Walmart Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "PG", name: "Procter & Gamble Co.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "MA", name: "Mastercard Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "HD", name: "Home Depot Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "DIS", name: "Walt Disney Co.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "BAC", name: "Bank of America Corp.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "NFLX", name: "Netflix Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "AMD", name: "Advanced Micro Devices", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "INTC", name: "Intel Corporation", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "CRM", name: "Salesforce Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "ORCL", name: "Oracle Corporation", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "ADBE", name: "Adobe Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "CSCO", name: "Cisco Systems Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "PEP", name: "PepsiCo Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "KO", name: "Coca-Cola Co.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "NIO", name: "NIO Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "BABA", name: "Alibaba Group", market: "US", type: "STOCK", exchange: "NYSE" },
  { symbol: "PDD", name: "PDD Holdings Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "JD", name: "JD.com Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "BIDU", name: "Baidu Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "LI", name: "Li Auto Inc.", market: "US", type: "STOCK", exchange: "NASDAQ" },
  { symbol: "XPEV", name: "XPeng Inc.", market: "US", type: "STOCK", exchange: "NYSE" },
];

export class LocalFallbackAdapter {
  /**
   * 搜索本地 A股数据
   */
  searchCN(query: string, limit: number = 15): UnifiedAsset[] {
    const lowerQuery = query.toLowerCase();

    // 精确匹配代码
    const exactCodeMatch = CN_FALLBACK_STOCKS.filter(
      stock => stock.code === query || stock.symbol === query
    );
    if (exactCodeMatch.length > 0) {
      return exactCodeMatch.slice(0, limit);
    }

    // 模糊匹配代码和名称
    const fuzzyMatch = CN_FALLBACK_STOCKS.filter(
      stock =>
        (stock.code && stock.code.includes(query)) ||
        stock.symbol.includes(query) ||
        stock.name.includes(query)
    );
    return fuzzyMatch.slice(0, limit);
  }

  /**
   * 搜索本地美股数据
   */
  searchUS(query: string, limit: number = 15): UnifiedAsset[] {
    const upperQuery = query.toUpperCase();

    // 精确匹配 Symbol
    const exactMatch = US_FALLBACK_STOCKS.filter(
      stock => stock.symbol === upperQuery
    );
    if (exactMatch.length > 0) {
      return exactMatch.slice(0, limit);
    }

    // 模糊匹配名称
    const lowerQuery = query.toLowerCase();
    const fuzzyMatch = US_FALLBACK_STOCKS.filter(
      stock => stock.name.toLowerCase().includes(lowerQuery) ||
               stock.symbol.toLowerCase().includes(lowerQuery)
    );
    return fuzzyMatch.slice(0, limit);
  }

  /**
   * 健康检查（本地数据总是可用）
   */
  healthCheck(): boolean {
    return true;
  }
}
