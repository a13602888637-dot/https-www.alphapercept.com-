/**
 * 风险解析器
 * 用于解析AI推理响应，提取风险信息并生成警报配置
 */

import {
  AIInferenceResponse,
  RiskLevel,
  MarketStatus,
  AlertRingConfig,
  DEFAULT_ALERT_CONFIGS,
  RISK_KEYWORDS,
  ANTI_HUMANITY_KEYWORDS
} from './inference-types';

// 解析风险等级
export function parseRiskLevel(response: AIInferenceResponse): RiskLevel {
  // 优先使用AI返回的风险等级
  if (response.risk_level) {
    return response.risk_level;
  }

  // 如果没有明确的风险等级，根据其他指标推断
  const trapProbability = response.key_metrics?.trap_probability || 0;
  const antiHumanityPatterns = response.anti_humanity_patterns;

  // 检查反人性破解器模式
  if (antiHumanityPatterns?.trap_pattern?.confidence > 70) {
    return 'critical';
  }

  if (antiHumanityPatterns?.exhaustion_pattern?.confidence > 80) {
    return 'critical';
  }

  // 根据陷阱概率判断
  if (trapProbability >= 90) return 'critical';
  if (trapProbability >= 80) return 'high';
  if (trapProbability >= 60) return 'medium';
  return 'low';
}

// 解析市场状态
export function parseMarketStatus(response: AIInferenceResponse): MarketStatus {
  // 优先使用AI返回的市场状态
  if (response.market_status) {
    return response.market_status;
  }

  // 根据风险等级推断市场状态
  const riskLevel = parseRiskLevel(response);

  switch (riskLevel) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    default:
      return 'normal';
  }
}

// 检查是否触发高危状态
export function isCriticalState(response: AIInferenceResponse): boolean {
  const riskLevel = parseRiskLevel(response);
  const marketStatus = parseMarketStatus(response);

  // 检查风险等级
  if (riskLevel === 'critical') return true;

  // 检查市场状态
  if (marketStatus === 'critical' || marketStatus === 'danger') return true;

  // 检查反人性破解器模式
  const patterns = response.anti_humanity_patterns;
  if (patterns?.trap_pattern?.confidence > 70) return true;
  if (patterns?.exhaustion_pattern?.confidence > 80) return true;

  // 检查陷阱概率
  if (response.key_metrics?.trap_probability >= 90) return true;

  return false;
}

