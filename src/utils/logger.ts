import winston from 'winston';
import { configManager } from '../config/index.js';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
  }
};

// Create winston logger instance
const createLogger = () => {
  const logLevel = configManager.get('logLevel');
  
  const formats = [
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ];

  // Add colorization for console output
  const consoleFormats = [
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      
      if (stack) {
        log += `\n${stack}`;
      }
      
      return log;
    })
  ];

  return winston.createLogger({
    levels: customLevels.levels,
    level: logLevel,
    format: winston.format.combine(...formats),
    defaultMeta: { service: 'context-engine-mcp' },
    transports: [
      // Console transport with colorization - IMPORTANT: Use stderr for STDIO MCP servers
      new winston.transports.Console({
        format: winston.format.combine(...consoleFormats),
        handleExceptions: true,
        handleRejections: true,
        stderrLevels: ['error', 'warn', 'info', 'debug'] // Force all logs to stderr, not stdout
      }),
      
      // File transport for errors
      new winston.transports.File({
        filename: 'context-engine-error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
      }),
      
      // File transport for all logs
      new winston.transports.File({
        filename: 'context-engine-combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 3,
        tailable: true
      })
    ],
    exitOnError: false
  });
};

winston.addColors(customLevels.colors);

const logger = createLogger();

// Performance logging helper
export class PerformanceLogger {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = performance.now();
    logger.debug(`Started operation: ${operation}`);
  }

  end(additionalInfo?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime;
    logger.info(`Completed operation: ${this.operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      ...additionalInfo
    });
    return duration;
  }

  checkpoint(checkpoint: string): number {
    const duration = performance.now() - this.startTime;
    logger.debug(`Checkpoint ${checkpoint} in ${this.operation}`, {
      duration: `${duration.toFixed(2)}ms`
    });
    return duration;
  }
}

// Memory usage logging helper
export function logMemoryUsage(operation: string): void {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    logger.debug(`Memory usage after ${operation}`, {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    });
  }
}

// Error logging with context
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error(error.message, {
    name: error.name,
    stack: error.stack,
    ...context
  });
}

// Safe logging that won't throw
export function safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  try {
    logger[level](message, meta);
  } catch (loggingError) {
    // Fallback to console if logger fails
    console.error('Logging failed:', loggingError);
    console[level === 'debug' ? 'log' : level](message, meta);
  }
}

// Create child logger with additional context
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

// Update logger configuration dynamically
export function updateLoggerConfig(): void {
  const newLogLevel = configManager.get('logLevel');
  logger.level = newLogLevel;
  logger.info('Logger configuration updated', { newLogLevel });
}

export default logger;
