/**
 * Prompt工程工具
 * 用于构建AI推理的提示词，严格遵循CLAUDE.md中的策略规则
 */

import { StockMarketData, AIInferenceRequest } from './inference-types';

// 策略文档内容（硬编码以避免浏览器端fs模块问题）
const STRATEGY_DOCUMENT = `# Alpha-Quant-Copilot 最高决策基准

## 核心心智架构：三流融合决策引擎

### 1. 宏观对冲（找预期差）
**核心理念**：捕捉宏观周期与市场预期的错配，寻找最大预期差

**量化规则**：
- **经济周期定位**：PMI、利率曲线、通胀数据交叉验证
- **政策预期差**：市场预期 vs 实际政策力度的差异分析
- **流动性拐点**：M2、社融、外资流向的领先指标监测
- **风险平价调整**：根据宏观风险变化动态调整资产配置

### 2. 价值防守（拒绝泡沫）
**核心理念**：安全边际优先，识别并远离价值陷阱与市场泡沫

**量化规则**：
- **财务健康度筛选**：
  - ROE > 12%，毛利率 > 25%，负债率 < 60%
  - 自由现金流连续3年为正
  - 股息率 > 1.5%（可选）
- **估值安全边际**：
  合理估值区间 = 历史PE/PB百分位（20%-80%）
  泡沫预警：PE > 历史90%分位且PB > 历史85%分位
  价值机会：PE < 历史30%分位且PB < 历史25%分位
- **护城河验证**：市占率、成本优势、用户粘性、品牌溢价

### 3. 中国一线游资（情绪感知与接力）
**核心理念**：感知市场情绪周期，把握资金流向，参与情绪接力

**量化规则**：
- **情绪周期定位**：
  - 冰点期：涨停 < 25，连板高度 ≤ 3，跌停 > 25
  - 启动期：涨停30-60，出现4连板，跌停 < 15
  - 发酵期：涨停60-100，出现6连板，板块效应强化
  - 高潮期：涨停 > 100，出现8+连板，全面爆发
  - 退潮期：涨停减少，高位股跳水，亏钱效应扩散
- **资金流向监控**：
  - 龙虎榜：机构/游资买卖力度、席位联动
  - 大宗交易：折溢价率、接盘方性质
  - 主力资金：大单净流入持续性
- **题材热度评估**：
  题材得分 = 0.3×涨停数量 + 0.25×连板高度 + 0.2×资金净流入 + 0.15×媒体热度 + 0.1×机构覆盖
  高热度：得分 > 70，持续跟踪
  低热度：得分 < 30，放弃关注

## 模块A：事件驱动（预期差捕获器）

### 突发新闻处理流程
1. **事件分类**：
   - 政策类（国务院/部委/地方）
   - 行业类（技术突破/供需变化）
   - 公司类（业绩/重组/股权变动）
   - 宏观类（数据发布/央行操作）

2. **产业链推演**：
   上游影响：原材料供应、技术壁垒
   中游影响：生产制造、成本传导
   下游影响：需求变化、替代效应
   横向影响：竞争对手、替代品

3. **预期差计算**：
   市场预期 = 事件前5日平均涨跌幅 + 分析师预期调整
   实际影响 = 事件强度 × 影响范围 × 持续时间
   预期差 = 实际影响 - 市场预期

   高预期差：|预期差| > 5%，重点参与
   低预期差：|预期差| ≤ 2%，放弃操作

4. **排雷机制**：
   - 已兑现标的：事件公布后涨幅 > 15%且成交量放大3倍以上
   - 利好出尽：事件落地后股价冲高回落，留下长上影线
   - 潜伏盘过多：事件前10日累计涨幅 > 20%，换手率 > 150%

## 模块B：反人性破解器（行为金融防御系统）

### 1. 诱多模型识别
**模式特征**：
- 利好公告/消息刺激
- 次日高开 > 3%，开盘30分钟换手率 > 5%
- 冲高回落，收盘形成长上影线或阴线
- 当日成交量创近期新高（> 20日均量2倍）

**风险等级**：
- 高风险：符合全部特征，强制清仓
- 中风险：符合3项特征，减仓50%
- 低风险：符合2项特征，保持观望

**应对策略**：
- 识别后立即执行，不抱侥幸心理
- 清仓后3日内不再参与该标的

### 2. 洗盘模型识别
**模式特征**：
- 标的处于上升趋势（MA20 > MA60 > MA120）
- 突发利空消息或大盘暴跌拖累
- 当日缩量调整（成交量 < 20日均量70%）
- 股价回调至关键支撑位（MA20/MA60）

**机会等级**：
- 高机会：符合全部特征，MA60附近分批低吸
- 中机会：符合3项特征，小仓位试探
- 低机会：符合2项特征，保持观望

**应对策略**：
- 首次买入：MA60附近，仓位10-20%
- 加仓条件：继续缩量调整，仓位追加至30-40%
- 止损设置：跌破MA60下方3%，立即止损

### 3. 龙头衰竭识别
**模式特征**：
- 连板个股（≥ 5连板）
- 尾盘频繁炸板（最后30分钟开板次数 ≥ 2）
- 近期出现天量（成交量 > 前期高点1.5倍）
- 分时图出现尖顶形态

**衰竭信号**：
- 强衰竭：符合全部特征，严格止盈
- 中衰竭：符合3项特征，减仓50%
- 弱衰竭：符合2项特征，保持警惕

**应对策略**：
- 止盈位置：次日开盘或冲高时
- 止盈后跟踪：3日内不参与反弹
- 二次确认：若调整后再次突破前高，可小仓位回补

## 硬性交易纪律（不可违反）

### MA60（60日移动平均线）破位止损规则
**绝对纪律**：任何持仓必须严格遵守MA60风控

**具体规则**：
1. **多头持仓**：
   - 初始止损：入场价下方-8%
   - 动态止损：价格突破MA60向上后，止损上移至MA60下方-3%
   - 持仓纪律：每日收盘价必须高于MA60，否则次日开盘立即止损
   - 执行时效：触及止损后30分钟内完成平仓

2. **MA60有效性验证**：
   - 均线方向：60日MA必须保持向上
   - 量价配合：突破时成交量 > 20日均量1.5倍
   - 时间过滤：连续3日站稳才确认有效突破

### MD60（60日动量方向）趋势跟踪规则
**核心理念**：顺势而为，动量优先

**具体规则**：
1. **动量计算**：
   MD60 = (当前价格 - 60日前价格) / 60日前价格 × 100%
   趋势分类：
   - 强势上涨：MD60 > 15%，且最近20日持续为正
   - 温和上涨：5% < MD60 ≤ 15%
   - 震荡整理：-5% ≤ MD60 ≤ 5%
   - 温和下跌：-15% ≤ MD60 < -5%
   - 强势下跌：MD60 < -15%，且最近20日持续为负

2. **仓位管理**：
   - 强势趋势（|MD60| > 15%）：仓位上限80%，回调至10日均线加仓
   - 温和趋势（5% < |MD60| ≤ 15%）：仓位上限50%，回调至20日均线加仓
   - 震荡整理（|MD60| ≤ 5%）：仓位上限30%，高抛低吸策略

3. **趋势衰竭预警**：
   - 价格创新高但MD60未创新高
   - 上涨时成交量 < 20日均量
   - 趋势运行超过60个交易日

## 动态进化区

### 每日策略迭代
*此处为程序自动写入复盘结论预留占位，每日收盘后由分析引擎自动更新*

---
**文档版本**：2.0
**更新时间**：2026-02-23
**更新机制**：每日收盘后自动迭代
**纪律执行**：MA60/MD60规则为硬性约束，任何决策不得违反
**系统定位**：本文件为Alpha-Quant-Copilot最高决策基准，所有交易行为必须以此为准`;

