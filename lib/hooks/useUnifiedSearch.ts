import { useState, useCallback } from 'react'
import type { SearchResultGroup, StockResult } from '@/components/portfolio/search-results'

interface UnifiedSearchResponse {
  success: boolean
  query: string
  results: SearchResultGroup[]
  totalResults: number
  timestamp: string
  error?: string
}

export function useUnifiedSearch() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResultGroup[]>([])
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/unified-search?query=${encodeURIComponent(query)}`)

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`)
      }

      const data: UnifiedSearchResponse = await response.json()

      if (data.success) {
        setResults(data.results)
      } else {
        throw new Error(data.error || '搜索失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索失败，请稍后重试'
      setError(errorMessage)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResults([])
    setError(null)
    setLoading(false)
  }, [])

  return {
    search,
    reset,
    loading,
    results,
    error
  }
}
