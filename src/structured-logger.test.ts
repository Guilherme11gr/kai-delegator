import {
  StructuredLogger,
  LogLevel,
  LogPhase,
  createStructuredLogger,
  getStructuredLogger,
  resetStructuredLogger,
} from './structured-logger';
import * as fs from 'fs';

jest.mock('fs', () => ({
  appendFileSync: jest.fn(),
}));

describe('LogLevel', () => {
  it('should have correct log levels', () => {
    expect(LogLevel.DEBUG).toBe('DEBUG');
    expect(LogLevel.INFO).toBe('INFO');
    expect(LogLevel.WARN).toBe('WARN');
    expect(LogLevel.ERROR).toBe('ERROR');
  });
});

describe('LogPhase', () => {
  it('should have correct phases', () => {
    expect(LogPhase.START).toBe('START');
    expect(LogPhase.RUNNING).toBe('RUNNING');
    expect(LogPhase.BUILD).toBe('BUILD');
    expect(LogPhase.PR).toBe('PR');
    expect(LogPhase.COMPLETED).toBe('COMPLETED');
    expect(LogPhase.FAILED).toBe('FAILED');
  });
});

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new StructuredLogger({
      logFile: '/tmp/test.log',
      consoleEnabled: true,
      fileEnabled: true,
      minLevel: LogLevel.DEBUG,
      bufferSize: 2,
      flushIntervalMs: 1000,
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.useFakeTimers();
  });

  afterEach(() => {
    logger.flush();
    consoleSpy.mockRestore();
    jest.useRealTimers();
    resetStructuredLogger();
  });

  describe('constructor', () => {
    it('should create logger with default config', () => {
      const defaultLogger = new StructuredLogger();
      const config = defaultLogger.getConfig();
      expect(config.consoleEnabled).toBe(true);
      expect(config.fileEnabled).toBe(true);
      expect(config.minLevel).toBe(LogLevel.INFO);
      expect(config.bufferSize).toBe(10);
    });

    it('should merge custom config with defaults', () => {
      const customLogger = new StructuredLogger({
        bufferSize: 20,
        minLevel: LogLevel.DEBUG,
      });
      const config = customLogger.getConfig();
      expect(config.bufferSize).toBe(20);
      expect(config.minLevel).toBe(LogLevel.DEBUG);
      customLogger.flush();
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      logger.configure({ bufferSize: 50 });
      const config = logger.getConfig();
      expect(config.bufferSize).toBe(50);
    });
  });

  describe('setMinLevel', () => {
    it('should update minimum log level', () => {
      logger.setMinLevel(LogLevel.WARN);
      const config = logger.getConfig();
      expect(config.minLevel).toBe(LogLevel.WARN);
    });
  });

  describe('shouldLog', () => {
    it('should respect log level priority', () => {
      const warnLogger = new StructuredLogger({ minLevel: LogLevel.WARN });
      
      warnLogger.debug(LogPhase.START, 'TASK-1', 'debug message');
      warnLogger.info(LogPhase.START, 'TASK-1', 'info message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      warnLogger.warn(LogPhase.START, 'TASK-1', 'warn message');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      
      warnLogger.flush();
    });
  });

  describe('log methods', () => {
    it('should log debug messages', () => {
      logger.debug(LogPhase.START, 'TASK-1', 'Debug message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[START]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[TASK-1]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Debug message'));
    });

    it('should log info messages', () => {
      logger.info(LogPhase.RUNNING, 'TASK-2', 'Info message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[RUNNING]'));
    });

    it('should log warn messages', () => {
      logger.warn(LogPhase.BUILD, 'TASK-3', 'Warn message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[BUILD]'));
    });

    it('should log error messages', () => {
      logger.error(LogPhase.FAILED, 'TASK-4', 'Error message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[FAILED]'));
    });

    it('should log error messages with Error object', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at Test.test';
      
      logger.error(LogPhase.FAILED, 'TASK-5', 'Error with stack', error);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
    });

    it('should log with metadata', () => {
      logger.info(LogPhase.START, 'TASK-6', 'With metadata', { key: 'value', count: 42 });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('key'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('value'));
    });
  });

  describe('phase convenience methods', () => {
    it('should log start phase', () => {
      logger.start('TASK-1', 'Starting task');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[START]'));
    });

    it('should log running phase', () => {
      logger.running('TASK-1', 'Running task');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[RUNNING]'));
    });

    it('should log build phase', () => {
      logger.build('TASK-1', 'Building');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[BUILD]'));
    });

    it('should log pr phase', () => {
      logger.pr('TASK-1', 'Creating PR');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PR]'));
    });

    it('should log completed phase with elapsed time', () => {
      logger.startPhase('TASK-1', LogPhase.COMPLETED);
      jest.advanceTimersByTime(1000);
      logger.completed('TASK-1', 'Task completed');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[COMPLETED]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1000ms'));
    });

    it('should log failed phase with elapsed time', () => {
      logger.startPhase('TASK-1', LogPhase.FAILED);
      jest.advanceTimersByTime(500);
      logger.failed('TASK-1', 'Task failed');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[FAILED]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('500ms'));
    });

    it('should log failed phase with error', () => {
      const error = new Error('Failure reason');
      error.stack = 'Error: Failure reason\n    at Test.test';
      
      logger.startPhase('TASK-1', LogPhase.FAILED);
      logger.failed('TASK-1', 'Task failed', error);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failure reason'));
    });
  });

  describe('phase timing', () => {
    it('should track phase start time', () => {
      logger.startPhase('TASK-1', LogPhase.RUNNING);
      jest.advanceTimersByTime(2000);
      const elapsed = logger.endPhase('TASK-1', LogPhase.RUNNING);
      expect(elapsed).toBe(2000);
    });

    it('should return undefined for unknown phase', () => {
      const elapsed = logger.endPhase('UNKNOWN', LogPhase.RUNNING);
      expect(elapsed).toBeUndefined();
    });

    it('should log elapsed time when phase ends', () => {
      logger.startPhase('TASK-1', LogPhase.BUILD);
      jest.advanceTimersByTime(1500);
      logger.logPhase(LogLevel.INFO, LogPhase.BUILD, 'TASK-1', 'Build finished');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1500ms'));
    });
  });

  describe('buffer and flush', () => {
    it('should buffer logs', () => {
      const mockAppendFileSync = fs.appendFileSync as jest.Mock;
      mockAppendFileSync.mockClear();
      logger.info(LogPhase.START, 'TASK-1', 'Message 1');
      expect(mockAppendFileSync).not.toHaveBeenCalled();
    });

    it('should flush when buffer is full', () => {
      (fs.appendFileSync as jest.Mock).mockClear();
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {});
      
      const freshLogger = new StructuredLogger({
        logFile: '/tmp/test-buffer.log',
        consoleEnabled: false,
        fileEnabled: true,
        minLevel: LogLevel.DEBUG,
        bufferSize: 2,
        flushIntervalMs: 10000,
      });
      
      freshLogger.info(LogPhase.START, 'TASK-1', 'Message 1');
      freshLogger.info(LogPhase.START, 'TASK-1', 'Message 2');
      expect(fs.appendFileSync).toHaveBeenCalled();
      
      freshLogger.flush();
    });

    it('should flush manually', () => {
      const mockAppendFileSync = fs.appendFileSync as jest.Mock;
      mockAppendFileSync.mockClear();
      logger.info(LogPhase.START, 'TASK-1', 'Message 1');
      logger.flush();
      expect(mockAppendFileSync).toHaveBeenCalled();
    });

    it('should handle empty buffer flush', () => {
      expect(() => logger.flush()).not.toThrow();
    });

    it('should handle flush errors gracefully', () => {
      const mockAppendFileSync = fs.appendFileSync as jest.Mock;
      mockAppendFileSync.mockClear();
      mockAppendFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.info(LogPhase.START, 'TASK-1', 'Message 1');
      logger.flush();
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to write logs to file:',
        'Write failed'
      );
      errorSpy.mockRestore();
      mockAppendFileSync.mockReset();
    });

    it('should schedule automatic flush', () => {
      const mockAppendFileSync = fs.appendFileSync as jest.Mock;
      mockAppendFileSync.mockClear();
      logger.info(LogPhase.START, 'TASK-1', 'Message 1');
      expect(mockAppendFileSync).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000);
      expect(mockAppendFileSync).toHaveBeenCalled();
    });

    it('should clear timeout after flush', () => {
      const mockAppendFileSync = fs.appendFileSync as jest.Mock;
      mockAppendFileSync.mockClear();
      logger.info(LogPhase.START, 'TASK-1', 'Message 1');
      jest.advanceTimersByTime(1000);
      
      mockAppendFileSync.mockClear();
      logger.info(LogPhase.START, 'TASK-1', 'Message 2');
      jest.advanceTimersByTime(1000);
      
      expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('file disabled', () => {
    it('should not write to file when disabled', () => {
      const mockAppendFileSync = fs.appendFileSync as jest.Mock;
      mockAppendFileSync.mockClear();
      const noFileLogger = new StructuredLogger({
        fileEnabled: false,
        consoleEnabled: true,
      });
      
      noFileLogger.info(LogPhase.START, 'TASK-1', 'Message');
      expect(mockAppendFileSync).not.toHaveBeenCalled();
      
      noFileLogger.flush();
    });
  });

  describe('console disabled', () => {
    it('should not write to console when disabled', () => {
      const noConsoleLogger = new StructuredLogger({
        consoleEnabled: false,
        fileEnabled: true,
      });
      
      noConsoleLogger.info(LogPhase.START, 'TASK-1', 'Message');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      noConsoleLogger.flush();
    });
  });

  describe('getStats', () => {
    it('should return logger stats', () => {
      logger.info(LogPhase.START, 'TASK-1', 'Message');
      const stats = logger.getStats();
      expect(stats.bufferSize).toBe(1);
      expect(stats.minLevel).toBe(LogLevel.DEBUG);
      expect(stats.logFile).toBe('/tmp/test.log');
    });
  });

  describe('getBuffer', () => {
    it('should return parsed log entries', () => {
      logger.info(LogPhase.START, 'TASK-1', 'Test message');
      const buffer = logger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe(LogLevel.INFO);
      expect(buffer[0].phase).toBe(LogPhase.START);
      expect(buffer[0].taskId).toBe('TASK-1');
      expect(buffer[0].message).toBe('Test message');
    });

    it('should include timestamp in ISO format', () => {
      logger.info(LogPhase.START, 'TASK-1', 'Test');
      const buffer = logger.getBuffer();
      expect(buffer[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle invalid JSON in buffer', () => {
      (logger as unknown as { logBuffer: string[] }).logBuffer.push('invalid json');
      const buffer = logger.getBuffer();
      expect(buffer).toHaveLength(0);
    });
  });

  describe('clearBuffer', () => {
    it('should clear the buffer', () => {
      logger.info(LogPhase.START, 'TASK-1', 'Message');
      expect(logger.getBuffer()).toHaveLength(1);
      
      logger.clearBuffer();
      expect(logger.getBuffer()).toHaveLength(0);
    });
  });

  describe('log entry structure', () => {
    it('should create proper log entry structure', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at Test.test';
      
      logger.startPhase('TASK-1', LogPhase.FAILED);
      jest.advanceTimersByTime(100);
      logger.logPhaseError(
        LogLevel.ERROR,
        LogPhase.FAILED,
        'TASK-1',
        'Error occurred',
        error,
        { additionalInfo: 'test' }
      );
      
      const buffer = logger.getBuffer();
      const entry = buffer[0];
      
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.phase).toBe(LogPhase.FAILED);
      expect(entry.taskId).toBe('TASK-1');
      expect(entry.message).toBe('Error occurred');
      expect(entry.elapsedMs).toBe(100);
      expect(entry.error).toBeDefined();
      expect(entry.error?.name).toBe('Error');
      expect(entry.error?.message).toBe('Test error');
      expect(entry.error?.stack).toBe('Error: Test error\n    at Test.test');
      expect(entry.metadata).toEqual({ additionalInfo: 'test' });
    });
  });
});