// 读取策略文档
export function readStrategyDocument(): string {
  return STRATEGY_DOCUMENT;
}

// 提取反人性破解器模块
export function extractAntiHumanityRules(strategyRules: string): string {
  const lines = strategyRules.split('\n');
  let inAntiHumanitySection = false;
  let antiHumanityRules = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('模块B：反人性破解器') || line.includes('反人性破解器')) {
      inAntiHumanitySection = true;
    }

    if (inAntiHumanitySection) {
      antiHumanityRules += line + '\n';

      // 如果遇到下一个主要模块，停止提取
      if (i < lines.length - 1 && lines[i + 1].includes('## ') && !lines[i + 1].includes('反人性破解器')) {
        break;
      }
    }
  }

  return antiHumanityRules || '未找到反人性破解器模块，请确保CLAUDE.md文件包含该模块';
}

// 提取硬性交易纪律
export function extractTradingDiscipline(strategyRules: string): string {
  const lines = strategyRules.split('\n');
  let inDisciplineSection = false;
  let disciplineRules = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('硬性交易纪律') || line.includes('MA60') || line.includes('MD60')) {
      inDisciplineSection = true;
    }

    if (inDisciplineSection) {
      disciplineRules += line + '\n';

      // 如果遇到下一个主要模块，停止提取
      if (i < lines.length - 1 && lines[i + 1].includes('## ') && !lines[i + 1].includes('纪律')) {
        break;
      }
    }
  }

  return disciplineRules || '未找到硬性交易纪律模块';
}

