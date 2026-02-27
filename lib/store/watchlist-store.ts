/**
 * 自选股全局状态管理Store
 * 基于Zustand实现，支持状态机和乐观UI
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  WatchlistToggleState,
  WatchlistItemStatus,
  WatchlistTransaction,
  generateTransactionId,
  isValidTransition,
  getStateDescription,
  DEFAULT_TOGGLE_CONFIG,
  ToggleStateMachineConfig,
} from '../types';

export interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName: string;
  buyPrice?: number | null;
  stopLossPrice?: number | null;
  targetPrice?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // 实时数据（高频更新）
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  sparklineData?: number[]; // 微型趋势线数据
  // UI状态
  isFavorite: boolean; // 是否在自选股中（乐观状态）
  toggleStatus: WatchlistToggleState; // Toggle状态机状态
  lastUpdated: number; // 最后更新时间戳
}

interface WatchlistGroup {
  id: string;
  name: string;
  description?: string;
  itemIds: string[]; // WatchlistItem的ID列表
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface WatchlistState {
  // 数据状态
  items: Record<string, WatchlistItem>; // stockCode -> WatchlistItem
  groups: WatchlistGroup[];
  itemOrder: string[]; // 显示顺序（stockCode数组）

  // 状态机状态
  itemStatuses: Record<string, WatchlistItemStatus>; // stockCode -> 状态机状态
  activeTransactions: Record<string, WatchlistTransaction>; // transactionId -> 事务

  // UI状态
  isLoading: boolean;
  error: string | null;
  lastSynced: number | null;

  // 配置
  config: ToggleStateMachineConfig;

  // 操作方法
  // 状态机操作
  startToggleTransaction: (stockCode: string, stockName: string, targetState: 'ADD' | 'REMOVE') => Promise<string>; // 返回事务ID
  updateTransactionState: (transactionId: string, newState: WatchlistToggleState, error?: string) => void;
  retryTransaction: (transactionId: string) => void;
  cancelTransaction: (transactionId: string) => void;

  // 数据操作（乐观更新）
  addItemOptimistic: (stockCode: string, stockName: string, itemData?: Partial<WatchlistItem>) => Promise<string>;
  removeItemOptimistic: (stockCode: string) => Promise<string>;
  updateItem: (stockCode: string, updates: Partial<WatchlistItem>) => void;
  updateItemPrice: (stockCode: string, priceData: {
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    sparklineData?: number[];
  }) => void;

  // 列表操作
  reorderItems: (newOrder: string[]) => void;
  moveItemToGroup: (stockCode: string, groupId: string) => void;
  createGroup: (name: string, description?: string) => string;
  deleteGroup: (groupId: string) => void;

  // 同步操作
  syncWithServer: () => Promise<void>;
  clearError: () => void;

  // 工具方法
  getItem: (stockCode: string) => WatchlistItem | undefined;
  getItemStatus: (stockCode: string) => WatchlistItemStatus;
  isInWatchlist: (stockCode: string) => boolean;
  getFavoriteItems: () => WatchlistItem[];
  getItemTransaction: (stockCode: string) => WatchlistTransaction | undefined;
}

// 默认配置
const defaultConfig: ToggleStateMachineConfig = {
  ...DEFAULT_TOGGLE_CONFIG,
  syncTimeout: 10000, // 10秒超时
  maxRetries: 3,
};

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      // 初始状态
      items: {},
      groups: [],
      itemOrder: [],
      itemStatuses: {},
      activeTransactions: {},
      isLoading: false,
      error: null,
      lastSynced: null,
      config: defaultConfig,

      // 状态机操作
      startToggleTransaction: async (stockCode: string, stockName: string, targetState: 'ADD' | 'REMOVE') => {
        const transactionId = generateTransactionId(stockCode);
        const timestamp = Date.now();

        const transaction: WatchlistTransaction = {
          id: transactionId,
          stockCode,
          targetState,
          startedAt: timestamp,
          state: 'OPTIMISTIC_UPDATING',
          retryCount: 0,
        };

        const itemStatus: WatchlistItemStatus = {
          stockCode,
          state: 'OPTIMISTIC_UPDATING',
          isInWatchlist: targetState === 'ADD',
          lastUpdated: timestamp,
        };

        // 乐观更新UI状态
        set((state) => {
          const isAdding = targetState === 'ADD';
          const existingItem = state.items[stockCode];

          // 如果添加且项目不存在，创建临时项目
          if (isAdding && !existingItem) {
            const newItem: WatchlistItem = {
              id: `temp_${stockCode}_${timestamp}`,
              stockCode,
              stockName,
              isFavorite: true,
              toggleStatus: 'OPTIMISTIC_UPDATING' as WatchlistToggleState,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastUpdated: timestamp,
            };

            return {
              items: { ...state.items, [stockCode]: newItem },
              itemOrder: [...state.itemOrder, stockCode],
              itemStatuses: { ...state.itemStatuses, [stockCode]: itemStatus },
              activeTransactions: { ...state.activeTransactions, [transactionId]: transaction },
            };
          }

          // 如果项目已存在，更新状态
          if (existingItem) {
            const updatedItem = {
              ...existingItem,
              isFavorite: isAdding,
              toggleStatus: 'OPTIMISTIC_UPDATING' as WatchlistToggleState,
              lastUpdated: timestamp,
            };

            return {
              items: { ...state.items, [stockCode]: updatedItem },
              itemStatuses: { ...state.itemStatuses, [stockCode]: itemStatus },
              activeTransactions: { ...state.activeTransactions, [transactionId]: transaction },
            };
          }

          // 移除操作但项目不存在（不应该发生）
          return {
            itemStatuses: { ...state.itemStatuses, [stockCode]: itemStatus },
            activeTransactions: { ...state.activeTransactions, [transactionId]: transaction },
          };
        });

        // 触发触觉反馈（如果启用）
        if (typeof window !== 'undefined' && navigator.vibrate && get().config.hapticFeedback) {
          navigator.vibrate(50); // 短暂震动50ms
        }

        // 开始后台同步（真正的API调用）
        setTimeout(async () => {
          get().updateTransactionState(transactionId, 'SYNCING');

          try {
            // 真正的API调用
            const method = targetState === 'ADD' ? 'POST' : 'DELETE';

            // 对于删除操作，需要先获取项目的ID
            let apiEndpoint = '/api/watchlist';
            if (targetState === 'REMOVE') {
              const item = get().items[stockCode];
              if (item && item.id && !item.id.startsWith('temp_')) {
                apiEndpoint = `/api/watchlist?id=${item.id}`;
              } else {
                // 如果是临时项目或没有ID，直接乐观删除
                get().updateTransactionState(transactionId, 'SUCCESS');
                return;
              }
            }

            const requestBody = targetState === 'ADD' ? {
              stockCode,
              stockName,
            } : undefined;

            const response = await fetch(apiEndpoint, {
              method,
              headers: {
                'Content-Type': 'application/json',
              },
              ...(requestBody && { body: JSON.stringify(requestBody) }),
            });

            if (response.ok) {
              get().updateTransactionState(transactionId, 'SUCCESS');

              // 成功后清理事务
              setTimeout(() => {
                set((state) => {
                  const { [transactionId]: _, ...remainingTransactions } = state.activeTransactions;
                  return { activeTransactions: remainingTransactions };
                });
              }, 2000);
            } else {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error || errorData.details || `API请求失败: ${response.status}`;
              get().updateTransactionState(transactionId, 'ROLLBACK_ERROR', errorMessage);
            }
          } catch (error) {
            console.error('API调用失败:', error);
            const errorMessage = error instanceof Error ? error.message : '网络错误，请检查连接';
            get().updateTransactionState(transactionId, 'ROLLBACK_ERROR', errorMessage);
          }
        }, 100); // 延迟100ms以允许UI响应

        return transactionId;
      },

      updateTransactionState: (transactionId: string, newState: WatchlistToggleState, error?: string) => {
        set((state) => {
          const transaction = state.activeTransactions[transactionId];
          if (!transaction) return state;

          // 验证状态转换
          if (!isValidTransition(transaction.state, newState)) {
            console.warn(`Invalid state transition: ${transaction.state} -> ${newState}`);
            return state;
          }

          const updatedTransaction = {
            ...transaction,
            state: newState,
          };

          const updatedItemStatus: WatchlistItemStatus = {
            stockCode: transaction.stockCode,
            state: newState,
            isInWatchlist: transaction.targetState === 'ADD',
            lastUpdated: Date.now(),
            error,
          };

          // 如果是回滚错误，恢复原始状态
          if (newState === 'ROLLBACK_ERROR') {
            const item = state.items[transaction.stockCode];
            if (item) {
              // 恢复之前的收藏状态
              const wasFavorite = transaction.targetState === 'REMOVE'; // 如果目标是移除，则回滚到true
              const updatedItem = {
                ...item,
                isFavorite: wasFavorite,
                toggleStatus: 'ROLLBACK_ERROR' as WatchlistToggleState,
                lastUpdated: Date.now(),
              };

              return {
                items: { ...state.items, [transaction.stockCode]: updatedItem },
                itemStatuses: { ...state.itemStatuses, [transaction.stockCode]: updatedItemStatus },
                activeTransactions: { ...state.activeTransactions, [transactionId]: updatedTransaction },
                error: error || '操作失败',
              };
            }
          }

          // 如果是成功状态，确保状态一致
          if (newState === 'SUCCESS') {
            const item = state.items[transaction.stockCode];
            if (item) {
              const updatedItem = {
                ...item,
                toggleStatus: 'SUCCESS' as WatchlistToggleState,
                lastUpdated: Date.now(),
              };

              return {
                items: { ...state.items, [transaction.stockCode]: updatedItem },
                itemStatuses: { ...state.itemStatuses, [transaction.stockCode]: updatedItemStatus },
                activeTransactions: { ...state.activeTransactions, [transactionId]: updatedTransaction },
              };
            }
          }

          // 更新状态机状态
          return {
            itemStatuses: { ...state.itemStatuses, [transaction.stockCode]: updatedItemStatus },
            activeTransactions: { ...state.activeTransactions, [transactionId]: updatedTransaction },
          };
        });
      },

      retryTransaction: (transactionId: string) => {
        const state = get();
        const transaction = state.activeTransactions[transactionId];
        if (!transaction || transaction.retryCount >= state.config.maxRetries) return;

        // 增加重试计数
        const updatedTransaction = {
          ...transaction,
          retryCount: transaction.retryCount + 1,
          state: 'OPTIMISTIC_UPDATING' as WatchlistToggleState,
        };

        set({
          activeTransactions: { ...state.activeTransactions, [transactionId]: updatedTransaction },
          error: null,
        });

        // 重新开始同步（真正的API调用）
        setTimeout(async () => {
          get().updateTransactionState(transactionId, 'SYNCING');

          try {
            // 真正的API调用
            const method = transaction.targetState === 'ADD' ? 'POST' : 'DELETE';

            // 对于删除操作，需要先获取项目的ID
            let apiEndpoint = '/api/watchlist';
            if (transaction.targetState === 'REMOVE') {
              const item = state.items[transaction.stockCode];
              if (item && item.id && !item.id.startsWith('temp_')) {
                apiEndpoint = `/api/watchlist?id=${item.id}`;
              } else {
                // 如果是临时项目或没有ID，直接乐观删除
                get().updateTransactionState(transactionId, 'SUCCESS');
                return;
              }
            }

            const requestBody = transaction.targetState === 'ADD' ? {
              stockCode: transaction.stockCode,
              stockName: state.items[transaction.stockCode]?.stockName || 'Unknown',
            } : undefined;

            const response = await fetch(apiEndpoint, {
              method,
              headers: {
                'Content-Type': 'application/json',
              },
              ...(requestBody && { body: JSON.stringify(requestBody) }),
            });

            if (response.ok) {
              get().updateTransactionState(transactionId, 'SUCCESS');
            } else {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error || errorData.details || `重试失败 (${updatedTransaction.retryCount}/${state.config.maxRetries})`;
              get().updateTransactionState(transactionId, 'ROLLBACK_ERROR', errorMessage);
            }
          } catch (error) {
            console.error('重试API调用失败:', error);
            const errorMessage = `重试失败 (${updatedTransaction.retryCount}/${state.config.maxRetries}): ${error instanceof Error ? error.message : '网络错误'}`;
            get().updateTransactionState(transactionId, 'ROLLBACK_ERROR', errorMessage);
          }
        }, 100);
      },

      cancelTransaction: (transactionId: string) => {
        set((state) => {
          const transaction = state.activeTransactions[transactionId];
          if (!transaction) return state;

          // 如果是进行中的事务，回滚到IDLE状态
          if (transaction.state === 'OPTIMISTIC_UPDATING' || transaction.state === 'SYNCING') {
            const item = state.items[transaction.stockCode];
            if (item) {
              const wasFavorite = transaction.targetState === 'REMOVE'; // 取消操作，恢复之前状态
              const updatedItem = {
                ...item,
                isFavorite: wasFavorite,
                toggleStatus: 'IDLE' as WatchlistToggleState,
                lastUpdated: Date.now(),
              };

              const updatedItemStatus: WatchlistItemStatus = {
                stockCode: transaction.stockCode,
                state: 'IDLE',
                isInWatchlist: wasFavorite,
                lastUpdated: Date.now(),
              };

              const { [transactionId]: _, ...remainingTransactions } = state.activeTransactions;

              return {
                items: { ...state.items, [transaction.stockCode]: updatedItem },
                itemStatuses: { ...state.itemStatuses, [transaction.stockCode]: updatedItemStatus },
                activeTransactions: remainingTransactions,
              };
            }
          }

          // 直接移除事务
          const { [transactionId]: _, ...remainingTransactions } = state.activeTransactions;
          return { activeTransactions: remainingTransactions };
        });
      },

      // 数据操作（乐观更新）
      addItemOptimistic: async (stockCode: string, stockName: string, itemData?: Partial<WatchlistItem>) => {
        return get().startToggleTransaction(stockCode, stockName, 'ADD');
      },

      removeItemOptimistic: async (stockCode: string) => {
        const item = get().items[stockCode];
        if (!item) return '';

        return get().startToggleTransaction(stockCode, item.stockName, 'REMOVE');
      },

      updateItem: (stockCode: string, updates: Partial<WatchlistItem>) => {
        set((state) => {
          const item = state.items[stockCode];
          if (!item) return state;

          const updatedItem = {
            ...item,
            ...updates,
            updatedAt: new Date(),
            lastUpdated: Date.now(),
          };

          return {
            items: { ...state.items, [stockCode]: updatedItem },
          };
        });
      },

      updateItemPrice: (stockCode: string, priceData: {
        currentPrice: number;
        priceChange: number;
        priceChangePercent: number;
        sparklineData?: number[];
      }) => {
        set((state) => {
          const item = state.items[stockCode];
          if (!item) return state;

          const updatedItem = {
            ...item,
            ...priceData,
            lastUpdated: Date.now(),
          };

          return {
            items: { ...state.items, [stockCode]: updatedItem },
          };
        });
      },

      // 列表操作
      reorderItems: (newOrder: string[]) => {
        set({ itemOrder: newOrder });

        // 异步保存排序到本地存储（通过persist中间件自动处理）
      },

      moveItemToGroup: (stockCode: string, groupId: string) => {
        set((state) => {
          const groupIndex = state.groups.findIndex(g => g.id === groupId);
          if (groupIndex === -1) return state;

          const updatedGroups = [...state.groups];
          const group = updatedGroups[groupIndex];

          // 从其他组中移除
          updatedGroups.forEach(g => {
            if (g.id !== groupId) {
              g.itemIds = g.itemIds.filter(id => id !== stockCode);
            }
          });

          // 添加到目标组（如果尚未存在）
          if (!group.itemIds.includes(stockCode)) {
            group.itemIds.push(stockCode);
            group.updatedAt = new Date();
          }

          return { groups: updatedGroups };
        });
      },

      createGroup: (name: string, description?: string) => {
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newGroup: WatchlistGroup = {
          id: groupId,
          name,
          description,
          itemIds: [],
          order: get().groups.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          groups: [...state.groups, newGroup],
        }));

        return groupId;
      },

      deleteGroup: (groupId: string) => {
        set((state) => ({
          groups: state.groups.filter(g => g.id !== groupId),
        }));
      },

      // 同步操作
      syncWithServer: async () => {
        set({ isLoading: true, error: null });

        try {
          // 模拟API调用
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 这里应该调用实际的watchlist API
          // const response = await fetch('/api/watchlist');
          // const data = await response.json();

          set({
            isLoading: false,
            lastSynced: Date.now(),
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '同步失败',
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      // 工具方法
      getItem: (stockCode: string) => {
        return get().items[stockCode];
      },

      getItemStatus: (stockCode: string) => {
        return get().itemStatuses[stockCode] || {
          stockCode,
          state: 'IDLE',
          isInWatchlist: false,
          lastUpdated: 0,
        };
      },

      isInWatchlist: (stockCode: string) => {
        const item = get().items[stockCode];
        return item?.isFavorite || false;
      },

      getFavoriteItems: () => {
        const state = get();
        return state.itemOrder
          .map(stockCode => state.items[stockCode])
          .filter(item => item?.isFavorite);
      },

      getItemTransaction: (stockCode: string) => {
        const state = get();
        return Object.values(state.activeTransactions)
          .find(transaction => transaction.stockCode === stockCode);
      },
    }),
    {
      name: 'watchlist-storage', // localStorage中的key
      partialize: (state) => ({
        items: state.items,
        groups: state.groups,
        itemOrder: state.itemOrder,
        config: state.config,
      }),
    }
  )
);