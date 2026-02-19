"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = exports.LogPhase = exports.LogLevel = void 0;
exports.createStructuredLogger = createStructuredLogger;
exports.getStructuredLogger = getStructuredLogger;
exports.resetStructuredLogger = resetStructuredLogger;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LogPhase;
(function (LogPhase) {
    LogPhase["START"] = "START";
    LogPhase["RUNNING"] = "RUNNING";
    LogPhase["BUILD"] = "BUILD";
    LogPhase["PR"] = "PR";
    LogPhase["COMPLETED"] = "COMPLETED";
    LogPhase["FAILED"] = "FAILED";
})(LogPhase || (exports.LogPhase = LogPhase = {}));
const DEFAULT_CONFIG = {
    logFile: path.join(process.cwd(), 'kai-delegator.log'),
    consoleEnabled: true,
    fileEnabled: true,
    minLevel: LogLevel.INFO,
    bufferSize: 10,
    flushIntervalMs: 5000,
};
const LEVEL_PRIORITY = {
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
const LEVEL_COLORS = {
    [LogLevel.DEBUG]: COLORS.cyan,
    [LogLevel.INFO]: COLORS.green,
    [LogLevel.WARN]: COLORS.yellow,
    [LogLevel.ERROR]: COLORS.red,
};
const PHASE_COLORS = {
    [LogPhase.START]: COLORS.blue,
    [LogPhase.RUNNING]: COLORS.magenta,
    [LogPhase.BUILD]: COLORS.cyan,
    [LogPhase.PR]: COLORS.green,
    [LogPhase.COMPLETED]: COLORS.green,
    [LogPhase.FAILED]: COLORS.red,
};
class StructuredLogger {
    config;
    logBuffer = [];
    flushTimeout = null;
    phaseTimers = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.setupShutdownHandlers();
    }
    setupShutdownHandlers() {
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
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    setMinLevel(level) {
        this.config.minLevel = level;
    }
    shouldLog(level) {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.minLevel];
    }
    getTimestamp() {
        return new Date().toISOString();
    }
    startPhase(taskId, phase) {
        this.phaseTimers.set(`${taskId}:${phase}`, {
            phase,
            startTime: new Date(),
        });
    }
    endPhase(taskId, phase) {
        const key = `${taskId}:${phase}`;
        const timer = this.phaseTimers.get(key);
        if (!timer) {
            return undefined;
        }
        this.phaseTimers.delete(key);
        return Date.now() - timer.startTime.getTime();
    }
    formatConsole(entry) {
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
    formatFile(entry) {
        return JSON.stringify(entry) + '\n';
    }
    flushBuffer() {
        if (this.logBuffer.length === 0)
            return;
        try {
            fs.appendFileSync(this.config.logFile, this.logBuffer.join(''));
            this.logBuffer = [];
        }
        catch (error) {
            console.error('Failed to write logs to file:', error instanceof Error ? error.message : 'Unknown error');
        }
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
    }
    scheduleFlush() {
        if (!this.config.fileEnabled)
            return;
        if (this.logBuffer.length >= this.config.bufferSize) {
            this.flushBuffer();
            return;
        }
        if (this.flushTimeout)
            return;
        this.flushTimeout = setTimeout(() => {
            this.flushBuffer();
        }, this.config.flushIntervalMs);
    }
    log(level, phase, taskId, message, metadata, elapsedMs) {
        if (!this.shouldLog(level))
            return;
        const entry = {
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
    logError(level, phase, taskId, message, error, metadata, elapsedMs) {
        if (!this.shouldLog(level))
            return;
        const entry = {
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
    logPhase(level, phase, taskId, message, metadata) {
        const elapsedMs = this.endPhase(taskId, phase);
        this.log(level, phase, taskId, message, metadata, elapsedMs);
    }
    logPhaseError(level, phase, taskId, message, error, metadata) {
        const elapsedMs = this.endPhase(taskId, phase);
        this.logError(level, phase, taskId, message, error, metadata, elapsedMs);
    }
    debug(phase, taskId, message, metadata) {
        this.startPhase(taskId, phase);
        this.log(LogLevel.DEBUG, phase, taskId, message, metadata);
    }
    info(phase, taskId, message, metadata) {
        this.startPhase(taskId, phase);
        this.log(LogLevel.INFO, phase, taskId, message, metadata);
    }
    warn(phase, taskId, message, metadata) {
        this.startPhase(taskId, phase);
        this.log(LogLevel.WARN, phase, taskId, message, metadata);
    }
    error(phase, taskId, message, error, metadata) {
        this.startPhase(taskId, phase);
        if (error) {
            this.logError(LogLevel.ERROR, phase, taskId, message, error, metadata);
        }
        else {
            this.log(LogLevel.ERROR, phase, taskId, message, metadata);
        }
    }
    start(taskId, message, metadata) {
        this.info(LogPhase.START, taskId, message, metadata);
    }
    running(taskId, message, metadata) {
        this.info(LogPhase.RUNNING, taskId, message, metadata);
    }
    build(taskId, message, metadata) {
        this.info(LogPhase.BUILD, taskId, message, metadata);
    }
    pr(taskId, message, metadata) {
        this.info(LogPhase.PR, taskId, message, metadata);
    }
    completed(taskId, message, metadata) {
        this.logPhase(LogLevel.INFO, LogPhase.COMPLETED, taskId, message, metadata);
    }
    failed(taskId, message, error, metadata) {
        if (error) {
            this.logPhaseError(LogLevel.ERROR, LogPhase.FAILED, taskId, message, error, metadata);
        }
        else {
            this.logPhase(LogLevel.ERROR, LogPhase.FAILED, taskId, message, metadata);
        }
    }
    flush() {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
        this.flushBuffer();
    }
    getStats() {
        return {
            bufferSize: this.logBuffer.length,
            minLevel: this.config.minLevel,
            logFile: this.config.logFile,
        };
    }
    getBuffer() {
        return this.logBuffer.map(line => {
            try {
                return JSON.parse(line);
            }
            catch {
                return null;
            }
        }).filter((entry) => entry !== null);
    }
    getConfig() {
        return { ...this.config };
    }
    clearBuffer() {
        this.logBuffer = [];
    }
}
exports.StructuredLogger = StructuredLogger;
let defaultLogger = null;
function createStructuredLogger(config) {
    return new StructuredLogger(config);
}
function getStructuredLogger(config) {
    if (!defaultLogger) {
        defaultLogger = new StructuredLogger(config);
    }
    return defaultLogger;
}
function resetStructuredLogger() {
    if (defaultLogger) {
        defaultLogger.flush();
        defaultLogger = null;
    }
}
//# sourceMappingURL=structured-logger.js.map