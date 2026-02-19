import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum LogPhase {
  START = 'START',
  RUNNING = 'RUNNING',
  BUILD = 'BUILD',
  PR = 'PR',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  phase: LogPhase;
  taskId: string;
  message: string;
  elapsedMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface StructuredLoggerConfig {
  logFile: string;
  consoleEnabled: boolean;
  fileEnabled: boolean;
  minLevel: LogLevel;
  bufferSize: number;
  flushIntervalMs: number;
}

export interface PhaseTimer {
  phase: LogPhase;
  startTime: Date;
}

const DEFAULT_CONFIG: StructuredLoggerConfig = {
  logFile: path.join(process.cwd(), 'kai-delegator.log'),
  consoleEnabled: true,
  fileEnabled: true,
  minLevel: LogLevel.INFO,
  bufferSize: 10,
  flushIntervalMs: 5000,
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: COLORS.cyan,
  [LogLevel.INFO]: COLORS.green,
  [LogLevel.WARN]: COLORS.yellow,
  [LogLevel.ERROR]: COLORS.red,
};

const PHASE_COLORS: Record<LogPhase, string> = {
  [LogPhase.START]: COLORS.blue,
  [LogPhase.RUNNING]: COLORS.magenta,
  [LogPhase.BUILD]: COLORS.cyan,
  [LogPhase.PR]: COLORS.green,
  [LogPhase.COMPLETED]: COLORS.green,
  [LogPhase.FAILED]: COLORS.red,
};

export class StructuredLogger {
  private config: StructuredLoggerConfig;
  private logBuffer: string[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private phaseTimers: Map<string, PhaseTimer> = new Map();

  constructor(config: Partial<StructuredLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    process.on('exit', () => this.flush());
    process.on('SIGTERM', () => {
      this.flush();
      process.exit(0);
    });
    process.on('SIGINT', () => {
      this.flush();
      process.exit(0);
    });
  }

  configure(config: Partial<StructuredLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.minLevel];
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  startPhase(taskId: string, phase: LogPhase): void {
    this.phaseTimers.set(`${taskId}:${phase}`, {
      phase,
      startTime: new Date(),
    });
  }

  endPhase(taskId: string, phase: LogPhase): number | undefined {
    const key = `${taskId}:${phase}`;
    const timer = this.phaseTimers.get(key);
    if (!timer) {
      return undefined;
    }
    this.phaseTimers.delete(key);
    return Date.now() - timer.startTime.getTime();
  }

  private formatConsole(entry: StructuredLogEntry): string {
    const levelColor = LEVEL_COLORS[entry.level];
    const phaseColor = PHASE_COLORS[entry.phase];
    
    const elapsed = entry.elapsedMs !== undefined 
      ? ` (${entry.elapsedMs}ms)` 
      : '';
    
    const error = entry.error 
      ? ` | Error: ${entry.error.message}` 
      : '';
    
    const metadata = entry.metadata 
      ? ` | ${JSON.stringify(entry.metadata)}` 
      : '';

    return `${levelColor}[${entry.level}]${COLORS.reset} ` +
           `${phaseColor}[${entry.phase}]${COLORS.reset} ` +
           `[${entry.taskId}] ` +
           `${entry.message}${elapsed}${error}${metadata}`;
  }

  private formatFile(entry: StructuredLogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private flushBuffer(): void {
    if (this.logBuffer.length === 0) return;

    try {
      fs.appendFileSync(this.config.logFile, this.logBuffer.join(''));
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write logs to file:', 
        error instanceof Error ? error.message : 'Unknown error');
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  private scheduleFlush(): void {
    if (!this.config.fileEnabled) return;

    if (this.logBuffer.length >= this.config.bufferSize) {
      this.flushBuffer();
      return;
    }

    if (this.flushTimeout) return;

    this.flushTimeout = setTimeout(() => {
      this.flushBuffer();
    }, this.config.flushIntervalMs);
  }

  log(
    level: LogLevel,
    phase: LogPhase,
    taskId: string,
    message: string,
    metadata?: Record<string, unknown>,
    elapsedMs?: number
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: StructuredLogEntry = {
      timestamp: this.getTimestamp(),
      level,
      phase,
      taskId,
      message,
      ...(elapsedMs !== undefined && { elapsedMs }),
      ...(metadata && { metadata }),
    };

    if (this.config.consoleEnabled) {
      console.log(this.formatConsole(entry));
    }

    if (this.config.fileEnabled) {
      this.logBuffer.push(this.formatFile(entry));
      this.scheduleFlush();
    }
  }

  logError(
    level: LogLevel,
    phase: LogPhase,
    taskId: string,
    message: string,
    error: Error,
    metadata?: Record<string, unknown>,
    elapsedMs?: number
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: StructuredLogEntry = {
      timestamp: this.getTimestamp(),
      level,
      phase,
      taskId,
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...(elapsedMs !== undefined && { elapsedMs }),
      ...(metadata && { metadata }),
    };

    if (this.config.consoleEnabled) {
      console.log(this.formatConsole(entry));
    }

    if (this.config.fileEnabled) {
      this.logBuffer.push(this.formatFile(entry));
      this.scheduleFlush();
    }
  }

  logPhase(
    level: LogLevel,
    phase: LogPhase,
    taskId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const elapsedMs = this.endPhase(taskId, phase);
    this.log(level, phase, taskId, message, metadata, elapsedMs);
  }

  logPhaseError(
    level: LogLevel,
    phase: LogPhase,
    taskId: string,
    message: string,
    error: Error,
    metadata?: Record<string, unknown>
  ): void {
    const elapsedMs = this.endPhase(taskId, phase);
    this.logError(level, phase, taskId, message, error, metadata, elapsedMs);
  }

  debug(phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.startPhase(taskId, phase);
    this.log(LogLevel.DEBUG, phase, taskId, message, metadata);
  }

  info(phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.startPhase(taskId, phase);
    this.log(LogLevel.INFO, phase, taskId, message, metadata);
  }

  warn(phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.startPhase(taskId, phase);
    this.log(LogLevel.WARN, phase, taskId, message, metadata);
  }

  error(phase: LogPhase, taskId: string, message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.startPhase(taskId, phase);
    if (error) {
      this.logError(LogLevel.ERROR, phase, taskId, message, error, metadata);
    } else {
      this.log(LogLevel.ERROR, phase, taskId, message, metadata);
    }
  }

  start(taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.info(LogPhase.START, taskId, message, metadata);
  }

  running(taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.info(LogPhase.RUNNING, taskId, message, metadata);
  }

  build(taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.info(LogPhase.BUILD, taskId, message, metadata);
  }

  pr(taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.info(LogPhase.PR, taskId, message, metadata);
  }

  completed(taskId: string, message: string, metadata?: Record<string, unknown>): void {
    this.logPhase(LogLevel.INFO, LogPhase.COMPLETED, taskId, message, metadata);
  }

  failed(taskId: string, message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (error) {
      this.logPhaseError(LogLevel.ERROR, LogPhase.FAILED, taskId, message, error, metadata);
    } else {
      this.logPhase(LogLevel.ERROR, LogPhase.FAILED, taskId, message, metadata);
    }
  }

  flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.flushBuffer();
  }

  getStats(): { bufferSize: number; minLevel: LogLevel; logFile: string } {
    return {
      bufferSize: this.logBuffer.length,
      minLevel: this.config.minLevel,
      logFile: this.config.logFile,
    };
  }

  getBuffer(): StructuredLogEntry[] {
    return this.logBuffer.map(line => {
      try {
        return JSON.parse(line) as StructuredLogEntry;
      } catch {
        return null;
      }
    }).filter((entry): entry is StructuredLogEntry => entry !== null);
  }

  getConfig(): StructuredLoggerConfig {
    return { ...this.config };
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }
}

let defaultLogger: StructuredLogger | null = null;

export function createStructuredLogger(config?: Partial<StructuredLoggerConfig>): StructuredLogger {
  return new StructuredLogger(config);
}

export function getStructuredLogger(config?: Partial<StructuredLoggerConfig>): StructuredLogger {
  if (!defaultLogger) {
    defaultLogger = new StructuredLogger(config);
  }
  return defaultLogger;
}

export function resetStructuredLogger(): void {
  if (defaultLogger) {
    defaultLogger.flush();
    defaultLogger = null;
  }
}
