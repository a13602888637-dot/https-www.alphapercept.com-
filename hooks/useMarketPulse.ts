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

export function useMarketPulse(refreshInterval: number = 60000): UseMarketPulseReturn {
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

      // Show error state instead of mock data
      if (indicators.length === 0) {
        setIndicators([
          { label: '上证指数', value: '--', change: '--' },
          { label: '深证成指', value: '--', change: '--' },
          { label: '创业板指', value: '--', change: '--' },
          { label: '北向资金', value: '--', change: '--' },
        ])
      }
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
      // 交易时段：每60秒刷新一次
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