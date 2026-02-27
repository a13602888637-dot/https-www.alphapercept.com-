/**
 * 自选股Toggle状态机类型定义
 * 遵循Milestone 6.5要求：五个核心状态节点
 */

export type WatchlistToggleState =
  | 'IDLE'           // 静默状态：等待用户操作
  | 'OPTIMISTIC_UPDATING' // 乐观更新中：用户点击瞬间，UI立即响应
  | 'SYNCING'        // 后台同步中：与服务器进行数据同步
  | 'SUCCESS'        // 成功：操作完成
  | 'ROLLBACK_ERROR'; // 失败回滚：操作失败，状态回退

export type WatchlistItemStatus = {
  stockCode: string;
  state: WatchlistToggleState;
  isInWatchlist: boolean; // 当前是否在自选股中（乐观状态）
  lastUpdated: number; // 时间戳
  error?: string; // 错误信息（如果有）
};

export type WatchlistTransaction = {
  id: string; // 事务ID
  stockCode: string;
  targetState: 'ADD' | 'REMOVE'; // 目标操作
  startedAt: number; // 开始时间
  state: WatchlistToggleState;
  retryCount: number;
};

/**
 * Toggle状态机配置
 */
export interface ToggleStateMachineConfig {
  // 乐观UI相关
  optimisticUpdateDelay: number; // 乐观更新延迟（ms），通常为0
  syncTimeout: number; // 同步超时时间（ms）
  maxRetries: number; // 最大重试次数

  // UI反馈配置
  hapticFeedback: boolean; // 是否启用触觉反馈
  visualFeedback: {
    popAnimation: boolean; // 是否启用Pop动画
    colorTransition: boolean; // 是否启用颜色过渡
    duration: number; // 动画持续时间（ms）
  };
}

/**
 * 默认配置
 */
export const DEFAULT_TOGGLE_CONFIG: ToggleStateMachineConfig = {
  optimisticUpdateDelay: 0,
  syncTimeout: 10000, // 10秒超时
  maxRetries: 3,
  hapticFeedback: true,
  visualFeedback: {
    popAnimation: true,
    colorTransition: true,
    duration: 300,
  },
};

/**
 * 状态机转换规则
 */
export const STATE_TRANSITIONS: Record<WatchlistToggleState, WatchlistToggleState[]> = {
  IDLE: ['OPTIMISTIC_UPDATING'],
  OPTIMISTIC_UPDATING: ['SYNCING', 'ROLLBACK_ERROR'],
  SYNCING: ['SUCCESS', 'ROLLBACK_ERROR'],
  SUCCESS: ['IDLE'],
  ROLLBACK_ERROR: ['IDLE'], // 只能回到IDLE状态，避免无限重试循环
};

/**
 * 验证状态转换是否合法
 */
export function isValidTransition(
  currentState: WatchlistToggleState,
  nextState: WatchlistToggleState
): boolean {
  return STATE_TRANSITIONS[currentState]?.includes(nextState) ?? false;
}

/**
 * 获取状态的描述信息
 */
export function getStateDescription(state: WatchlistToggleState): {
  message: string;
  isError: boolean;
  isProcessing: boolean;
} {
  const descriptions = {
    IDLE: {
      message: '准备就绪',
      isError: false,
      isProcessing: false,
    },
    OPTIMISTIC_UPDATING: {
      message: '更新中...',
      isError: false,
      isProcessing: true,
    },
    SYNCING: {
      message: '同步数据...',
      isError: false,
      isProcessing: true,
    },
    SUCCESS: {
      message: '操作成功',
      isError: false,
      isProcessing: false,
    },
    ROLLBACK_ERROR: {
      message: '操作失败，已回滚',
      isError: true,
      isProcessing: false,
    },
  };

  return descriptions[state];
}

/**
 * 生成事务ID
 */
export function generateTransactionId(stockCode: string): string {
  return `${stockCode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}