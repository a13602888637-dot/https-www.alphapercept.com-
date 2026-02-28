/**
 * AI对话预设提问模板
 */

export interface PromptTemplate {
  label: string;
  emoji: string;
  prompt: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: "技术分析",
    emoji: "📊",
    prompt: "请基于当前K线走势和技术指标，分析{stockName}的技术面情况和短期走势预测。"
  },
  {
    label: "买卖建议",
    emoji: "🎯",
    prompt: "结合MA60均线、MACD和RSI指标，给出{stockName}当前的买卖建议和止损位。"
  },
  {
    label: "风险评估",
    emoji: "⚠️",
    prompt: "分析{stockName}当前存在的主要风险点，包括技术风险、市场风险和基本面风险。"
  },
  {
    label: "投资策略",
    emoji: "💡",
    prompt: "基于五大投资流派，为{stockName}制定短期和中期的投资策略。"
  },
];

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(stockCode: string, stockName: string, context?: any): string {
  return `你是一位专业的量化投资分析师，精通技术分析、基本面分析和市场情绪分析。

当前分析的股票：
- 股票代码：${stockCode}
- 股票名称：${stockName}
${context?.currentPrice ? `- 当前价格：¥${context.currentPrice.toFixed(2)}` : ''}
${context?.changePercent !== undefined ? `- 涨跌幅：${context.changePercent.toFixed(2)}%` : ''}
${context?.ma60 ? `- MA60均线：¥${context.ma60.toFixed(2)}` : ''}
${context?.rsi ? `- RSI指标：${context.rsi.toFixed(2)}` : ''}
${context?.macd ? `- MACD：${JSON.stringify(context.macd)}` : ''}

请基于以上信息，提供专业、客观、实用的投资分析建议。回答时请：
1. 使用简洁清晰的语言
2. 提供具体的数据和分析依据
3. 明确指出风险点
4. 给出可操作的建议

注意：所有建议仅供参考，投资需谨慎。`;
}

/**
 * 替换模板中的变量
 */
export function fillPromptTemplate(template: string, stockName: string): string {
  return template.replace(/\{stockName\}/g, stockName);
}
