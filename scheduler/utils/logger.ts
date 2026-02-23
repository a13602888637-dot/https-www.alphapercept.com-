/**
 * Alpha-Quant-Copilot 调度器日志系统
 * 支持多级别日志、文件轮转、结构化日志
 */

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志级别数值映射
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// 日志条目接口
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  module?: string;
  taskId?: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

// 日志配置
export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  consoleOutput: boolean;
  fileOutput: boolean;
  maxLogFiles: number;
  maxLogSizeMB: number;
  logDirectory: string;
}

// 默认配置
const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  level: 'info',
  consoleOutput: true,
  fileOutput: true,
  maxLogFiles: 30,
  maxLogSizeMB: 10,
  logDirectory: path.join(process.cwd(), 'scheduler', 'logs')
};

/**
 * 高级日志记录器
 */
export class Logger {
  private config: LoggerConfig;
  private currentLogFile: string | null = null;
  private currentFileSize: number = 0;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDirectory();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  /**
   * 获取当前日志文件路径
   */
  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.config.logDirectory, `scheduler-${date}.log`);
  }

  /**
   * 检查是否需要轮转日志文件
   */
  private checkLogRotation(): void {
    if (!this.config.fileOutput) return;

    const logFile = this.getCurrentLogFile();

    // 如果日期变化或文件大小超过限制，创建新文件
    if (logFile !== this.currentLogFile) {
      this.currentLogFile = logFile;
      this.currentFileSize = 0;
    }

    // 检查文件大小
    if (this.currentFileSize > this.config.maxLogSizeMB * 1024 * 1024) {
      this.rotateLogFile();
    }
  }

  /**
   * 轮转日志文件
   */
  private rotateLogFile(): void {
    if (!this.currentLogFile) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);

    if (fs.existsSync(this.currentLogFile)) {
      fs.renameSync(this.currentLogFile, rotatedFile);
    }

    this.currentLogFile = this.getCurrentLogFile();
    this.currentFileSize = 0;

    this.cleanupOldLogs();
  }

  /**
   * 清理旧日志文件
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith('scheduler-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
          mtime: fs.statSync(path.join(this.config.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 删除超出数量限制的文件
      if (files.length > this.config.maxLogFiles) {
        const filesToDelete = files.slice(this.config.maxLogFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          this.debug('删除旧日志文件', { data: { file: file.name } });
        }
      }
    } catch (error) {
      // 清理失败不影响主要功能
      console.error('清理旧日志文件失败:', error);
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const module = entry.module ? `[${entry.module}]` : '';
    const taskId = entry.taskId ? `[${entry.taskId}]` : '';
    const message = entry.message;

    // 基础格式
    let logLine = `${timestamp} ${level} ${module}${taskId} ${message}`;

    // 添加额外数据
    if (entry.data) {
      try {
        const dataStr = util.inspect(entry.data, {
          depth: 2,
          colors: false,
          compact: true,
          breakLength: Infinity
        });
        logLine += ` ${dataStr}`;
      } catch (error: any) {
        logLine += ` [无法序列化数据: ${error.message}]`;
      }
    }

    // 添加错误信息
    if (entry.error) {
      logLine += `\n错误: ${entry.error.message}`;
      if (entry.error.stack) {
        logLine += `\n堆栈: ${entry.error.stack}`;
      }
      if (entry.error.code) {
        logLine += `\n代码: ${entry.error.code}`;
      }
    }

    return logLine + '\n';
  }

  /**
   * 写入日志文件
   */
  private writeToFile(logLine: string): void {
    if (!this.config.fileOutput || !this.config.enabled) return;

    try {
      this.checkLogRotation();

      if (!this.currentLogFile) {
        this.currentLogFile = this.getCurrentLogFile();
      }

      fs.appendFileSync(this.currentLogFile, logLine, 'utf-8');
      this.currentFileSize += Buffer.byteLength(logLine, 'utf-8');
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  /**
   * 输出到控制台
   */
  private writeToConsole(logLine: string, level: LogLevel): void {
    if (!this.config.consoleOutput || !this.config.enabled) return;

    const colors = {
      debug: '\x1b[36m', // 青色
      info: '\x1b[32m',  // 绿色
      warn: '\x1b[33m',  // 黄色
      error: '\x1b[31m'  // 红色
    };

    const reset = '\x1b[0m';
    const coloredLine = `${colors[level]}${logLine.trim()}${reset}`;
    console.log(coloredLine);
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, metadata?: {
    module?: string;
    taskId?: string;
    data?: any;
    error?: Error;
  }): void {
    // 检查日志级别
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      module: metadata?.module,
      taskId: metadata?.taskId,
      data: metadata?.data
    };

    // 处理错误对象
    if (metadata?.error) {
      entry.error = {
        message: metadata.error.message,
        stack: metadata.error.stack,
        code: (metadata.error as any).code
      };
    }

    // 格式化日志行
    const logLine = this.formatLogEntry(entry);

    // 输出到不同目标
    this.writeToConsole(logLine, level);
    this.writeToFile(logLine);
  }

  /**
   * 调试日志
   */
  debug(message: string, metadata?: { module?: string; taskId?: string; data?: any }): void {
    this.log('debug', message, metadata);
  }

  /**
   * 信息日志
   */
  info(message: string, metadata?: { module?: string; taskId?: string; data?: any }): void {
    this.log('info', message, metadata);
  }

  /**
   * 警告日志
   */
  warn(message: string, metadata?: { module?: string; taskId?: string; data?: any; error?: Error }): void {
    this.log('warn', message, metadata);
  }

  /**
   * 错误日志
   */
  error(message: string, metadata?: { module?: string; taskId?: string; data?: any; error?: Error }): void {
    this.log('error', message, metadata);
  }

  /**
   * 创建子日志器（用于特定模块）
   */
  createModuleLogger(moduleName: string): ModuleLogger {
    return new ModuleLogger(this, moduleName);
  }

  /**
   * 获取日志文件列表
   */
  getLogFiles(): Array<{ name: string; size: number; mtime: Date }> {
    try {
      return fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith('scheduler-') && file.endsWith('.log'))
        .map(file => {
          const filePath = path.join(this.config.logDirectory, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            mtime: stats.mtime
          };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    } catch (error) {
      return [];
    }
  }

  /**
   * 读取日志文件内容
   */
  readLogFile(filename: string, lines?: number): string[] {
    try {
      const filePath = path.join(this.config.logDirectory, filename);
      if (!fs.existsSync(filePath)) {
        return [`日志文件不存在: ${filename}`];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const logLines = content.split('\n').filter(line => line.trim());

      if (lines && lines > 0) {
        return logLines.slice(-lines);
      }

      return logLines;
    } catch (error: any) {
      return [`读取日志文件失败: ${error.message}`];
    }
  }

  /**
   * 获取系统状态日志
   */
  getSystemStatus(): {
    enabled: boolean;
    level: LogLevel;
    logDirectory: string;
    currentLogFile: string | null;
    fileSizeMB: number;
    totalLogFiles: number;
  } {
    const logFiles = this.getLogFiles();
    const currentFileSizeMB = this.currentFileSize / (1024 * 1024);

    return {
      enabled: this.config.enabled,
      level: this.config.level,
      logDirectory: this.config.logDirectory,
      currentLogFile: this.currentLogFile,
      fileSizeMB: parseFloat(currentFileSizeMB.toFixed(2)),
      totalLogFiles: logFiles.length
    };
  }
}

/**
 * 模块专用日志器
 */
export class ModuleLogger {
  private parent: Logger;
  private moduleName: string;

  constructor(parent: Logger, moduleName: string) {
    this.parent = parent;
    this.moduleName = moduleName;
  }

  debug(message: string, metadata?: { taskId?: string; data?: any }): void {
    this.parent.debug(message, { ...metadata, module: this.moduleName });
  }

  info(message: string, metadata?: { taskId?: string; data?: any }): void {
    this.parent.info(message, { ...metadata, module: this.moduleName });
  }

  warn(message: string, metadata?: { taskId?: string; data?: any; error?: Error }): void {
    this.parent.warn(message, { ...metadata, module: this.moduleName });
  }

  error(message: string, metadata?: { taskId?: string; data?: any; error?: Error }): void {
    this.parent.error(message, { ...metadata, module: this.moduleName });
  }
}

/**
 * 全局日志器实例
 */
let globalLogger: Logger | null = null;

/**
 * 获取全局日志器
 */
export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

/**
 * 初始化日志系统
 */
export function initLogger(config?: Partial<LoggerConfig>): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}