export declare enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
}
export declare enum LogPhase {
    START = "START",
    RUNNING = "RUNNING",
    BUILD = "BUILD",
    PR = "PR",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
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
export declare class StructuredLogger {
    private config;
    private logBuffer;
    private flushTimeout;
    private phaseTimers;
    constructor(config?: Partial<StructuredLoggerConfig>);
    private setupShutdownHandlers;
    configure(config: Partial<StructuredLoggerConfig>): void;
    setMinLevel(level: LogLevel): void;
    private shouldLog;
    private getTimestamp;
    startPhase(taskId: string, phase: LogPhase): void;
    endPhase(taskId: string, phase: LogPhase): number | undefined;
    private formatConsole;
    private formatFile;
    private flushBuffer;
    private scheduleFlush;
    log(level: LogLevel, phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>, elapsedMs?: number): void;
    logError(level: LogLevel, phase: LogPhase, taskId: string, message: string, error: Error, metadata?: Record<string, unknown>, elapsedMs?: number): void;
    logPhase(level: LogLevel, phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void;
    logPhaseError(level: LogLevel, phase: LogPhase, taskId: string, message: string, error: Error, metadata?: Record<string, unknown>): void;
    debug(phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void;
    info(phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void;
    warn(phase: LogPhase, taskId: string, message: string, metadata?: Record<string, unknown>): void;
    error(phase: LogPhase, taskId: string, message: string, error?: Error, metadata?: Record<string, unknown>): void;
    start(taskId: string, message: string, metadata?: Record<string, unknown>): void;
    running(taskId: string, message: string, metadata?: Record<string, unknown>): void;
    build(taskId: string, message: string, metadata?: Record<string, unknown>): void;
    pr(taskId: string, message: string, metadata?: Record<string, unknown>): void;
    completed(taskId: string, message: string, metadata?: Record<string, unknown>): void;
    failed(taskId: string, message: string, error?: Error, metadata?: Record<string, unknown>): void;
    flush(): void;
    getStats(): {
        bufferSize: number;
        minLevel: LogLevel;
        logFile: string;
    };
    getBuffer(): StructuredLogEntry[];
    getConfig(): StructuredLoggerConfig;
    clearBuffer(): void;
}
export declare function createStructuredLogger(config?: Partial<StructuredLoggerConfig>): StructuredLogger;
export declare function getStructuredLogger(config?: Partial<StructuredLoggerConfig>): StructuredLogger;
export declare function resetStructuredLogger(): void;
//# sourceMappingURL=structured-logger.d.ts.map