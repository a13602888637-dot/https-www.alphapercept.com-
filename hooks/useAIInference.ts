/**
 * AI推理自定义Hook
 * 用于在React组件中调用AI推理代理
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AIInferenceRequest,
  AIInferenceResponse,
  AIInferenceState,
  StockMarketData
} from '@/lib/ai/inference-types';
import { parseAIResponse } from '@/lib/ai/risk-parser';
import { buildInferencePrompt, buildSystemPrompt, generateInferenceId } from '@/lib/ai/prompt-engineering';

// DeepSeek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// 默认选项
const DEFAULT_OPTIONS = {
  includeTechnicalAnalysis: true,
  includeNewsAnalysis: false,
  includeHistoricalData: false,
  timeoutMs: 30000,
  maxRetries: 3
};

// 使用AI推理的Hook
export function useAIInference() {
  const [state, setState] = useState<AIInferenceState>({
    status: 'idle'
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 调用DeepSeek API
  const callDeepSeekAPI = useCallback(async (
    prompt: string,
    apiKey: string,
    maxRetries: number = 3
  ): Promise<string> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`调用DeepSeek API (尝试 ${attempt}/${maxRetries})...`);

        const systemPrompt = buildSystemPrompt();
        abortControllerRef.current = new AbortController();

        const response = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.2,
            max_tokens: 3000,
            response_format: { type: 'json_object' }
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepSeek API错误 (${response.status}): ${response.statusText}. 响应: ${errorText}`);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
          throw new Error('DeepSeek API返回了无效的响应格式');
        }

        const content = data.choices[0].message.content;
        console.log(`DeepSeek API调用成功 (尝试 ${attempt})`, { contentLength: content.length });
        return content;

      } catch (error: any) {
        lastError = error;
        console.warn(`DeepSeek API调用失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

        // 如果不是最后一次尝试，等待一段时间后重试
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败
    console.error('DeepSeek API调用失败，所有重试均未成功');
    throw lastError || new Error('DeepSeek API调用失败');
  }, []);

  // 执行AI推理
  const infer = useCallback(async (
    request: AIInferenceRequest
  ): Promise<AIInferenceResponse> => {
    try {
      // 设置加载状态
      setState({
        status: 'loading',
        progress: 0
      });

      // 获取API密钥
      const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error('未设置DeepSeek API密钥。请设置环境变量 NEXT_PUBLIC_DEEPSEEK_API_KEY');
      }

      // 构建提示词
      setState(prev => ({ ...prev, progress: 20 }));
      const prompt = buildInferencePrompt(
        request.stockData,
        request.context,
        { ...DEFAULT_OPTIONS, ...request.options }
      );

      // 调用API
      setState(prev => ({ ...prev, progress: 40 }));
      const aiResponse = await callDeepSeekAPI(
        prompt,
        apiKey,
        request.options?.maxRetries || DEFAULT_OPTIONS.maxRetries
      );

      // 解析响应
      setState(prev => ({ ...prev, progress: 80 }));
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
        console.log('解析AI响应成功');
      } catch (error) {
        console.error('解析JSON响应失败:', error);
        console.error('原始响应:', aiResponse);
        throw new Error('AI响应不是有效的JSON格式');
      }

      // 验证并解析响应
      const result = parseAIResponse(parsedResponse);

      // 更新状态
      setState({
        status: 'success',
        data: result.response,
        lastUpdated: new Date().toISOString(),
        progress: 100
      });

      return result.response;

    } catch (error: any) {
      console.error('AI推理失败:', error);

      const inferenceError = {
        code: 'INFERENCE_ERROR',
        message: error.message || 'AI推理失败',
        details: error,
        timestamp: new Date().toISOString()
      };

      setState({
        status: 'error',
        error: inferenceError,
        lastUpdated: new Date().toISOString()
      });

      throw error;
    } finally {
      cleanup();
    }
  }, [callDeepSeekAPI, cleanup]);

  // 重置状态
  const reset = useCallback(() => {
    cleanup();
    setState({
      status: 'idle'
    });
  }, [cleanup]);

  // 获取股票数据并推理
  const inferStock = useCallback(async (
    symbol: string,
    context?: AIInferenceRequest['context'],
    options?: AIInferenceRequest['options']
  ): Promise<AIInferenceResponse> => {
    try {
      // 获取股票数据
      setState({ status: 'loading', progress: 10 });

      const stockData = await fetchStockData(symbol);
      if (!stockData) {
        throw new Error(`无法获取股票数据: ${symbol}`);
      }

      // 执行推理
      return await infer({
        stockData,
        context,
        options
      });

    } catch (error) {
      console.error(`股票推理失败 ${symbol}:`, error);
      throw error;
    }
  }, [infer]);

  // 批量推理
  const batchInfer = useCallback(async (
    symbols: string[],
    context?: AIInferenceRequest['context'],
    options?: AIInferenceRequest['options']
  ): Promise<{ [symbol: string]: AIInferenceResponse }> => {
    const results: { [symbol: string]: AIInferenceResponse } = {};

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      try {
        // 更新进度
        setState(prev => ({
          ...prev,
          status: 'loading',
          progress: Math.round((i / symbols.length) * 100)
        }));

        const result = await inferStock(symbol, context, options);
        results[symbol] = result;

      } catch (error) {
        console.error(`批量推理失败 ${symbol}:`, error);
        // 继续处理其他股票
      }
    }

    setState(prev => ({ ...prev, status: 'success', progress: 100 }));
    return results;
  }, [inferStock]);

  return {
    // 状态
    state,

    // 操作方法
    infer,
    inferStock,
    batchInfer,
    reset,

    // 工具方法
    abort: cleanup
  };
}

// 获取股票数据
async function fetchStockData(symbol: string): Promise<StockMarketData | null> {
  try {
    // 调用现有的股票API
    const response = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);

    if (!response.ok) {
      throw new Error(`股票API错误: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('股票API返回无效数据');
    }

    // 解析Yahoo Finance数据
    const yahooData = data.data;
    const chartData = yahooData.chart?.result?.[0];

    if (!chartData) {
      throw new Error('无法解析Yahoo Finance数据');
    }

    const meta = chartData.meta;
    const indicators = chartData.indicators;
    const quote = indicators?.quote?.[0];

    // 构建股票数据对象
    const stockData: StockMarketData = {
      symbol,
      name: meta?.shortName || symbol,
      currentPrice: meta?.regularMarketPrice || 0,
      highPrice: meta?.regularMarketDayHigh || 0,
      lowPrice: meta?.regularMarketDayLow || 0,
      change: meta?.regularMarketChange || 0,
      changePercent: meta?.regularMarketChangePercent || 0,
      volume: meta?.regularMarketVolume || 0,
      turnover: 0, // Yahoo Finance不提供成交额
      lastUpdateTime: new Date(meta?.regularMarketTime * 1000).toISOString(),
      // 技术指标需要单独计算
    };

    return stockData;

  } catch (error) {
    console.error(`获取股票数据失败 ${symbol}:`, error);

    // 返回模拟数据作为降级
    return createMockStockData(symbol);
  }
}

// 创建模拟股票数据（降级方案）
function createMockStockData(symbol: string): StockMarketData {
  const basePrice = 10 + Math.random() * 100;
  const change = (Math.random() - 0.5) * 5;
  const changePercent = (change / basePrice) * 100;

  return {
    symbol,
    name: `模拟股票 ${symbol}`,
    currentPrice: basePrice + change,
    highPrice: basePrice + Math.random() * 2,
    lowPrice: basePrice - Math.random() * 2,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 10000000),
    turnover: Math.floor(Math.random() * 100000000),
    lastUpdateTime: new Date().toISOString(),
    ma60: basePrice * (0.95 + Math.random() * 0.1),
    md60: (Math.random() - 0.5) * 20,
    rsi: 30 + Math.random() * 40,
    macd: {
      diff: (Math.random() - 0.5) * 2,
      signal: (Math.random() - 0.5) * 1.5,
      histogram: (Math.random() - 0.5) * 0.5
    },
    mainNetInflow: (Math.random() - 0.5) * 10000000,
    largeOrderRatio: Math.random() * 0.3
  };
}

// 导出工具函数
export function useAIInferenceState() {
  const { state } = useAIInference();
  return state;
}

// 导出简化的推理函数
export function useSingleInference() {
  const { infer, state } = useAIInference();

  return {
    infer,
    isLoading: state.status === 'loading',
    data: state.data,
    error: state.error,
    progress: state.progress
  };
}