"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Star, Loader2, Check, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWatchlistStore } from '@/lib/store'
import { WatchlistToggleState, getStateDescription } from '@/lib/types/watchlist-state-machine'

export interface WatchlistToggleProps {
  stockCode: string
  stockName: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'ghost' | 'filled'
  showLabel?: boolean
  initialIsFavorite?: boolean
  className?: string
  onToggle?: (isFavorite: boolean, stockCode: string) => void
  onStateChange?: (state: WatchlistToggleState, stockCode: string) => void
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  default: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const variantClasses = {
  default: 'bg-transparent hover:bg-muted/50',
  outline: 'border border-input bg-transparent hover:bg-accent/50',
  ghost: 'bg-transparent hover:bg-accent/30',
  filled: 'bg-primary/10 hover:bg-primary/20 text-primary',
}

const stateColors: Record<WatchlistToggleState, string> = {
  IDLE: 'text-muted-foreground',
  OPTIMISTIC_UPDATING: 'text-primary animate-pulse',
  SYNCING: 'text-blue-500',
  SUCCESS: 'text-green-500',
  ROLLBACK_ERROR: 'text-red-500',
}

export function WatchlistToggle({
  stockCode,
  stockName,
  size = 'default',
  variant = 'default',
  showLabel = false,
  initialIsFavorite = false,
  className,
  onToggle,
  onStateChange,
}: WatchlistToggleProps) {
  const store = useWatchlistStore()

  // 获取当前状态
  const item = store.getItem(stockCode)
  const itemStatus = store.getItemStatus(stockCode)
  const transaction = store.getItemTransaction(stockCode)

  const isFavorite = item?.isFavorite ?? initialIsFavorite
  const currentState = itemStatus.state
  const stateDescription = getStateDescription(currentState)

  // 本地状态用于动画
  const [localIsFavorite, setLocalIsFavorite] = useState(isFavorite)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false)
  const [showErrorIndicator, setShowErrorIndicator] = useState(false)

  // 同步本地状态与store状态
  useEffect(() => {
    setLocalIsFavorite(isFavorite)
  }, [isFavorite])

  // 监听状态变化
  useEffect(() => {
    onStateChange?.(currentState, stockCode)

    // 处理状态变化的视觉反馈
    switch (currentState) {
      case 'OPTIMISTIC_UPDATING':
        setIsAnimating(true)
        break
      case 'SUCCESS':
        setIsAnimating(false)
        setShowSuccessIndicator(true)
        setTimeout(() => setShowSuccessIndicator(false), 2000)
        break
      case 'ROLLBACK_ERROR':
        setIsAnimating(false)
        setShowErrorIndicator(true)
        setTimeout(() => setShowErrorIndicator(false), 3000)
        break
      default:
        setIsAnimating(false)
    }
  }, [currentState, stockCode, onStateChange])

