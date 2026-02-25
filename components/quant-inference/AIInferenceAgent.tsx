/**
 * AI推理代理组件
 * 量化推演显化代理的核心组件
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Brain, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, Info, Shield, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { useAIInference, useSingleInference } from '@/hooks/useAIInference';
import { RiskAlertRing, SimpleAlertRing, MiniAlertRing } from './RiskAlertRing';
import {
  AIInferenceRequest,
  AIInferenceResponse,
  StockMarketData
} from '@/lib/ai/inference-types';
import { parseAIResponse } from '@/lib/ai/risk-parser';

interface AIInferenceAgentProps {
  // 股票数据
  stockData: StockMarketData;
  symbol: string;
  name: string;

  // 配置选项
  autoTrigger?: boolean;
  showDetails?: boolean;
  compactMode?: boolean;
  refreshInterval?: number; // 毫秒

  // 回调函数
  onInferenceComplete?: (response: AIInferenceResponse) => void;
  onError?: (error: any) => void;
  onStatusChange?: (status: 'idle' | 'loading' | 'success' | 'error') => void;

  // 上下文信息
  context?: AIInferenceRequest['context'];
  options?: AIInferenceRequest['options'];

  // 样式
  className?: string;
}

export function AIInferenceAgent({
  stockData,
  symbol,
  name,
  autoTrigger = true,
  showDetails = true,
  compactMode = false,
  refreshInterval,
  onInferenceComplete,
  onError,
  onStatusChange,
  context,
  options,
  className
}: AIInferenceAgentProps) {
  // 使用AI推理Hook
  const { infer, state, reset } = useAIInference();
  const { status, data, error, progress } = state;

  // 本地状态
  const [lastInferenceTime, setLastInferenceTime] = useState<string>('');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [parsedResult, setParsedResult] = useState<ReturnType<typeof parseAIResponse> | null>(null);

  // 触发状态变化回调
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // 自动触发推理
  useEffect(() => {
    if (autoTrigger && stockData && status === 'idle') {
      triggerInference();
    }
  }, [autoTrigger, stockData]);

  // 定时刷新
  useEffect(() => {
    if (!refreshInterval || !autoTrigger) return;

    const intervalId = setInterval(() => {
      if (status !== 'loading') {
        triggerInference();
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, autoTrigger, status]);

  // 解析推理结果
  useEffect(() => {
    if (data) {
      try {
        const result = parseAIResponse(data);
        setParsedResult(result);
        onInferenceComplete?.(data);
      } catch (error) {
        console.error('解析推理结果失败:', error);
      }
    }
  }, [data, onInferenceComplete]);

  // 触发推理
  const triggerInference = useCallback(async () => {
    try {
      const request: AIInferenceRequest = {
        stockData,
        context,
        options
      };

      await infer(request);
      setLastInferenceTime(new Date().toISOString());
    } catch (error) {
      console.error('触发推理失败:', error);
      onError?.(error);
    }
  }, [stockData, context, options, infer, onError]);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    if (status !== 'loading') {
      reset();
      triggerInference();
    }
  }, [status, reset, triggerInference]);

  // 获取交易决策图标
  const getDecisionIcon = () => {
    if (!data?.trading_decision) return <Minus className="h-4 w-4" />;

    switch (data.trading_decision.action) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'SELL':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  // 获取决策颜色
  const getDecisionColor = () => {
    if (!data?.trading_decision) return 'gray';

    switch (data.trading_decision.action) {
      case 'BUY':
        return 'green';
      case 'SELL':
        return 'red';
      default:
        return 'gray';
    }
  };

  // 渲染加载状态
  const renderLoadingState = () => (
    <Card className={cn('border-blue-200 bg-blue-50/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500 animate-pulse" />
            <CardTitle className="text-lg">AI量化推演中...</CardTitle>
          </div>
          <Badge variant="outline" className="animate-pulse">
            分析中
          </Badge>
        </div>
        <CardDescription>
          正在分析 {name} ({symbol}) 的市场数据
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>推理进度</span>
              <span>{progress || 0}%</span>
            </div>
            <Progress value={progress || 0} className="h-2" />
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>读取策略规则...</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>分析市场数据...</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>执行反人性破解器检查...</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // 渲染错误状态
  const renderErrorState = () => (
    <Card className={cn('border-red-200 bg-red-50/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-lg">推理失败</CardTitle>
          </div>
          <Badge variant="destructive">错误</Badge>
        </div>
        <CardDescription>
          AI推理代理遇到问题
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-red-100 border border-red-200 rounded-md">
            <p className="text-sm font-medium text-red-800 mb-1">错误信息</p>
            <p className="text-sm text-red-700">{error?.message || '未知错误'}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重试推理
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // 渲染成功状态
  const renderSuccessState = () => {
    if (!data || !parsedResult) return null;

    const {
      riskLevel,
      marketStatus,
      isCritical,
      alertConfig,
      conclusion,
      criticalKeywords
    } = parsedResult;

    const tradingDecision = data.trading_decision;
    const keyMetrics = data.key_metrics;
    const logicChain = data.logic_chain;

    // 紧凑模式
    if (compactMode) {
      return (
        <div className={cn('space-y-3', className)}>
          {/* 警报环 */}
          <RiskAlertRing
            config={alertConfig}
            showCloseButton={false}
          />

          {/* 关键指标 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded-md">
              <div className="text-xs text-muted-foreground">陷阱概率</div>
              <div className={cn(
                'text-lg font-bold',
                keyMetrics.trap_probability >= 80 && 'text-red-600',
                keyMetrics.trap_probability >= 60 && 'text-orange-600',
                'text-green-600'
              )}>
                {keyMetrics.trap_probability}%
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-md">
              <div className="text-xs text-muted-foreground">决策</div>
              <div className={cn(
                'text-lg font-bold flex items-center justify-center gap-1',
                tradingDecision.action === 'BUY' && 'text-green-600',
                tradingDecision.action === 'SELL' && 'text-red-600',
                'text-gray-600'
              )}>
                {getDecisionIcon()}
                {tradingDecision.action}
              </div>
            </div>
          </div>

          {/* 一句话结论 */}
          <div className="text-sm p-2 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>{conclusion}</span>
            </div>
          </div>
        </div>
      );
    }

    // 完整模式
    return (
      <Card className={cn('border-blue-200', isCritical && 'border-red-300 bg-red-50/20', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <div>
                <CardTitle className="text-lg">AI量化推演结果</CardTitle>
                <CardDescription>
                  {name} ({symbol}) • {lastInferenceTime ? new Date(lastInferenceTime).toLocaleTimeString() : '刚刚'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={status === 'loading'}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 警报环 */}
          <RiskAlertRing
            config={alertConfig}
            showCloseButton={false}
            showDetails={showAdvancedDetails}
            onToggleDetails={() => setShowAdvancedDetails(!showAdvancedDetails)}
          />

          {/* 关键指标卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">风险等级</div>
              <div className={cn(
                'text-lg font-bold',
                riskLevel === 'critical' && 'text-red-600',
                riskLevel === 'high' && 'text-orange-600',
                riskLevel === 'medium' && 'text-yellow-600',
                'text-green-600'
              )}>
                {riskLevel === 'critical' ? '极高风险' :
                 riskLevel === 'high' ? '高风险' :
                 riskLevel === 'medium' ? '中等风险' : '低风险'}
              </div>
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">陷阱概率</div>
              <div className={cn(
                'text-lg font-bold',
                keyMetrics.trap_probability >= 80 && 'text-red-600',
                keyMetrics.trap_probability >= 60 && 'text-orange-600',
                'text-green-600'
              )}>
                {keyMetrics.trap_probability}%
              </div>
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">交易决策</div>
              <div className={cn(
                'text-lg font-bold flex items-center justify-center gap-1',
                tradingDecision.action === 'BUY' && 'text-green-600',
                tradingDecision.action === 'SELL' && 'text-red-600',
                'text-gray-600'
              )}>
                {getDecisionIcon()}
                {tradingDecision.action}
              </div>
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">置信度</div>
              <div className={cn(
                'text-lg font-bold',
                tradingDecision.confidence >= 80 && 'text-green-600',
                tradingDecision.confidence >= 60 && 'text-blue-600',
                'text-gray-600'
              )}>
                {tradingDecision.confidence}%
              </div>
            </div>
          </div>

          {/* 一句话结论 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-800 mb-1">AI推演结论</p>
                <p className="text-sm text-blue-700">{conclusion}</p>
              </div>
            </div>
          </div>

          {/* 高级详情 */}
          {showAdvancedDetails && showDetails && (
            <div className="space-y-4 pt-4 border-t">
              <Tabs defaultValue="logic" className="w-full">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="logic">逻辑链</TabsTrigger>
                  <TabsTrigger value="patterns">模式识别</TabsTrigger>
                  <TabsTrigger value="metrics">详细指标</TabsTrigger>
                </TabsList>

                <TabsContent value="logic" className="space-y-3">
                  {Object.entries(logicChain).map(([key, value]) => (
                    <div key={key} className="p-3 bg-gray-50 rounded-md">
                      <div className="text-sm font-medium text-gray-800 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-700">{value}</div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="patterns" className="space-y-3">
                  {data.anti_humanity_patterns && Object.values(data.anti_humanity_patterns).map((pattern, index) => (
                    pattern && (
                      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-red-500" />
                          <div className="font-medium text-red-800">{pattern.type}</div>
                          <Badge variant="destructive">置信度: {pattern.confidence}%</Badge>
                        </div>
                        <div className="text-sm text-red-700 mb-2">{pattern.description}</div>
                        <div className="text-xs text-red-600">
                          <div className="font-medium mb-1">触发条件:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {pattern.trigger_conditions?.map((condition, i) => (
                              <li key={i}>{condition}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-2 text-sm font-medium text-red-800">
                          建议操作: {pattern.recommended_action}
                        </div>
                      </div>
                    )
                  ))}
                </TabsContent>

                <TabsContent value="metrics" className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-md">
                      <div className="text-sm font-medium text-gray-800 mb-1">估值安全边际</div>
                      <div className="text-lg font-bold text-green-600">
                        {keyMetrics.valuation_safety_margin}%
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <div className="text-sm font-medium text-gray-800 mb-1">情绪得分</div>
                      <div className="text-lg font-bold text-blue-600">
                        {keyMetrics.sentiment_score}%
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <div className="text-sm font-medium text-gray-800 mb-1">趋势强度</div>
                      <div className="text-lg font-bold text-purple-600">
                        {keyMetrics.trend_strength}%
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <div className="text-sm font-medium text-gray-800 mb-1">市场状态</div>
                      <div className={cn(
                        'text-lg font-bold',
                        marketStatus === 'critical' && 'text-red-600',
                        marketStatus === 'danger' && 'text-orange-600',
                        marketStatus === 'warning' && 'text-yellow-600',
                        'text-green-600'
                      )}>
                        {marketStatus === 'critical' ? '极度危险' :
                         marketStatus === 'danger' ? '危险' :
                         marketStatus === 'warning' ? '警告' : '正常'}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* 高危关键词 */}
          {criticalKeywords.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div className="font-medium text-red-800">检测到高危关键词</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {criticalKeywords.map((keyword, index) => (
                  <Badge key={index} variant="destructive" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // 根据状态渲染
  switch (status) {
    case 'loading':
      return renderLoadingState();
    case 'error':
      return renderErrorState();
    case 'success':
      return renderSuccessState();
    default:
      return (
        <Card className={cn('border-gray-200', className)}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-gray-500" />
                <CardTitle className="text-lg">AI量化推演代理</CardTitle>
              </div>
              <Badge variant="outline">就绪</Badge>
            </div>
            <CardDescription>
              点击按钮开始分析 {name} ({symbol})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={triggerInference}
              className="w-full"
              size="lg"
            >
              <Brain className="h-5 w-5 mr-2" />
              开始AI量化推演
            </Button>
          </CardContent>
        </Card>
      );
  }
}

// 简化版本：仅显示警报环和关键指标
export function SimpleAIInferenceAgent({
  stockData,
  symbol,
  name,
  ...props
}: AIInferenceAgentProps) {
  return (
    <AIInferenceAgent
      stockData={stockData}
      symbol={symbol}
      name={name}
      compactMode={true}
      showDetails={false}
      {...props}
    />
  );
}

// 迷你版本：仅显示警报环
export function MiniAIInferenceAgent({
  stockData,
  symbol,
  name,
  onInferenceComplete,
  ...props
}: AIInferenceAgentProps) {
  const { state } = useAIInference();
  const { data } = state;

  // 监听推理完成
  useEffect(() => {
    if (data && onInferenceComplete) {
      onInferenceComplete(data);
    }
  }, [data, onInferenceComplete]);

  return (
    <div className="inline-block">
      <AIInferenceAgent
        stockData={stockData}
        symbol={symbol}
        name={name}
        compactMode={true}
        showDetails={false}
        autoTrigger={true}
        {...props}
      />
    </div>
  );
}