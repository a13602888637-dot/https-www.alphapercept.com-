import { NextRequest, NextResponse } from "next/server";
import { dataSourceSelector } from "../../../skills/data_source_selector";
import { dataSourceConfigManager } from "../../../skills/data_source_config";

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET: 获取数据源状态和配置
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    switch (action) {
      case 'stats':
        return await handleGetStats();
      case 'health':
        return await handleGetHealth();
      case 'config':
        return await handleGetConfig();
      case 'report':
        return await handleGetReport();
      default:
        return await handleGetOverview();
    }
  } catch (error) {
    console.error("Data sources API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST: 更新数据源配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'update-config':
        return await handleUpdateConfig(body);
      case 'enable-source':
        return await handleEnableSource(body);
      case 'disable-source':
        return await handleDisableSource(body);
      case 'health-check':
        return await handleHealthCheck(body);
      case 'reset-stats':
        return await handleResetStats(body);
      default:
        return NextResponse.json(
          {
            success: false,
            error: "Unknown action",
            validActions: ['update-config', 'enable-source', 'disable-source', 'health-check', 'reset-stats']
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Data sources API POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 处理获取概览
async function handleGetOverview() {
  const manager = dataSourceSelector.getManager();
  const configManager = dataSourceConfigManager;

  const configs = manager.getAllConfigs();
  const stats = manager.getDataSourceStats();
  const healthChecks = manager.getHealthCheckResults();
  const lastDecision = manager.getLastRoutingDecision();
  const configSummary = configManager.getConfigSummary();

  return NextResponse.json({
    success: true,
    data: {
      overview: {
        totalDataSources: configs.length,
        enabledDataSources: configs.filter(c => c.enabled).length,
        lastRoutingDecision: lastDecision,
        configSummary
      },
      dataSources: configs.map(config => {
        const stat = Array.isArray(stats)
          ? stats.find(s => s.type === config.type)
          : stats;
        const healthCheck = Array.isArray(healthChecks)
          ? healthChecks.find(h => h.source === config.type)
          : healthChecks;

        return {
          ...config,
          stats: stat,
          healthCheck
        };
      }),
      timestamp: new Date().toISOString()
    }
  });
}

// 处理获取统计信息
async function handleGetStats() {
  const manager = dataSourceSelector.getManager();
  const stats = manager.getDataSourceStats();

  return NextResponse.json({
    success: true,
    data: {
      stats: Array.isArray(stats) ? stats : [stats],
      timestamp: new Date().toISOString()
    }
  });
}

// 处理获取健康状态
async function handleGetHealth() {
  const manager = dataSourceSelector.getManager();
  const healthChecks = await manager.performBatchHealthCheck();

  return NextResponse.json({
    success: true,
    data: {
      healthChecks,
      timestamp: new Date().toISOString(),
      summary: {
        total: healthChecks.length,
        healthy: healthChecks.filter(h => h.isHealthy).length,
        unhealthy: healthChecks.filter(h => !h.isHealthy).length
      }
    }
  });
}

// 处理获取配置
async function handleGetConfig() {
  const config = dataSourceConfigManager.getConfig();

  return NextResponse.json({
    success: true,
    data: {
      config,
      timestamp: new Date().toISOString()
    }
  });
}

// 处理获取报告
async function handleGetReport() {
  const report = dataSourceSelector.getPerformanceReport();

  return NextResponse.json({
    success: true,
    data: {
      report,
      timestamp: new Date().toISOString()
    }
  });
}

// 处理更新配置
async function handleUpdateConfig(body: any) {
  const { sourceType, config } = body;

  if (!sourceType || !config) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing sourceType or config"
      },
      { status: 400 }
    );
  }

  const manager = dataSourceSelector.getManager();
  manager.updateConfig(sourceType, config);

  return NextResponse.json({
    success: true,
    message: `Configuration updated for ${sourceType}`,
    data: {
      sourceType,
      updatedConfig: config,
      timestamp: new Date().toISOString()
    }
  });
}

// 处理启用数据源
async function handleEnableSource(body: any) {
  const { sourceType } = body;

  if (!sourceType) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing sourceType"
      },
      { status: 400 }
    );
  }

  const manager = dataSourceSelector.getManager();
  manager.setDataSourceEnabled(sourceType, true);

  return NextResponse.json({
    success: true,
    message: `Data source ${sourceType} enabled`,
    data: {
      sourceType,
      enabled: true,
      timestamp: new Date().toISOString()
    }
  });
}

// 处理禁用数据源
async function handleDisableSource(body: any) {
  const { sourceType } = body;

  if (!sourceType) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing sourceType"
      },
      { status: 400 }
    );
  }

  const manager = dataSourceSelector.getManager();
  manager.setDataSourceEnabled(sourceType, false);

  return NextResponse.json({
    success: true,
    message: `Data source ${sourceType} disabled`,
    data: {
      sourceType,
      enabled: false,
      timestamp: new Date().toISOString()
    }
  });
}

// 处理健康检查
async function handleHealthCheck(body: any) {
  const { sourceType } = body;

  const manager = dataSourceSelector.getManager();

  if (sourceType) {
    const result = await manager.performHealthCheck(sourceType);
    return NextResponse.json({
      success: true,
      data: {
        healthCheck: result,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    const results = await manager.performBatchHealthCheck();
    return NextResponse.json({
      success: true,
      data: {
        healthChecks: results,
        timestamp: new Date().toISOString(),
        summary: {
          total: results.length,
          healthy: results.filter(h => h.isHealthy).length,
          unhealthy: results.filter(h => !h.isHealthy).length
        }
      }
    });
  }
}

// 处理重置统计
async function handleResetStats(body: any) {
  const { sourceType } = body;

  const manager = dataSourceSelector.getManager();

  if (sourceType) {
    manager.resetStats(sourceType);
    return NextResponse.json({
      success: true,
      message: `Statistics reset for ${sourceType}`,
      data: {
        sourceType,
        reset: true,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    manager.resetStats();
    return NextResponse.json({
      success: true,
      message: "All statistics reset",
      data: {
        reset: true,
        timestamp: new Date().toISOString()
      }
    });
  }
}