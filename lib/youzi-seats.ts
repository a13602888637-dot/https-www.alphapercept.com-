export interface YouziSeatProfile {
  name: string;
  tier: "legend" | "new_gen" | "regional" | "new_2025";
  style: string;
  keywords: string[];
}

// This is a conservative browser-safe mirror of Uzi's seat database. Broad
// broker-level aliases (for example just "华鑫证券") are deliberately excluded
// because they create too many false positives in a public quick scan.
export const YOUZI_SEAT_PROFILES: YouziSeatProfile[] = [
  {
    name: "章盟主",
    tier: "legend",
    style: "大资金趋势波段",
    keywords: ["国泰君安证券股份有限公司上海江苏路证券营业部", "国泰海通证券股份有限公司上海江苏路证券营业部", "国泰君安证券股份有限公司宁波彩虹北路证券营业部", "国泰海通证券股份有限公司宁波彩虹北路证券营业部", "中信证券股份有限公司杭州延安路证券营业部"],
  },
  {
    name: "孙哥",
    tier: "legend",
    style: "板块引导与波段锁仓",
    keywords: ["中信证券股份有限公司上海溧阳路证券营业部", "中信证券股份有限公司上海古北路证券营业部", "中信证券股份有限公司上海分公司"],
  },
  {
    name: "赵老哥",
    tier: "legend",
    style: "打板与龙头接力",
    keywords: ["浙商证券股份有限公司绍兴解放北路证券营业部", "中国银河证券股份有限公司绍兴证券营业部", "中国银河证券股份有限公司北京阜成路证券营业部"],
  },
  {
    name: "佛山无影脚",
    tier: "legend",
    style: "翘板与高换手短线",
    keywords: ["光大证券股份有限公司佛山绿景路证券营业部", "光大证券股份有限公司佛山季华六路证券营业部", "湘财证券股份有限公司佛山祖庙路证券营业部"],
  },
  {
    name: "炒股养家",
    tier: "legend",
    style: "情绪周期与通道排板",
    keywords: ["华鑫证券有限责任公司上海红宝石路证券营业部", "华鑫证券有限责任公司上海宛平南路证券营业部"],
  },
  {
    name: "陈小群",
    tier: "new_gen",
    style: "龙头接力与反核",
    keywords: ["中国银河证券股份有限公司大连黄河路证券营业部"],
  },
  {
    name: "呼家楼",
    tier: "new_gen",
    style: "多席位协同与板块平铺",
    keywords: ["中信证券股份有限公司上海凯滨路证券营业部", "中信证券股份有限公司北京总部", "中信建投证券股份有限公司北京朝外大街证券营业部"],
  },
  {
    name: "方新侠",
    tier: "new_gen",
    style: "大成交趋势票",
    keywords: ["兴业证券股份有限公司陕西分公司", "中信证券股份有限公司西安朱雀大街证券营业部"],
  },
  {
    name: "作手新一",
    tier: "new_gen",
    style: "龙头与趋势接力",
    keywords: ["国泰君安证券股份有限公司南京太平南路证券营业部", "国泰海通证券股份有限公司南京太平南路证券营业部"],
  },
  {
    name: "小鳄鱼",
    tier: "new_gen",
    style: "基本面辅助短线",
    keywords: ["南京证券股份有限公司南京大钟亭证券营业部", "中金财富证券有限公司南京龙蟠中路证券营业部"],
  },
  {
    name: "毛老板",
    tier: "new_gen",
    style: "AI 主线重仓",
    keywords: ["国泰君安证券股份有限公司北京光华路证券营业部", "国泰海通证券股份有限公司北京光华路证券营业部", "方正证券股份有限公司乐山龙游路证券营业部", "广发证券股份有限公司上海东方路证券营业部"],
  },
  {
    name: "消闲派",
    tier: "new_gen",
    style: "龙头加速锁仓",
    keywords: ["华泰证券股份有限公司浙江分公司"],
  },
  {
    name: "拉萨天团",
    tier: "regional",
    style: "高换手一日游",
    keywords: ["东方财富证券股份有限公司拉萨"],
  },
  {
    name: "成都帮",
    tier: "regional",
    style: "底部点火短线",
    keywords: ["华泰证券股份有限公司成都南一环路第二证券营业部"],
  },
  {
    name: "宁波桑田路",
    tier: "regional",
    style: "连板接力",
    keywords: ["国盛证券有限责任公司宁波桑田路证券营业部"],
  },
  {
    name: "六一中路",
    tier: "new_2025",
    style: "题材打板接力",
    keywords: ["招商证券股份有限公司福州六一中路证券营业部"],
  },
  {
    name: "流沙河",
    tier: "new_2025",
    style: "低吸与接力",
    keywords: ["招商证券股份有限公司北京车公庄西路证券营业部", "华泰证券股份有限公司上海武定路证券营业部"],
  },
  {
    name: "古北路",
    tier: "new_2025",
    style: "顶级短线接力",
    keywords: ["中信证券股份有限公司上海古北路证券营业部"],
  },
];

export function matchYouziSeat(seatName: string): YouziSeatProfile[] {
  return YOUZI_SEAT_PROFILES.filter((profile) =>
    profile.keywords.some((keyword) => seatName.includes(keyword))
  );
}

export function isInstitutionalSeat(seatName: string): boolean {
  return seatName.includes("机构专用") || (seatName.includes("机构") && !seatName.includes("证券"));
}
