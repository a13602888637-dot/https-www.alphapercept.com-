/**
 * AI推理代理类型定义
 * 用于量化推演显化代理（AI Inference Agent）
 */

// 股票市场数据接口
export interface StockMarketData {
  symbol: string;
  name: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  lastUpdateTime: string;
  // 技术指标
  ma60?: number;
  md60?: number;
  rsi?: number;
  macd?: {
    diff: number;
    signal: number;
    histogram: number;
  };
  // 资金流向
  mainNetInflow?: number; // 主力净流入
  largeOrderRatio?: number; // 大单占比
  // 历史数据
  historicalPrices?: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

// AI推理响应接口
export interface AIInferenceResponse {
  // 核心风险字段
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  market_status: 'normal' | 'warning' | 'danger' | 'critical';

  // 反人性破解器识别
  anti_humanity_patterns: {
    // 诱多模型识别
    trap_pattern?: {
      type: '诱多' | '洗盘' | '龙头衰竭';
      confidence: number; // 0-100
      description: string;
      trigger_conditions: string[];
      recommended_action: '清仓' | '减仓' | '观望' | '低吸';
    };
    // 洗盘模型识别
    wash_pattern?: {
      type: '洗盘';
      confidence: number;
      description: string;
      support_level: 'MA20' | 'MA60';
      recommended_action: '分批低吸' | '小仓位试探';
    };
    // 龙头衰竭识别
    exhaustion_pattern?: {
      type: '龙头衰竭';
      confidence: number;
      description: string;
      exhaustion_signals: string[];
      recommended_action: '严格止盈' | '减仓50%' | '保持警惕';
    };
  };

  // 交易决策
  trading_decision: {
    action: 'BUY' | 'SELL' | 'HOLD';
    target_price?: number;
    stop_loss?: number;
    position_size?: number; // 仓位比例 0-100%
    time_horizon?: '短期' | '中期' | '长期';
    confidence: number; // 0-100
  };

  // 逻辑链分析
  logic_chain: {
    macro_analysis: string; // 宏观对冲分析
    value_assessment: string; // 价值防守分析
    sentiment_analysis: string; // 游资情绪分析
    event_impact: string; // 事件驱动分析
    anti_humanity_check: string; // 反人性破解器检查
    risk_assessment: string; // 风险评估
  };

  // 预期差计算
  expectation_gap?: {
    market_expectation: number; // 市场预期
    actual_impact: number; // 实际影响
    gap_value: number; // 预期差值
    gap_level: '高预期差' | '低预期差' | '无预期差';
  };

  // 关键指标
  key_metrics: {
    trap_probability: number; // 陷阱概率 0-100
    valuation_safety_margin: number; // 估值安全边际 0-100
    sentiment_score: number; // 情绪得分 0-100
    trend_strength: number; // 趋势强度 0-100
  };

  // 可视化建议
  visualization_suggestions: {
    alert_ring_color: string; // 警报环颜色
    alert_intensity: number; // 警报强度 0-10
    animation_type: 'pulse' | 'flash' | 'glow' | 'none';
    display_message: string; // 显示消息
    priority_level: 'critical' | 'high' | 'medium' | 'low';
  };

  // 元数据
  metadata: {
    inference_id: string;
    timestamp: string;
    model_version: string;
    processing_time_ms: number;
    data_sources: string[];
  };
}

// 风险等级映射
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// 市场状态映射
export type MarketStatus = 'normal' | 'warning' | 'danger' | 'critical';

// 反人性破解器模式类型
export type AntiHumanityPatternType = '诱多' | '洗盘' | '龙头衰竭';

// 交易动作类型
export type TradingAction = 'BUY' | 'SELL' | 'HOLD';

// 警报环配置
export interface AlertRingConfig {
  color: string;
  intensity: number;
  animation: 'pulse' | 'flash' | 'glow' | 'none';
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// AI推理请求参数
export interface AIInferenceRequest {
  stockData: StockMarketData;
  context?: {
    portfolio?: {
      [symbol: string]: {
        quantity: number;
        avgPrice: number;
        currentValue: number;
        unrealizedPnl: number;
      };
    };
    marketCondition?: {
      trend: 'bullish' | 'bearish' | 'sideways';
      volatility: 'low' | 'medium' | 'high';
      liquidity: '充足' | '一般' | '紧张';
    };
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
    availableCapital?: number;
    userId?: string;
  };
  options?: {
    includeTechnicalAnalysis?: boolean;
    includeNewsAnalysis?: boolean;
    includeHistoricalData?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
  };
}

// AI推理错误类型
export interface AIInferenceError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// AI推理状态
export interface AIInferenceState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: AIInferenceResponse;
  error?: AIInferenceError;
  lastUpdated?: string;
  progress?: number;
}

// 风险关键词映射
export const RISK_KEYWORDS = {
  CRITICAL: ['强衰竭', '诱多', '清仓', '强制止损', '天量', '炸板', '尖顶形态'],
  HIGH: ['高风险', '陷阱概率高', '破位', '放量下跌', '冲高回落', '长上影线'],
  MEDIUM: ['中等风险', '需谨慎', '震荡', '调整', '缩量'],
  LOW: ['低风险', '安全', '稳健', '支撑有效', '趋势良好']
} as const;

// 反人性破解器关键词
export const ANTI_HUMANITY_KEYWORDS = {
  TRAP_PATTERN: ['诱多', '利好出尽', '高开低走', '冲高回落', '长上影线', '成交量放大'],
  WASH_PATTERN: ['洗盘', '缩量调整', '支撑位', 'MA60', '上升趋势', '利空消息'],
  EXHAUSTION_PATTERN: ['龙头衰竭', '尾盘炸板', '天量', '尖顶形态', '连板个股', '开板次数']
} as const;

// 默认警报环配置
export const DEFAULT_ALERT_CONFIGS: Record<RiskLevel, AlertRingConfig> = {
  critical: {
    color: '#FF4D4F',
    intensity: 10,
    animation: 'pulse',
    message: '⚠️ 强衰竭/诱多/清仓信号！立即行动！',
    priority: 'critical'
  },
  high: {
    color: '#FF6B6B',
    intensity: 7,
    animation: 'flash',
    message: '⚠️ 高风险警报！建议减仓或观望',
    priority: 'high'
  },
  medium: {
    color: '#FFA726',
    intensity: 4,
    animation: 'glow',
    message: '⚠️ 中等风险，需保持警惕',
    priority: 'medium'
  },
  low: {
    color: '#4CAF50',
    intensity: 1,
    animation: 'none',
    message: '✓ 风险可控，趋势正常',
    priority: 'low'
  }
};