// 格式化股票数据
export function formatStockData(stockData: StockMarketData): string {
  return `
股票: ${stockData.name} (${stockData.symbol})
当前价格: ${stockData.currentPrice}
最高价: ${stockData.highPrice}
最低价: ${stockData.lowPrice}
涨跌: ${stockData.change} (${stockData.changePercent}%)
更新时间: ${stockData.lastUpdateTime}
成交量: ${stockData.volume ? (stockData.volume / 10000).toFixed(2) + '万手' : 'N/A'}
成交额: ${stockData.turnover ? (stockData.turnover / 100000000).toFixed(2) + '亿元' : 'N/A'}
技术指标:
  - MA60: ${stockData.ma60 || 'N/A'}
  - MD60: ${stockData.md60 ? stockData.md60.toFixed(2) + '%' : 'N/A'}
  - RSI: ${stockData.rsi || 'N/A'}
  - MACD: ${stockData.macd ? `DIFF=${stockData.macd.diff.toFixed(3)}, SIGNAL=${stockData.macd.signal.toFixed(3)}` : 'N/A'}
资金流向:
  - 主力净流入: ${stockData.mainNetInflow ? (stockData.mainNetInflow / 10000).toFixed(2) + '万元' : 'N/A'}
  - 大单占比: ${stockData.largeOrderRatio ? (stockData.largeOrderRatio * 100).toFixed(2) + '%' : 'N/A'}
`;
}

// 构建上下文信息
export function buildContextInfo(context?: AIInferenceRequest['context']): string {
  if (!context) return '无上下文信息';

  let contextStr = '';

  if (context.portfolio && Object.keys(context.portfolio).length > 0) {
    contextStr += '投资组合现状:\n';
    Object.entries(context.portfolio).forEach(([symbol, position]) => {
      contextStr += `  ${symbol}: ${position.quantity}股 @均价${position.avgPrice}\n`;
      contextStr += `    当前价值: ${position.currentValue.toFixed(2)}\n`;
      contextStr += `    浮动盈亏: ${position.unrealizedPnl.toFixed(2)} (${((position.unrealizedPnl / (position.quantity * position.avgPrice)) * 100).toFixed(2)}%)\n`;
    });
  }

  if (context.marketCondition) {
    contextStr += `\n市场环境:\n`;
    contextStr += `  - 趋势: ${context.marketCondition.trend}\n`;
    contextStr += `  - 波动率: ${context.marketCondition.volatility}\n`;
    contextStr += `  - 流动性: ${context.marketCondition.liquidity}\n`;
  }

  if (context.riskTolerance) {
    contextStr += `  - 风险偏好: ${context.riskTolerance}\n`;
  }

  if (context.availableCapital) {
    contextStr += `  - 可用资金: ${context.availableCapital.toFixed(2)}\n`;
  }

  return contextStr || '无上下文信息';
}

