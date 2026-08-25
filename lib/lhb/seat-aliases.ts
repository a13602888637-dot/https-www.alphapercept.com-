import type { LhbAliasConfidence, LhbSeatCategory } from "./contracts";

export interface SeatAlias {
  label: string;
  category: LhbSeatCategory;
  confidence: Exclude<LhbAliasConfidence, null>;
}

// Exact full-name matches only. These are market-observation labels, not proof of
// any person's identity. Broad broker-name matches are deliberately excluded.
export const EXACT_SEAT_ALIASES: Record<string, SeatAlias> = {
  "国泰海通证券股份有限公司武汉紫阳东路证券营业部": { label: "武汉紫阳东路", category: "known-seat", confidence: "A" },
  "国泰君安证券股份有限公司上海江苏路证券营业部": { label: "章盟主观察席", category: "known-seat", confidence: "B" },
  "国泰君安证券股份有限公司宁波彩虹北路证券营业部": { label: "章盟主观察席", category: "known-seat", confidence: "B" },
  "中信证券股份有限公司杭州延安路证券营业部": { label: "章盟主观察席", category: "known-seat", confidence: "B" },
  "浙商证券股份有限公司绍兴解放北路证券营业部": { label: "赵老哥观察席", category: "known-seat", confidence: "B" },
  "中国银河证券股份有限公司绍兴证券营业部": { label: "赵老哥观察席", category: "known-seat", confidence: "B" },
  "光大证券股份有限公司佛山绿景路证券营业部": { label: "佛山系观察席", category: "known-seat", confidence: "B" },
  "光大证券股份有限公司佛山季华六路证券营业部": { label: "佛山系观察席", category: "known-seat", confidence: "B" },
  "华鑫证券有限责任公司上海红宝石路证券营业部": { label: "养家观察席", category: "known-seat", confidence: "B" },
  "华鑫证券有限责任公司上海宛平南路证券营业部": { label: "养家观察席", category: "known-seat", confidence: "B" },
  "中国银河证券股份有限公司大连黄河路证券营业部": { label: "陈小群观察席", category: "known-seat", confidence: "B" },
  "中信建投证券股份有限公司北京朝外大街证券营业部": { label: "呼家楼观察席", category: "known-seat", confidence: "B" },
  "兴业证券股份有限公司陕西分公司": { label: "方新侠观察席", category: "known-seat", confidence: "B" },
  "国泰君安证券股份有限公司南京太平南路证券营业部": { label: "作手新一观察席", category: "known-seat", confidence: "B" },
  "南京证券股份有限公司南京大钟亭证券营业部": { label: "小鳄鱼观察席", category: "known-seat", confidence: "B" },
  "国盛证券有限责任公司宁波桑田路证券营业部": { label: "宁波桑田路", category: "known-seat", confidence: "A" },
  "招商证券股份有限公司福州六一中路证券营业部": { label: "六一中路", category: "known-seat", confidence: "A" },
};