describe('createStructuredLogger', () => {
  it('should create a new StructuredLogger instance', () => {
    const logger = createStructuredLogger();
    expect(logger).toBeInstanceOf(StructuredLogger);
    logger.flush();
  });

  it('should accept custom configuration', () => {
    const logger = createStructuredLogger({
      minLevel: LogLevel.DEBUG,
      bufferSize: 50,
    });
    const config = logger.getConfig();
    expect(config.minLevel).toBe(LogLevel.DEBUG);
    expect(config.bufferSize).toBe(50);
    logger.flush();
  });
});

describe('getStructuredLogger', () => {
  afterEach(() => {
    resetStructuredLogger();
  });

  it('should return a singleton instance', () => {
    const logger1 = getStructuredLogger();
    const logger2 = getStructuredLogger();
    expect(logger1).toBe(logger2);
    logger1.flush();
  });

  it('should create instance with config on first call', () => {
    const logger = getStructuredLogger({
      minLevel: LogLevel.WARN,
    });
    const config = logger.getConfig();
    expect(config.minLevel).toBe(LogLevel.WARN);
    logger.flush();
  });

  it('should ignore config on subsequent calls', () => {
    const logger1 = getStructuredLogger({ minLevel: LogLevel.WARN });
    const logger2 = getStructuredLogger({ minLevel: LogLevel.DEBUG });
    const config = logger2.getConfig();
    expect(config.minLevel).toBe(LogLevel.WARN);
    logger1.flush();
  });
});

