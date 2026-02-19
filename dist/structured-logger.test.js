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
const structured_logger_1 = require("./structured-logger");
const fs = __importStar(require("fs"));
jest.mock('fs', () => ({
    appendFileSync: jest.fn(),
}));
describe('LogLevel', () => {
    it('should have correct log levels', () => {
        expect(structured_logger_1.LogLevel.DEBUG).toBe('DEBUG');
        expect(structured_logger_1.LogLevel.INFO).toBe('INFO');
        expect(structured_logger_1.LogLevel.WARN).toBe('WARN');
        expect(structured_logger_1.LogLevel.ERROR).toBe('ERROR');
    });
});
describe('LogPhase', () => {
    it('should have correct phases', () => {
        expect(structured_logger_1.LogPhase.START).toBe('START');
        expect(structured_logger_1.LogPhase.RUNNING).toBe('RUNNING');
        expect(structured_logger_1.LogPhase.BUILD).toBe('BUILD');
        expect(structured_logger_1.LogPhase.PR).toBe('PR');
        expect(structured_logger_1.LogPhase.COMPLETED).toBe('COMPLETED');
        expect(structured_logger_1.LogPhase.FAILED).toBe('FAILED');
    });
});
describe('StructuredLogger', () => {
    let logger;
    let consoleSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        logger = new structured_logger_1.StructuredLogger({
            logFile: '/tmp/test.log',
            consoleEnabled: true,
            fileEnabled: true,
            minLevel: structured_logger_1.LogLevel.DEBUG,
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
        (0, structured_logger_1.resetStructuredLogger)();
    });
    describe('constructor', () => {
        it('should create logger with default config', () => {
            const defaultLogger = new structured_logger_1.StructuredLogger();
            const config = defaultLogger.getConfig();
            expect(config.consoleEnabled).toBe(true);
            expect(config.fileEnabled).toBe(true);
            expect(config.minLevel).toBe(structured_logger_1.LogLevel.INFO);
            expect(config.bufferSize).toBe(10);
        });
        it('should merge custom config with defaults', () => {
            const customLogger = new structured_logger_1.StructuredLogger({
                bufferSize: 20,
                minLevel: structured_logger_1.LogLevel.DEBUG,
            });
            const config = customLogger.getConfig();
            expect(config.bufferSize).toBe(20);
            expect(config.minLevel).toBe(structured_logger_1.LogLevel.DEBUG);
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
            logger.setMinLevel(structured_logger_1.LogLevel.WARN);
            const config = logger.getConfig();
            expect(config.minLevel).toBe(structured_logger_1.LogLevel.WARN);
        });
    });
    describe('shouldLog', () => {
        it('should respect log level priority', () => {
            const warnLogger = new structured_logger_1.StructuredLogger({ minLevel: structured_logger_1.LogLevel.WARN });
            warnLogger.debug(structured_logger_1.LogPhase.START, 'TASK-1', 'debug message');
            warnLogger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'info message');
            expect(consoleSpy).not.toHaveBeenCalled();
            warnLogger.warn(structured_logger_1.LogPhase.START, 'TASK-1', 'warn message');
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            warnLogger.flush();
        });
    });
    describe('log methods', () => {
        it('should log debug messages', () => {
            logger.debug(structured_logger_1.LogPhase.START, 'TASK-1', 'Debug message');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[START]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[TASK-1]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Debug message'));
        });
        it('should log info messages', () => {
            logger.info(structured_logger_1.LogPhase.RUNNING, 'TASK-2', 'Info message');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[RUNNING]'));
        });
        it('should log warn messages', () => {
            logger.warn(structured_logger_1.LogPhase.BUILD, 'TASK-3', 'Warn message');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[BUILD]'));
        });
        it('should log error messages', () => {
            logger.error(structured_logger_1.LogPhase.FAILED, 'TASK-4', 'Error message');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[FAILED]'));
        });
        it('should log error messages with Error object', () => {
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at Test.test';
            logger.error(structured_logger_1.LogPhase.FAILED, 'TASK-5', 'Error with stack', error);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
        });
        it('should log with metadata', () => {
            logger.info(structured_logger_1.LogPhase.START, 'TASK-6', 'With metadata', { key: 'value', count: 42 });
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
            logger.startPhase('TASK-1', structured_logger_1.LogPhase.COMPLETED);
            jest.advanceTimersByTime(1000);
            logger.completed('TASK-1', 'Task completed');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[COMPLETED]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1000ms'));
        });
        it('should log failed phase with elapsed time', () => {
            logger.startPhase('TASK-1', structured_logger_1.LogPhase.FAILED);
            jest.advanceTimersByTime(500);
            logger.failed('TASK-1', 'Task failed');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[FAILED]'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('500ms'));
        });
        it('should log failed phase with error', () => {
            const error = new Error('Failure reason');
            error.stack = 'Error: Failure reason\n    at Test.test';
            logger.startPhase('TASK-1', structured_logger_1.LogPhase.FAILED);
            logger.failed('TASK-1', 'Task failed', error);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failure reason'));
        });
    });
    describe('phase timing', () => {
        it('should track phase start time', () => {
            logger.startPhase('TASK-1', structured_logger_1.LogPhase.RUNNING);
            jest.advanceTimersByTime(2000);
            const elapsed = logger.endPhase('TASK-1', structured_logger_1.LogPhase.RUNNING);
            expect(elapsed).toBe(2000);
        });
        it('should return undefined for unknown phase', () => {
            const elapsed = logger.endPhase('UNKNOWN', structured_logger_1.LogPhase.RUNNING);
            expect(elapsed).toBeUndefined();
        });
        it('should log elapsed time when phase ends', () => {
            logger.startPhase('TASK-1', structured_logger_1.LogPhase.BUILD);
            jest.advanceTimersByTime(1500);
            logger.logPhase(structured_logger_1.LogLevel.INFO, structured_logger_1.LogPhase.BUILD, 'TASK-1', 'Build finished');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1500ms'));
        });
    });
    describe('buffer and flush', () => {
        it('should buffer logs', () => {
            const mockAppendFileSync = fs.appendFileSync;
            mockAppendFileSync.mockClear();
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 1');
            expect(mockAppendFileSync).not.toHaveBeenCalled();
        });
        it('should flush when buffer is full', () => {
            fs.appendFileSync.mockClear();
            fs.appendFileSync.mockImplementation(() => { });
            const freshLogger = new structured_logger_1.StructuredLogger({
                logFile: '/tmp/test-buffer.log',
                consoleEnabled: false,
                fileEnabled: true,
                minLevel: structured_logger_1.LogLevel.DEBUG,
                bufferSize: 2,
                flushIntervalMs: 10000,
            });
            freshLogger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 1');
            freshLogger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 2');
            expect(fs.appendFileSync).toHaveBeenCalled();
            freshLogger.flush();
        });
        it('should flush manually', () => {
            const mockAppendFileSync = fs.appendFileSync;
            mockAppendFileSync.mockClear();
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 1');
            logger.flush();
            expect(mockAppendFileSync).toHaveBeenCalled();
        });
        it('should handle empty buffer flush', () => {
            expect(() => logger.flush()).not.toThrow();
        });
        it('should handle flush errors gracefully', () => {
            const mockAppendFileSync = fs.appendFileSync;
            mockAppendFileSync.mockClear();
            mockAppendFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 1');
            logger.flush();
            expect(errorSpy).toHaveBeenCalledWith('Failed to write logs to file:', 'Write failed');
            errorSpy.mockRestore();
            mockAppendFileSync.mockReset();
        });
        it('should schedule automatic flush', () => {
            const mockAppendFileSync = fs.appendFileSync;
            mockAppendFileSync.mockClear();
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 1');
            expect(mockAppendFileSync).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1000);
            expect(mockAppendFileSync).toHaveBeenCalled();
        });
        it('should clear timeout after flush', () => {
            const mockAppendFileSync = fs.appendFileSync;
            mockAppendFileSync.mockClear();
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 1');
            jest.advanceTimersByTime(1000);
            mockAppendFileSync.mockClear();
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message 2');
            jest.advanceTimersByTime(1000);
            expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
        });
    });
    describe('file disabled', () => {
        it('should not write to file when disabled', () => {
            const mockAppendFileSync = fs.appendFileSync;
            mockAppendFileSync.mockClear();
            const noFileLogger = new structured_logger_1.StructuredLogger({
                fileEnabled: false,
                consoleEnabled: true,
            });
            noFileLogger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message');
            expect(mockAppendFileSync).not.toHaveBeenCalled();
            noFileLogger.flush();
        });
    });
    describe('console disabled', () => {
        it('should not write to console when disabled', () => {
            const noConsoleLogger = new structured_logger_1.StructuredLogger({
                consoleEnabled: false,
                fileEnabled: true,
            });
            noConsoleLogger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message');
            expect(consoleSpy).not.toHaveBeenCalled();
            noConsoleLogger.flush();
        });
    });
    describe('getStats', () => {
        it('should return logger stats', () => {
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message');
            const stats = logger.getStats();
            expect(stats.bufferSize).toBe(1);
            expect(stats.minLevel).toBe(structured_logger_1.LogLevel.DEBUG);
            expect(stats.logFile).toBe('/tmp/test.log');
        });
    });
    describe('getBuffer', () => {
        it('should return parsed log entries', () => {
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Test message');
            const buffer = logger.getBuffer();
            expect(buffer).toHaveLength(1);
            expect(buffer[0].level).toBe(structured_logger_1.LogLevel.INFO);
            expect(buffer[0].phase).toBe(structured_logger_1.LogPhase.START);
            expect(buffer[0].taskId).toBe('TASK-1');
            expect(buffer[0].message).toBe('Test message');
        });
        it('should include timestamp in ISO format', () => {
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Test');
            const buffer = logger.getBuffer();
            expect(buffer[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
        it('should handle invalid JSON in buffer', () => {
            logger.logBuffer.push('invalid json');
            const buffer = logger.getBuffer();
            expect(buffer).toHaveLength(0);
        });
    });
    describe('clearBuffer', () => {
        it('should clear the buffer', () => {
            logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message');
            expect(logger.getBuffer()).toHaveLength(1);
            logger.clearBuffer();
            expect(logger.getBuffer()).toHaveLength(0);
        });
    });
    describe('log entry structure', () => {
        it('should create proper log entry structure', () => {
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at Test.test';
            logger.startPhase('TASK-1', structured_logger_1.LogPhase.FAILED);
            jest.advanceTimersByTime(100);
            logger.logPhaseError(structured_logger_1.LogLevel.ERROR, structured_logger_1.LogPhase.FAILED, 'TASK-1', 'Error occurred', error, { additionalInfo: 'test' });
            const buffer = logger.getBuffer();
            const entry = buffer[0];
            expect(entry.level).toBe(structured_logger_1.LogLevel.ERROR);
            expect(entry.phase).toBe(structured_logger_1.LogPhase.FAILED);
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
        const logger = (0, structured_logger_1.createStructuredLogger)();
        expect(logger).toBeInstanceOf(structured_logger_1.StructuredLogger);
        logger.flush();
    });
    it('should accept custom configuration', () => {
        const logger = (0, structured_logger_1.createStructuredLogger)({
            minLevel: structured_logger_1.LogLevel.DEBUG,
            bufferSize: 50,
        });
        const config = logger.getConfig();
        expect(config.minLevel).toBe(structured_logger_1.LogLevel.DEBUG);
        expect(config.bufferSize).toBe(50);
        logger.flush();
    });
});
describe('getStructuredLogger', () => {
    afterEach(() => {
        (0, structured_logger_1.resetStructuredLogger)();
    });
    it('should return a singleton instance', () => {
        const logger1 = (0, structured_logger_1.getStructuredLogger)();
        const logger2 = (0, structured_logger_1.getStructuredLogger)();
        expect(logger1).toBe(logger2);
        logger1.flush();
    });
    it('should create instance with config on first call', () => {
        const logger = (0, structured_logger_1.getStructuredLogger)({
            minLevel: structured_logger_1.LogLevel.WARN,
        });
        const config = logger.getConfig();
        expect(config.minLevel).toBe(structured_logger_1.LogLevel.WARN);
        logger.flush();
    });
    it('should ignore config on subsequent calls', () => {
        const logger1 = (0, structured_logger_1.getStructuredLogger)({ minLevel: structured_logger_1.LogLevel.WARN });
        const logger2 = (0, structured_logger_1.getStructuredLogger)({ minLevel: structured_logger_1.LogLevel.DEBUG });
        const config = logger2.getConfig();
        expect(config.minLevel).toBe(structured_logger_1.LogLevel.WARN);
        logger1.flush();
    });
});
describe('resetStructuredLogger', () => {
    it('should reset the singleton instance', () => {
        const logger1 = (0, structured_logger_1.getStructuredLogger)();
        (0, structured_logger_1.resetStructuredLogger)();
        const logger2 = (0, structured_logger_1.getStructuredLogger)();
        expect(logger1).not.toBe(logger2);
        logger2.flush();
    });
    it('should flush before reset', () => {
        const mockAppendFileSync = fs.appendFileSync;
        mockAppendFileSync.mockClear();
        const logger = (0, structured_logger_1.getStructuredLogger)();
        logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Message');
        (0, structured_logger_1.resetStructuredLogger)();
        expect(mockAppendFileSync).toHaveBeenCalled();
    });
});
describe('console output formatting', () => {
    let logger;
    let consoleSpy;
    beforeEach(() => {
        logger = new structured_logger_1.StructuredLogger({
            consoleEnabled: true,
            fileEnabled: false,
            minLevel: structured_logger_1.LogLevel.DEBUG,
        });
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });
    afterEach(() => {
        consoleSpy.mockRestore();
        logger.flush();
    });
    it('should colorize log levels', () => {
        logger.debug(structured_logger_1.LogPhase.START, 'TASK-1', 'Debug');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[36m'));
        logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Info');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
        logger.warn(structured_logger_1.LogPhase.START, 'TASK-1', 'Warn');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[33m'));
        logger.error(structured_logger_1.LogPhase.START, 'TASK-1', 'Error');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'));
    });
    it('should colorize phases', () => {
        logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Start');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[34m'));
        logger.info(structured_logger_1.LogPhase.RUNNING, 'TASK-1', 'Running');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[35m'));
        logger.info(structured_logger_1.LogPhase.BUILD, 'TASK-1', 'Build');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[36m'));
        logger.info(structured_logger_1.LogPhase.PR, 'TASK-1', 'PR');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
        logger.info(structured_logger_1.LogPhase.COMPLETED, 'TASK-1', 'Completed');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'));
        logger.info(structured_logger_1.LogPhase.FAILED, 'TASK-1', 'Failed');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'));
    });
    it('should include elapsed time in output', () => {
        jest.useFakeTimers();
        logger.startPhase('TASK-1', structured_logger_1.LogPhase.COMPLETED);
        jest.advanceTimersByTime(1234);
        logger.completed('TASK-1', 'Done');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(1234ms)'));
        jest.useRealTimers();
    });
    it('should include error info in output', () => {
        const error = new Error('Test error');
        logger.error(structured_logger_1.LogPhase.FAILED, 'TASK-1', 'Failed', error);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
    });
    it('should include metadata in output', () => {
        logger.info(structured_logger_1.LogPhase.START, 'TASK-1', 'Start', { key: 'value' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('{"key":"value"}'));
    });
});
//# sourceMappingURL=structured-logger.test.js.map