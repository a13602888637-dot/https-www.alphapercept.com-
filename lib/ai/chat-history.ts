/**
 * 对话历史管理
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  stockCode?: string;
}

const STORAGE_KEY = 'ai-chat-history';
const MAX_HISTORY_PER_STOCK = 20;

/**
 * 获取股票的对话历史
 */
export function getChatHistory(stockCode: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${stockCode}`);
    if (!stored) return [];

    const history = JSON.parse(stored);
    return history.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

/**
 * 保存对话历史
 */
export function saveChatHistory(stockCode: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;

  try {
    // 限制历史记录数量
    const limitedMessages = messages.slice(-MAX_HISTORY_PER_STOCK);
    localStorage.setItem(`${STORAGE_KEY}-${stockCode}`, JSON.stringify(limitedMessages));
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

/**
 * 添加消息到历史
 */
export function addMessageToHistory(stockCode: string, message: ChatMessage): ChatMessage[] {
  const history = getChatHistory(stockCode);
  const newHistory = [...history, message];
  saveChatHistory(stockCode, newHistory);
  return newHistory;
}

/**
 * 更新最后一条消息
 */
export function updateLastMessage(stockCode: string, content: string): ChatMessage[] {
  const history = getChatHistory(stockCode);
  if (history.length === 0) return history;

  const lastMessage = history[history.length - 1];
  lastMessage.content = content;
  lastMessage.timestamp = new Date();

  saveChatHistory(stockCode, history);
  return history;
}

/**
 * 清除股票的对话历史
 */
export function clearChatHistory(stockCode: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${STORAGE_KEY}-${stockCode}`);
}

/**
 * 生成唯一消息ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