// 提取高危关键词
export function extractCriticalKeywords(response: AIInferenceResponse): string[] {
  const keywords: string[] = [];

  // 检查逻辑链中的关键词
  const logicChain = response.logic_chain;
  const allText = JSON.stringify(logicChain).toLowerCase();

  // 检查高危关键词
  RISK_KEYWORDS.CRITICAL.forEach(keyword => {
    if (allText.includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  });

  // 检查反人性破解器关键词
  ANTI_HUMANITY_KEYWORDS.TRAP_PATTERN.forEach(keyword => {
    if (allText.includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  });

  ANTI_HUMANITY_KEYWORDS.EXHAUSTION_PATTERN.forEach(keyword => {
    if (allText.includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  });

  return [...new Set(keywords)]; // 去重
}

// 生成警报环配置
export function generateAlertRingConfig(response: AIInferenceResponse): AlertRingConfig {
  const riskLevel = parseRiskLevel(response);
  const isCritical = isCriticalState(response);
  const criticalKeywords = extractCriticalKeywords(response);

  // 使用默认配置作为基础
  const baseConfig = DEFAULT_ALERT_CONFIGS[riskLevel];

  // 如果是高危状态，增强配置
  if (isCritical) {
    return {
      ...baseConfig,
      color: '#FF4D4F', // 强制使用危险红色
      intensity: 10, // 最大强度
      animation: 'pulse', // 脉冲动画
      message: generateCriticalMessage(response, criticalKeywords),
      priority: 'critical'
    };
  }

  // 如果有高危关键词但未达到临界状态
  if (criticalKeywords.length > 0) {
    return {
      ...baseConfig,
      intensity: Math.min(baseConfig.intensity + 2, 10), // 增强强度
      message: generateWarningMessage(response, criticalKeywords),
      priority: 'high'
    };
  }

  return baseConfig;
}

// 生成高危消息
function generateCriticalMessage(response: AIInferenceResponse, keywords: string[]): string {
  const patterns = response.anti_humanity_patterns;
  const trapProbability = response.key_metrics?.trap_probability || 0;

  let message = '⚠️ ';

  // 根据模式类型生成消息
  if (patterns?.trap_pattern?.type === '诱多') {
    message += `【诱多警报】${patterns.trap_pattern.description} `;
    message += `置信度: ${patterns.trap_pattern.confidence}% `;
    message += `建议: ${patterns.trap_pattern.recommended_action}`;
  } else if (patterns?.exhaustion_pattern?.type === '龙头衰竭') {
    message += `【龙头衰竭】${patterns.exhaustion_pattern.description} `;
    message += `置信度: ${patterns.exhaustion_pattern.confidence}% `;
    message += `建议: ${patterns.exhaustion_pattern.recommended_action}`;
  } else if (trapProbability >= 90) {
    message += `【极高风险】陷阱概率 ${trapProbability}% `;
    message += `建议立即清仓或严格止损`;
  } else if (keywords.length > 0) {
    message += `【高危信号】检测到: ${keywords.join('、')} `;
    message += `建议立即行动`;
  } else {
    message += `【危险状态】风险等级: ${parseRiskLevel(response)} `;
    message += `建议谨慎操作`;
  }

  return message;
}

// 生成警告消息
function generateWarningMessage(response: AIInferenceResponse, keywords: string[]): string {
  const trapProbability = response.key_metrics?.trap_probability || 0;

  let message = '⚠️ ';

  if (trapProbability >= 80) {
    message += `【高风险】陷阱概率 ${trapProbability}% `;
    message += `建议减仓或设置严格止损`;
  } else if (keywords.length > 0) {
    message += `【风险提示】检测到: ${keywords.join('、')} `;
    message += `建议保持警惕`;
  } else {
    message += `【中等风险】需关注市场变化 `;
    message += `建议控制仓位`;
  }

  return message;
}

// 提取一句话结论
export function extractOneSentenceConclusion(response: AIInferenceResponse): string {
  const tradingDecision = response.trading_decision;
  const riskLevel = parseRiskLevel(response);
  const trapProbability = response.key_metrics?.trap_probability || 0;

  if (riskLevel === 'critical') {
    return `【危险】${tradingDecision.action}信号，陷阱概率${trapProbability}%，建议立即${tradingDecision.action === 'SELL' ? '卖出' : '谨慎操作'}`;
  }

  if (riskLevel === 'high') {
    return `【高风险】${tradingDecision.action}信号，陷阱概率${trapProbability}%，建议${tradingDecision.action === 'SELL' ? '卖出' : '控制仓位'}`;
  }

  if (riskLevel === 'medium') {
    return `【中等风险】${tradingDecision.action}信号，陷阱概率${trapProbability}%，可${tradingDecision.action === 'BUY' ? '小仓位参与' : '观望'}`;
  }

  return `【低风险】${tradingDecision.action}信号，趋势正常，可${tradingDecision.action === 'BUY' ? '考虑参与' : '持有'}`;
}

// 验证AI响应格式
export function validateAIResponse(response: any): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // 检查必需字段
  const requiredFields = ['risk_level', 'market_status', 'trading_decision', 'logic_chain', 'key_metrics'];
  requiredFields.forEach(field => {
    if (!response[field]) {
      errors.push(`缺少必需字段: ${field}`);
    }
  });

  // 检查trading_decision
  if (response.trading_decision) {
    const td = response.trading_decision;
    if (!td.action || !['BUY', 'SELL', 'HOLD'].includes(td.action)) {
      errors.push('trading_decision.action必须是BUY、SELL或HOLD');
    }
    if (typeof td.confidence !== 'number' || td.confidence < 0 || td.confidence > 100) {
      errors.push('trading_decision.confidence必须是0-100之间的数字');
    }
  }

  // 检查key_metrics
  if (response.key_metrics) {
    const km = response.key_metrics;
    if (typeof km.trap_probability !== 'number' || km.trap_probability < 0 || km.trap_probability > 100) {
      errors.push('key_metrics.trap_probability必须是0-100之间的数字');
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// 解析响应并生成完整结果
export function parseAIResponse(rawResponse: any): {
  response: AIInferenceResponse;
  riskLevel: RiskLevel;
  marketStatus: MarketStatus;
  isCritical: boolean;
  alertConfig: AlertRingConfig;
  conclusion: string;
  criticalKeywords: string[];
} {
  // 验证响应格式
  const validation = validateAIResponse(rawResponse);
  if (!validation.isValid) {
    throw new Error(`AI响应格式无效: ${validation.errors?.join(', ')}`);
  }

  const response = rawResponse as AIInferenceResponse;

  // 解析各种信息
  const riskLevel = parseRiskLevel(response);
  const marketStatus = parseMarketStatus(response);
  const isCritical = isCriticalState(response);
  const alertConfig = generateAlertRingConfig(response);
  const conclusion = extractOneSentenceConclusion(response);
  const criticalKeywords = extractCriticalKeywords(response);

  return {
    response,
    riskLevel,
    marketStatus,
    isCritical,
    alertConfig,
    conclusion,
    criticalKeywords
  };
}

// 生成CSS动画样式
export function generateAlertRingCSS(alertConfig: AlertRingConfig): string {
  const { color, animation, intensity } = alertConfig;

  switch (animation) {
    case 'pulse':
      return `
        @keyframes pulse-alert {
          0% { box-shadow: 0 0 0 0 rgba(${hexToRgb(color)}, ${intensity * 0.1}); }
          70% { box-shadow: 0 0 0 ${intensity * 2}px rgba(${hexToRgb(color)}, 0); }
          100% { box-shadow: 0 0 0 0 rgba(${hexToRgb(color)}, 0); }
        }
        .alert-ring-pulse {
          animation: pulse-alert 2s infinite;
        }
      `;

    case 'flash':
      return `
        @keyframes flash-alert {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0.5; }
        }
        .alert-ring-flash {
          animation: flash-alert 1s infinite;
        }
      `;

    case 'glow':
      return `
        @keyframes glow-alert {
          0%, 100% { box-shadow: 0 0 ${intensity}px ${color}; }
          50% { box-shadow: 0 0 ${intensity * 2}px ${color}; }
        }
        .alert-ring-glow {
          animation: glow-alert 3s infinite;
        }
      `;

    default:
      return '';
  }
}

// 辅助函数：十六进制颜色转RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 77, 79'; // 默认红色

  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

// 生成Tailwind CSS类名
export function generateTailwindClasses(alertConfig: AlertRingConfig): string {
  const { color, priority } = alertConfig;

  let classes = 'relative ';

  // 根据优先级添加边框
  switch (priority) {
    case 'critical':
      classes += 'border-2 border-red-500 ';
      break;
    case 'high':
      classes += 'border-2 border-orange-500 ';
      break;
    case 'medium':
      classes += 'border border-yellow-500 ';
      break;
    default:
      classes += 'border border-green-500 ';
  }

  // 根据动画类型添加类
  switch (alertConfig.animation) {
    case 'pulse':
      classes += 'alert-ring-pulse ';
      break;
    case 'flash':
      classes += 'alert-ring-flash ';
      break;
    case 'glow':
      classes += 'alert-ring-glow ';
      break;
  }

  return classes.trim();
}