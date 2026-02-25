"use client"

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PulseAnimationProps {
  isActive: boolean
  intensity?: 'low' | 'medium' | 'high'
  className?: string
  children?: React.ReactNode
}

export function PulseAnimation({
  isActive,
  intensity = 'medium',
  className,
  children
}: PulseAnimationProps) {
  const getPulseConfig = () => {
    switch (intensity) {
      case 'low':
        return {
          scale: 1.02,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          transition: { duration: 0.3, ease: 'ease-out' as const }
        }
      case 'medium':
        return {
          scale: 1.05,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          transition: { duration: 0.4, ease: 'ease-out' as const }
        }
      case 'high':
        return {
          scale: 1.1,
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          transition: { duration: 0.5, ease: 'ease-out' as const }
        }
      default:
        return {
          scale: 1.05,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          transition: { duration: 0.4, ease: 'ease-out' as const }
        }
    }
  }

  const pulseConfig = getPulseConfig()

  return (
    <motion.div
      className={cn('relative', className)}
      animate={isActive ? {
        scale: pulseConfig.scale,
        backgroundColor: pulseConfig.backgroundColor,
      } : {
        scale: 1,
        backgroundColor: 'transparent',
      }}
      transition={pulseConfig.transition}
      onAnimationComplete={() => {
        // 动画完成后重置状态
      }}
    >
      {children}
    </motion.div>
  )
}

// 涨跌幅变化动画组件
interface ChangeAnimationProps {
  change: string
  previousChange?: string
  className?: string
}

export function ChangeAnimation({ change, previousChange, className }: ChangeAnimationProps) {
  const isPositive = change.startsWith('+')
  const isNegative = change.startsWith('-')

  // 检查是否有显著变化
  const hasSignificantChange = previousChange &&
    Math.abs(parseFloat(change) - parseFloat(previousChange)) > 1

  return (
    <motion.div
      className={cn(
        'inline-flex items-center justify-center',
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600',
        className
      )}
      key={change} // 使用change作为key来触发重新渲染时的动画
      initial={{ scale: 0.8, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {hasSignificantChange && (
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(59, 130, 246, 0)',
              '0 0 0 4px rgba(59, 130, 246, 0.3)',
              '0 0 0 0 rgba(59, 130, 246, 0)',
            ]
          }}
          transition={{ duration: 1, repeat: 1 }}
        />
      )}
      {change}
    </motion.div>
  )
}