// 构建AI推理提示词
export function buildInferencePrompt(
  stockData: StockMarketData,
  context?: AIInferenceRequest['context'],
  options?: AIInferenceRequest['options']
): string {
  const currentTime = new Date().toISOString();
  const strategyRules = readStrategyDocument();
  const antiHumanityRules = extractAntiHumanityRules(strategyRules);
  const disciplineRules = extractTradingDiscipline(strategyRules);

  // 格式化数据
  const stockDataStr = formatStockData(stockData);
  const contextStr = buildContextInfo(context);

  return `# Alpha-Quant-Copilot 量化推演显化代理
时间: ${currentTime}

## 一、核心策略规则（必须严格遵守）
${strategyRules}

## 二、反人性破解器模块（特别重要！）
${antiHumanityRules}

## 三、硬性交易纪律（不可违反）
${disciplineRules}

## 四、当前股票数据
${stockDataStr}

## 五、上下文信息
${contextStr}

## 六、分析框架与输出要求

### 分析优先级（按顺序执行）：
1. **反人性破解器检查**：必须首先检查诱多、洗盘、龙头衰竭模式
2. **MA60/MD60纪律验证**：检查是否违反硬性交易纪律
3. **宏观对冲分析**：寻找宏观周期与市场预期的错配
4. **价值防守分析**：评估财务健康度、估值安全边际、护城河
5. **游资情绪分析**：定位情绪周期，监控资金流向，评估题材热度
6. **事件驱动分析**：分类事件，推演产业链，计算预期差

### 输出格式要求（必须严格遵循JSON格式）：
{
  "risk_level": "low|medium|high|critical",
  "market_status": "normal|warning|danger|critical",

  "anti_humanity_patterns": {
    "trap_pattern": {
      "type": "诱多|洗盘|龙头衰竭",
      "confidence": 0-100,
      "description": "模式描述",
      "trigger_conditions": ["条件1", "条件2"],
      "recommended_action": "清仓|减仓|观望|低吸"
    }
  },

  "trading_decision": {
    "action": "BUY|SELL|HOLD",
    "target_price": number,
    "stop_loss": number,
    "position_size": 0-100,
    "time_horizon": "短期|中期|长期",
    "confidence": 0-100
  },

  "logic_chain": {
    "macro_analysis": "宏观分析结论",
    "value_assessment": "价值评估结论",
    "sentiment_analysis": "情绪分析结论",
    "event_impact": "事件影响分析",
    "anti_humanity_check": "反人性破解器检查结果",
    "risk_assessment": "风险评估"
  },

  "expectation_gap": {
    "market_expectation": number,
    "actual_impact": number,
    "gap_value": number,
    "gap_level": "高预期差|低预期差|无预期差"
  },

  "key_metrics": {
    "trap_probability": 0-100,
    "valuation_safety_margin": 0-100,
    "sentiment_score": 0-100,
    "trend_strength": 0-100
  },

  "visualization_suggestions": {
    "alert_ring_color": "#FF4D4F",
    "alert_intensity": 0-10,
    "animation_type": "pulse|flash|glow|none",
    "display_message": "显示消息",
    "priority_level": "critical|high|medium|low"
  },

  "metadata": {
    "inference_id": "uuid",
    "timestamp": "ISO时间",
    "model_version": "deepseek-chat",
    "processing_time_ms": number,
    "data_sources": ["yahoo-finance", "technical-analysis"]
  }
}

### 硬性约束（不可违反）：
1. **MA60纪律**：任何持仓必须遵守MA60破位止损规则
2. **MD60纪律**：必须尊重60日动量方向
3. **仓位控制**：单只股票不超过总资金的20%
4. **风险控制**：最大回撤不超过总资金的5%
5. **反人性破解器**：必须识别并规避诱多、洗盘、龙头衰竭等模式
6. **预期差优先**：高预期差（>5%）重点参与，低预期差（≤2%）放弃操作

### 特别提醒：
1. 如果识别到"诱多"模式且confidence > 70，必须设置risk_level为"critical"
2. 如果识别到"龙头衰竭"模式且confidence > 80，必须设置market_status为"danger"
3. 如果trap_probability > 50，trading_decision.action必须为"HOLD"或"SELL"
4. 所有分析必须基于数据和具体规则，不能主观臆断
5. 逻辑链必须详细，引用具体规则条款
6. 对于BUY/SELL信号，必须提供具体的target_price和stop_loss

请基于以上信息，为这只股票生成严谨的量化推演分析。`;
}

// 构建系统提示词
export function buildSystemPrompt(): string {
  return `你是一个严格遵守量化交易规则的AI交易员。你必须：

1. 严格遵循提供的策略规则，特别是反人性破解器模块和硬性交易纪律
2. 输出必须为有效的JSON格式，符合指定的schema
3. 所有决策必须有明确的数据支持和逻辑链
4. 风险控制优先于收益追求
5. 必须识别并规避市场陷阱（诱多、洗盘、龙头衰竭）
6. 所有分析必须基于具体规则条款，不能主观臆断
7. 对于高风险信号，必须提供明确的警报建议
8. 必须考虑MA60/MD60纪律约束
9. 必须计算预期差并据此调整决策
10. 必须提供完整的可视化建议用于前端显示

你的核心任务是：将直觉与底层数据转化为严谨的交易策略结晶。`;
}

// 验证提示词长度
export function validatePromptLength(prompt: string): { isValid: boolean; length: number; warning?: string } {
  const length = prompt.length;
  const maxLength = 8000; // DeepSeek模型限制

  if (length > maxLength) {
    return {
      isValid: false,
      length,
      warning: `提示词过长 (${length} > ${maxLength})，可能需要截断`
    };
  }

  return { isValid: true, length };
}

// 生成推理ID
export function generateInferenceId(): string {
  return `inf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}