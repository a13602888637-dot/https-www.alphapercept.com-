/**
 * Prompt工程工具
 * 用于构建AI推理的提示词，严格遵循CLAUDE.md中的策略规则
 */

import { StockMarketData, AIInferenceRequest } from './inference-types';
import * as fs from 'fs';
import * as path from 'path';

// 读取策略文档
export function readStrategyDocument(): string {
  try {
    const strategyPath = path.join(process.cwd(), 'CLAUDE.md');
    const content = fs.readFileSync(strategyPath, 'utf-8');
    console.log('策略文档读取成功，长度:', content.length);
    return content;
  } catch (error) {
    console.error('读取策略文档失败:', error);
    return '# 策略文档读取失败\n请确保CLAUDE.md文件存在';
  }
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