  // 处理Toggle点击
  const handleToggle = useCallback(async () => {
    if (currentState === 'OPTIMISTIC_UPDATING' || currentState === 'SYNCING') {
      // 如果正在处理中，取消当前事务
      if (transaction) {
        store.cancelTransaction(transaction.id)
      }
      return
    }

    const targetState = isFavorite ? 'REMOVE' : 'ADD'

    // 触发触觉反馈
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]) // 两次短震动
    }

    // 乐观更新本地状态
    setLocalIsFavorite(!isFavorite)
    setIsAnimating(true)

    // 调用store方法（现在是异步的）
    const transactionIdPromise = targetState === 'ADD'
      ? store.addItemOptimistic(stockCode, stockName)
      : store.removeItemOptimistic(stockCode)

    // 通知父组件
    onToggle?.(!isFavorite, stockCode)

    // 返回Promise，调用者可以await
    return transactionIdPromise
  }, [isFavorite, stockCode, stockName, currentState, transaction, store, onToggle])

  // 重试失败的事务
  const handleRetry = useCallback(() => {
    if (transaction) {
      store.retryTransaction(transaction.id)
    }
  }, [transaction, store])

  // 获取当前显示的图标
  const renderIcon = useMemo(() => {
    const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20

    // 状态特定的图标
    if (currentState === 'SYNCING') {
      return <Loader2 className="h-full w-full animate-spin" style={{ height: iconSize, width: iconSize }} />
    }

    if (currentState === 'SUCCESS' && showSuccessIndicator) {
      return <Check className="h-full w-full" style={{ height: iconSize, width: iconSize }} />
    }

    if (currentState === 'ROLLBACK_ERROR' && showErrorIndicator) {
      return <AlertCircle className="h-full w-full" style={{ height: iconSize, width: iconSize }} />
    }

    // 默认图标（心形或星形）
    const IconComponent = variant === 'filled' ? Star : Heart

    return (
      <IconComponent
        className={cn(
          'h-full w-full transition-all duration-300',
          localIsFavorite ? 'fill-current' : 'fill-transparent',
          isAnimating && 'scale-125'
        )}
        style={{ height: iconSize, width: iconSize }}
      />
    )
  }, [currentState, showSuccessIndicator, showErrorIndicator, localIsFavorite, isAnimating, size, variant])

  // 获取按钮标签文本
  const buttonLabel = useMemo(() => {
    if (showLabel) {
      return localIsFavorite ? '已关注' : '关注'
    }
    return ''
  }, [showLabel, localIsFavorite])

  // 状态提示文本
  const stateHint = useMemo(() => {
    if (currentState === 'ROLLBACK_ERROR' && itemStatus.error) {
      return itemStatus.error
    }
    return stateDescription.message
  }, [currentState, itemStatus.error, stateDescription.message])

  return (
    <div className="relative inline-flex flex-col items-center">
      <motion.button
        type="button"
        onClick={handleToggle}
        disabled={currentState === 'OPTIMISTIC_UPDATING' || currentState === 'SYNCING'}
        className={cn(
          'group relative inline-flex items-center justify-center rounded-full transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          sizeClasses[size],
          variantClasses[variant],
          stateColors[currentState],
          isAnimating && 'scale-110',
          className
        )}
        whileTap={{ scale: 0.95 }}
        animate={{
          scale: isAnimating ? [1, 1.1, 1] : 1,
          rotate: isAnimating ? [0, 5, -5, 0] : 0,
        }}
        transition={{
          duration: 0.3,
          times: [0, 0.5, 1],
        }}
      >
        {/* 背景脉冲动画（用于成功/错误状态） */}
        <AnimatePresence>
          {(showSuccessIndicator || showErrorIndicator) && (
            <motion.div
              className={cn(
                'absolute inset-0 rounded-full',
                showSuccessIndicator ? 'bg-green-500/20' : 'bg-red-500/20'
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>

        {/* 主图标 */}
        <div className="relative z-10 flex items-center justify-center">
          {renderIcon}
        </div>

        {/* 点击波纹效果 */}
        <motion.span
          className="absolute inset-0 rounded-full bg-current opacity-0"
          initial={false}
          animate={{ opacity: isAnimating ? 0.2 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.button>

      {/* 标签文本 */}
      {showLabel && (
        <span className="mt-1 text-xs text-muted-foreground">
          {buttonLabel}
        </span>
      )}

      {/* 状态提示（悬停时显示） */}
      <div className="absolute -top-8 left-1/2 z-50 hidden -translate-x-1/2 transform group-hover:block">
        <div className="rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
          {stateHint}
          {currentState === 'ROLLBACK_ERROR' && transaction && (
            <button
              onClick={handleRetry}
              className="ml-1 text-blue-500 hover:underline"
            >
              重试
            </button>
          )}
        </div>
      </div>

      {/* 成功/错误指示器（短暂显示） */}
      <AnimatePresence>
        {showSuccessIndicator && (
          <motion.div
            className="absolute -top-10 left-1/2 z-40 -translate-x-1/2 transform"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              <span>操作成功</span>
            </div>
          </motion.div>
        )}

        {showErrorIndicator && (
          <motion.div
            className="absolute -top-10 left-1/2 z-40 -translate-x-1/2 transform"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-600">
              <X className="h-3 w-3" />
              <span>操作失败</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 简化的Toggle组件（用于列表项等空间有限的地方）
export function CompactWatchlistToggle({
  stockCode,
  stockName,
  className,
}: Omit<WatchlistToggleProps, 'size' | 'variant' | 'showLabel'>) {
  return (
    <WatchlistToggle
      stockCode={stockCode}
      stockName={stockName}
      size="sm"
      variant="ghost"
      showLabel={false}
      className={className}
    />
  )
}

// 带有文本标签的Toggle组件
export function LabeledWatchlistToggle({
  stockCode,
  stockName,
  className,
}: Omit<WatchlistToggleProps, 'size' | 'variant' | 'showLabel'>) {
  return (
    <div className="flex items-center gap-2">
      <WatchlistToggle
        stockCode={stockCode}
        stockName={stockName}
        size="default"
        variant="outline"
        showLabel={false}
        className={className}
      />
      <span className="text-sm text-muted-foreground">
        添加到自选股
      </span>
    </div>
  )
}