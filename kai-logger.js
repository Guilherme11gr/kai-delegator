/**
 * Kai Logger - Sistema de logs estruturado
 * 
 * Versão 2.0 - Structured Logging (KAIDE-7)
 * 
 * Características:
 * - Timestamp ISO 8601
 * - Níveis: DEBUG, INFO, WARN, ERROR
 * - Fases: START, RUNNING, BUILD, PR, COMPLETED, FAILED
 * - Task ID em todos os logs
 * - Tempo decorrido de cada fase
 * - Stack trace completo em erros
 * - Formato JSON para fácil parsing
 * - Output colorizado no console
 * - Buffer para reduzir I/O
 * - Performance friendly
 */

const { 
  StructuredLogger, 
  LogLevel, 
  LogPhase,
  createStructuredLogger 
} = require('./dist/structured-logger');
const fs = require('fs');
const path = require('path');

const STRUCTURED_LOG_FILE = path.join(__dirname, 'kai-delegator-structured.log');

const structuredLogger = createStructuredLogger({
  logFile: STRUCTURED_LOG_FILE,
  consoleEnabled: true,
  fileEnabled: true,
  minLevel: process.env.KAI_LOG_LEVEL || LogLevel.INFO,
  bufferSize: 10,
  flushIntervalMs: 5000,
});

const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CONFIG = {
  logFile: path.join(__dirname, 'kai-delegator.log'),
  consoleEnabled: true,
  fileEnabled: true,
  minLevel: process.env.KAI_LOG_LEVEL || 'INFO',
  bufferSize: 10,
  flushIntervalMs: 5000,
  structuredEnabled: process.env.KAI_STRUCTURED_LOGS !== 'false'
};

const logBuffer = [];
let flushTimeout = null;

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[CONFIG.minLevel];
}

function getTimestamp() {
  return new Date().toISOString();
}

function formatConsole(level, message, context = {}) {
  const color = {
    DEBUG: COLORS.cyan,
    INFO: COLORS.green,
    WARN: COLORS.yellow,
    ERROR: COLORS.red
  }[level];

  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';

  return `${color}[${level}]${COLORS.reset} ${message}${contextStr}`;
}

function formatFile(level, message, context = {}) {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : '';

  return `${timestamp} [${level}] ${message}${contextStr}\n`;
}

function flushBuffer() {
  if (logBuffer.length === 0) return;

  try {
    fs.appendFileSync(CONFIG.logFile, logBuffer.join(''));
    logBuffer.length = 0;
  } catch (error) {
    console.error('Erro ao escrever logs no arquivo:', error.message);
  }

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

function scheduleFlush() {
  if (!CONFIG.fileEnabled) return;

  if (flushTimeout) return;

  if (logBuffer.length >= CONFIG.bufferSize) {
    flushBuffer();
    return;
  }

  flushTimeout = setTimeout(() => {
    flushBuffer();
  }, CONFIG.flushIntervalMs);
}

function log(level, message, context = {}) {
  if (!shouldLog(level)) return;

  if (CONFIG.consoleEnabled) {
    console.log(formatConsole(level, message, context));
  }

  if (CONFIG.fileEnabled) {
    logBuffer.push(formatFile(level, message, context));
    scheduleFlush();
  }
}

const logger = {
  debug: (message, context) => log('DEBUG', message, context),
  info: (message, context) => log('INFO', message, context),
  warn: (message, context) => log('WARN', message, context),
  error: (message, context) => log('ERROR', message, context),

  errorWithStack: (message, error, context = {}) => {
    const fullContext = {
      ...context,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    };
    log('ERROR', message, fullContext);
  },

  flush: () => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushBuffer();
    structuredLogger.flush();
  },

  setMinLevel: (level) => {
    if (LEVELS[level] !== undefined) {
      CONFIG.minLevel = level;
      structuredLogger.setMinLevel(LogLevel[level]);
    }
  },

  stats: () => ({
    bufferSize: logBuffer.length,
    minLevel: CONFIG.minLevel,
    logFile: CONFIG.logFile
  }),

  structured: structuredLogger,

  LogLevel,
  LogPhase,

  start: (taskId, message, metadata) => {
    structuredLogger.start(taskId, message, metadata);
  },

  running: (taskId, message, metadata) => {
    structuredLogger.running(taskId, message, metadata);
  },

  build: (taskId, message, metadata) => {
    structuredLogger.build(taskId, message, metadata);
  },

  pr: (taskId, message, metadata) => {
    structuredLogger.pr(taskId, message, metadata);
  },

  completed: (taskId, message, metadata) => {
    structuredLogger.completed(taskId, message, metadata);
  },

  failed: (taskId, message, error, metadata) => {
    structuredLogger.failed(taskId, message, error, metadata);
  },

  logStructured: (level, phase, taskId, message, metadata) => {
    structuredLogger.log(level, phase, taskId, message, metadata);
  },

  logErrorStructured: (level, phase, taskId, message, error, metadata) => {
    structuredLogger.logError(level, phase, taskId, message, error, metadata);
  }
};

process.on('exit', logger.flush);
process.on('SIGTERM', () => {
  logger.flush();
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.flush();
  process.exit(0);
});

module.exports = logger;
module.exports.LogLevel = LogLevel;
module.exports.LogPhase = LogPhase;
module.exports.StructuredLogger = StructuredLogger;
