"use client"

import { useState, useEffect, useCallback } from 'react'
import { fetchMarketIndicators, MarketIndicator, isMarketOpen } from '@/lib/market-indicators'

interface UseMarketPulseReturn {
  indicators: MarketIndicator[]
  isLoading: boolean
  error: string | null
  lastUpdateTime: string
  marketStatus: 'open' | 'closed'
  refresh: () => Promise<void>
}

export function useMarketPulse(refreshInterval: number = 30000): UseMarketPulseReturn {
  const [indicators, setIndicators] = useState<MarketIndicator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed'>('closed')

  const fetchIndicators = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await fetchMarketIndicators()
      setIndicators(data)
      setLastUpdateTime(new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }))
      setMarketStatus(isMarketOpen() ? 'open' : 'closed')
    } catch (err) {
      console.error('Failed to fetch market indicators:', err)
      setError('数据获取失败，请稍后重试')

      // 使用模拟数据作为回退
      const mockIndicators: MarketIndicator[] = [
        { label: '上证指数', value: '3,245.67', change: '+1.23%' },
        { label: '深证成指', value: '10,523.89', change: '+0.89%' },
        { label: '创业板指', value: '2,156.34', change: '+2.15%' },
        { label: '北向资金', value: '+15.2亿', change: '+' },
      ]
      setIndicators(mockIndicators)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始获取数据
  useEffect(() => {
    fetchIndicators()
  }, [fetchIndicators])

  // 根据市场状态设置不同的刷新间隔
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (marketStatus === 'open') {
      // 交易时段：每30秒刷新一次
      intervalId = setInterval(() => {
        fetchIndicators()
      }, refreshInterval)
    } else {
      // 非交易时段：每5分钟刷新一次
      intervalId = setInterval(() => {
        fetchIndicators()
      }, 300000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [marketStatus, fetchIndicators, refreshInterval])

  return {
    indicators,
    isLoading,
    error,
    lastUpdateTime,
    marketStatus,
    refresh: fetchIndicators,
  }
}