describe('resetStructuredLogger', () => {
  it('should reset the singleton instance', () => {
    const logger1 = getStructuredLogger();
    resetStructuredLogger();
    const logger2 = getStructuredLogger();
    expect(logger1).not.toBe(logger2);
    logger2.flush();
  });

  it('should flush before reset', () => {
    const mockAppendFileSync = fs.appendFileSync as jest.Mock;
    mockAppendFileSync.mockClear();
    
    const logger = getStructuredLogger();
    logger.info(LogPhase.START, 'TASK-1', 'Message');
    
    resetStructuredLogger();
    expect(mockAppendFileSync).toHaveBeenCalled();
  });
});

describe('console output formatting', () => {
  let logger: StructuredLogger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new StructuredLogger({
      consoleEnabled: true,
      fileEnabled: false,
      minLevel: LogLevel.DEBUG,
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    logger.flush();
  });

  it('should colorize log levels', () => {
    logger.debug(LogPhase.START, 'TASK-1', 'Debug');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[36m'));
    
    logger.info(LogPhase.START, 'TASK-1', 'Info');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
    
    logger.warn(LogPhase.START, 'TASK-1', 'Warn');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[33m'));
    
    logger.error(LogPhase.START, 'TASK-1', 'Error');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'));
  });

  it('should colorize phases', () => {
    logger.info(LogPhase.START, 'TASK-1', 'Start');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[34m'));
    
    logger.info(LogPhase.RUNNING, 'TASK-1', 'Running');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[35m'));
    
    logger.info(LogPhase.BUILD, 'TASK-1', 'Build');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[36m'));
    
    logger.info(LogPhase.PR, 'TASK-1', 'PR');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
    
    logger.info(LogPhase.COMPLETED, 'TASK-1', 'Completed');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
    
    logger.info(LogPhase.FAILED, 'TASK-1', 'Failed');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'));
  });

  it('should include elapsed time in output', () => {
    jest.useFakeTimers();
    logger.startPhase('TASK-1', LogPhase.COMPLETED);
    jest.advanceTimersByTime(1234);
    logger.completed('TASK-1', 'Done');
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(1234ms)'));
    jest.useRealTimers();
  });

  it('should include error info in output', () => {
    const error = new Error('Test error');
    logger.error(LogPhase.FAILED, 'TASK-1', 'Failed', error);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
  });

  it('should include metadata in output', () => {
    logger.info(LogPhase.START, 'TASK-1', 'Start', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('{"key":"value"}'));
  });
});
