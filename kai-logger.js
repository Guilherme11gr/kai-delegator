/**
 * Kai Logger - Sistema de logs robusto e simples
 *
 * Características:
 * - Timestamp ISO 8601
 * - Níveis: DEBUG, INFO, WARN, ERROR
 * - Output colorizado no console
 * - Arquivo de log (append)
 * - Buffer para reduzir I/O
 * - Performance friendly
 */

const fs = require('fs');
const path = require('path');

// Cores ANSI para console
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

// Configuração
const CONFIG = {
  logFile: path.join(__dirname, 'kai-delegator.log'),
  consoleEnabled: true,
  fileEnabled: true,
  minLevel: process.env.KAI_LOG_LEVEL || 'INFO',
  bufferSize: 10, // Número de logs antes de flush
  flushIntervalMs: 5000 // Flush automático a cada 5s
};

// Níveis de log (ordem de prioridade)
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Buffer de logs em memória
const logBuffer = [];
let flushTimeout = null;

/**
 * Verifica se nível deve ser logado
 */
function shouldLog(level) {
  return LEVELS[level] >= LEVELS[CONFIG.minLevel];
}

/**
 * Obtém timestamp formatado (ISO 8601)
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Formata mensagem para console (com cores)
 */
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

/**
 * Formata mensagem para arquivo (texto plano)
 */
function formatFile(level, message, context = {}) {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : '';

  return `${timestamp} [${level}] ${message}${contextStr}\n`;
}

/**
 * Escreve buffer no arquivo
 */
function flushBuffer() {
  if (logBuffer.length === 0) return;

  try {
    fs.appendFileSync(CONFIG.logFile, logBuffer.join(''));
    logBuffer.length = 0; // Limpa buffer
  } catch (error) {
    console.error('Erro ao escrever logs no arquivo:', error.message);
  }

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

/**
 * Agend flush automático
 */
function scheduleFlush() {
  if (!CONFIG.fileEnabled) return;

  // Já tem um agendamento?
  if (flushTimeout) return;

  // Se buffer cheio, flush imediato
  if (logBuffer.length >= CONFIG.bufferSize) {
    flushBuffer();
    return;
  }

  // Senão, agenda flush automático
  flushTimeout = setTimeout(() => {
    flushBuffer();
  }, CONFIG.flushIntervalMs);
}

/**
 * Função principal de log
 */
function log(level, message, context = {}) {
  if (!shouldLog(level)) return;

  // Console output
  if (CONFIG.consoleEnabled) {
    console.log(formatConsole(level, message, context));
  }

  // File output (bufferizado)
  if (CONFIG.fileEnabled) {
    logBuffer.push(formatFile(level, message, context));
    scheduleFlush();
  }
}

/**
 * Métodos de conveniência
 */
const logger = {
  debug: (message, context) => log('DEBUG', message, context),
  info: (message, context) => log('INFO', message, context),
  warn: (message, context) => log('WARN', message, context),
  error: (message, context) => log('ERROR', message, context),

  // Métodos especiais
  errorWithStack: (message, error, context = {}) => {
    const fullContext = {
      ...context,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n') // Top 3 linhas
    };
    log('ERROR', message, fullContext);
  },

  // Flush manual (para shutdown)
  flush: () => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushBuffer();
  },

  // Configuração dinâmica
  setMinLevel: (level) => {
    if (LEVELS[level] !== undefined) {
      CONFIG.minLevel = level;
    }
  },

  // Stats simples
  stats: () => ({
    bufferSize: logBuffer.length,
    minLevel: CONFIG.minLevel,
    logFile: CONFIG.logFile
  })
};

// Flush em shutdown do processo
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
