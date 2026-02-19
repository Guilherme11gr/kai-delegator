"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process_health_monitor_1 = require("./process-health-monitor");
jest.mock('child_process', () => ({
    exec: jest.fn(),
    spawn: jest.fn(),
}));
describe('isComplexTask', () => {
    it('should identify database tasks as complex', () => {
        expect((0, process_health_monitor_1.isComplexTask)('Add database migration')).toBe(true);
        expect((0, process_health_monitor_1.isComplexTask)('Fix database connection pool')).toBe(true);
    });
    it('should identify API tasks as complex', () => {
        expect((0, process_health_monitor_1.isComplexTask)('Create API endpoint')).toBe(true);
        expect((0, process_health_monitor_1.isComplexTask)('Integrate with external API')).toBe(true);
    });
    it('should identify integration tasks as complex', () => {
        expect((0, process_health_monitor_1.isComplexTask)('Supabase integration')).toBe(true);
        expect((0, process_health_monitor_1.isComplexTask)('Backend refactor')).toBe(true);
    });
    it('should identify simple tasks as non-complex', () => {
        expect((0, process_health_monitor_1.isComplexTask)('Fix UI bug in button')).toBe(false);
        expect((0, process_health_monitor_1.isComplexTask)('Update README')).toBe(false);
        expect((0, process_health_monitor_1.isComplexTask)('Change color of header')).toBe(false);
    });
    it('should be case insensitive', () => {
        expect((0, process_health_monitor_1.isComplexTask)('DATABASE migration')).toBe(true);
        expect((0, process_health_monitor_1.isComplexTask)('Api Endpoint')).toBe(true);
    });
});
describe('ProcessHealthMonitor', () => {
    let monitor;
    beforeEach(() => {
        monitor = new process_health_monitor_1.ProcessHealthMonitor({
            checkIntervalMs: 1000,
            normalTimeoutMs: 5000,
            complexTimeoutMs: 3000,
            maxCpuPercent: 95,
            maxMemoryMB: 2048,
        });
        jest.clearAllMocks();
    });
    afterEach(() => {
        monitor.stop();
    });
    describe('constructor', () => {
        it('should create monitor with default config', () => {
            const defaultMonitor = new process_health_monitor_1.ProcessHealthMonitor();
            const config = defaultMonitor.getConfig();
            expect(config.checkIntervalMs).toBe(5 * 60 * 1000);
            expect(config.normalTimeoutMs).toBe(35 * 60 * 1000);
            expect(config.complexTimeoutMs).toBe(25 * 60 * 1000);
            defaultMonitor.stop();
        });
        it('should merge custom config with defaults', () => {
            const customMonitor = new process_health_monitor_1.ProcessHealthMonitor({
                checkIntervalMs: 10000,
            });
            const config = customMonitor.getConfig();
            expect(config.checkIntervalMs).toBe(10000);
            expect(config.normalTimeoutMs).toBe(35 * 60 * 1000);
            customMonitor.stop();
        });
    });
    describe('configure', () => {
        it('should update configuration', () => {
            monitor.configure({ maxCpuPercent: 80 });
            const config = monitor.getConfig();
            expect(config.maxCpuPercent).toBe(80);
        });
    });
    describe('registerProcess', () => {
        it('should register a process', () => {
            monitor.registerProcess(12345, 'TEST-1', 'cmd-1', 'Simple task');
            const processes = monitor.getRegisteredProcesses();
            expect(processes).toHaveLength(1);
            expect(processes[0].pid).toBe(12345);
            expect(processes[0].taskKey).toBe('TEST-1');
            expect(processes[0].isComplex).toBe(false);
        });
        it('should mark complex tasks correctly', () => {
            monitor.registerProcess(12345, 'TEST-1', 'cmd-1', 'Database migration');
            const processes = monitor.getRegisteredProcesses();
            expect(processes[0].isComplex).toBe(true);
        });
    });
    describe('unregisterProcess', () => {
        it('should unregister a process', () => {
            monitor.registerProcess(12345, 'TEST-1', 'cmd-1', 'Task');
            monitor.unregisterProcess('cmd-1');
            expect(monitor.getRegisteredProcesses()).toHaveLength(0);
        });
        it('should handle unregistering non-existent process', () => {
            expect(() => monitor.unregisterProcess('nonexistent')).not.toThrow();
        });
    });
    describe('checkProcessAlive', () => {
        it('should return true for current process', async () => {
            const result = await monitor.checkProcessAlive(process.pid);
            expect(result).toBe(true);
        });
        it('should return false for non-existent PID', async () => {
            const result = await monitor.checkProcessAlive(99999999);
            expect(result).toBe(false);
        });
    });
    describe('getProcessMetrics', () => {
        it('should return metrics for a running process', async () => {
            const mockExec = require('child_process').exec;
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '10.5 102400', stderr: '' });
                return {};
            });
            const metrics = await monitor.getProcessMetrics(process.pid);
            expect(metrics.cpuPercent).toBe(10.5);
            expect(metrics.memoryMB).toBe(100);
            expect(metrics.timestamp).toBeInstanceOf(Date);
        });
        it('should handle exec errors gracefully', async () => {
            const mockExec = require('child_process').exec;
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(new Error('Command failed'), { stdout: '', stderr: '' });
                return {};
            });
            const metrics = await monitor.getProcessMetrics(99999999);
            expect(metrics.cpuPercent).toBe(0);
            expect(metrics.memoryMB).toBe(0);
        });
    });
    describe('checkProcessHealth', () => {
        it('should return healthy status for running process', async () => {
            const mockExec = require('child_process').exec;
            const processInfo = {
                pid: process.pid,
                startTime: new Date(),
                taskKey: 'TEST-1',
                commandId: 'cmd-1',
                isComplex: false,
            };
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '5.0 51200', stderr: '' });
                return {};
            });
            const result = await monitor.checkProcessHealth(processInfo);
            expect(result.status.isAlive).toBe(true);
            expect(result.status.isStuck).toBe(false);
            expect(result.status.shouldKill).toBe(false);
            expect(result.action).toBe('none');
        });
        it('should detect stuck process (normal task)', async () => {
            const mockExec = require('child_process').exec;
            const processInfo = {
                pid: process.pid,
                startTime: new Date(Date.now() - 10000),
                taskKey: 'TEST-1',
                commandId: 'cmd-1',
                isComplex: false,
            };
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '5.0 51200', stderr: '' });
                return {};
            });
            const result = await monitor.checkProcessHealth(processInfo);
            expect(result.status.isStuck).toBe(true);
            expect(result.status.shouldKill).toBe(true);
            expect(result.action).toBe('kill');
        });
        it('should detect stuck process (complex task with shorter timeout)', async () => {
            const mockExec = require('child_process').exec;
            const complexMonitor = new process_health_monitor_1.ProcessHealthMonitor({
                normalTimeoutMs: 10000,
                complexTimeoutMs: 4000,
            });
            const processInfo = {
                pid: process.pid,
                startTime: new Date(Date.now() - 5000),
                taskKey: 'TEST-1',
                commandId: 'cmd-1',
                isComplex: true,
            };
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '5.0 51200', stderr: '' });
                return {};
            });
            const result = await complexMonitor.checkProcessHealth(processInfo);
            expect(result.status.isStuck).toBe(true);
            expect(result.action).toBe('kill');
            complexMonitor.stop();
        });
        it('should warn on dead process', async () => {
            const processInfo = {
                pid: 99999999,
                startTime: new Date(),
                taskKey: 'TEST-1',
                commandId: 'cmd-1',
                isComplex: false,
            };
            const result = await monitor.checkProcessHealth(processInfo);
            expect(result.status.isAlive).toBe(false);
            expect(result.action).toBe('warn');
        });
        it('should warn on high CPU usage', async () => {
            const mockExec = require('child_process').exec;
            const highCpuMonitor = new process_health_monitor_1.ProcessHealthMonitor({
                maxCpuPercent: 80,
            });
            const processInfo = {
                pid: process.pid,
                startTime: new Date(),
                taskKey: 'TEST-1',
                commandId: 'cmd-1',
                isComplex: false,
            };
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '95.0 51200', stderr: '' });
                return {};
            });
            const result = await highCpuMonitor.checkProcessHealth(processInfo);
            expect(result.action).toBe('warn');
            expect(result.reason).toContain('High CPU');
            highCpuMonitor.stop();
        });
        it('should warn on high memory usage', async () => {
            const mockExec = require('child_process').exec;
            const lowMemoryMonitor = new process_health_monitor_1.ProcessHealthMonitor({
                maxMemoryMB: 100,
            });
            const processInfo = {
                pid: process.pid,
                startTime: new Date(),
                taskKey: 'TEST-1',
                commandId: 'cmd-1',
                isComplex: false,
            };
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '5.0 204800', stderr: '' });
                return {};
            });
            const result = await lowMemoryMonitor.checkProcessHealth(processInfo);
            expect(result.action).toBe('warn');
            expect(result.reason).toContain('High memory');
            lowMemoryMonitor.stop();
        });
    });
    describe('killProcess', () => {
        it('should return true for non-existent process', async () => {
            const result = await monitor.killProcess(99999999);
            expect(result).toBe(true);
        });
        it('should kill a running process', async () => {
            const { spawn } = jest.requireActual('child_process');
            const childProcess = spawn('sleep', ['60']);
            const pid = childProcess.pid;
            expect(pid).toBeDefined();
            const result = await monitor.killProcess(pid);
            expect(result).toBe(true);
            try {
                childProcess.kill();
            }
            catch { }
        }, 15000);
    });
    describe('runHealthChecks', () => {
        it('should return empty array when no processes registered', async () => {
            const results = await monitor.runHealthChecks();
            expect(results).toHaveLength(0);
        });
        it('should check all registered processes', async () => {
            const mockExec = require('child_process').exec;
            monitor.registerProcess(process.pid, 'TEST-1', 'cmd-1', 'Task');
            monitor.registerProcess(99999999, 'TEST-2', 'cmd-2', 'Task');
            mockExec.mockImplementation((_cmd, _options, callback) => {
                callback(null, { stdout: '5.0 51200', stderr: '' });
                return {};
            });
            const results = await monitor.runHealthChecks();
            expect(results).toHaveLength(2);
        });
        it('should kill stuck processes and call callback', async () => {
            const killCallback = jest.fn();
            monitor.setOnKillCallback(killCallback);
            const stuckMonitor = new process_health_monitor_1.ProcessHealthMonitor({
                normalTimeoutMs: -1,
                complexTimeoutMs: -1,
            });
            stuckMonitor.setOnKillCallback(killCallback);
            const { spawn } = jest.requireActual('child_process');
            const childProcess = spawn('sleep', ['60']);
            const pid = childProcess.pid;
            expect(pid).toBeDefined();
            stuckMonitor.registerProcess(pid, 'TEST-1', 'cmd-1', 'Task');
            const results = await stuckMonitor.runHealthChecks();
            expect(results).toHaveLength(1);
            expect(killCallback).toHaveBeenCalledWith('cmd-1', expect.stringContaining('stuck'));
            expect(stuckMonitor.getRegisteredProcesses()).toHaveLength(0);
            stuckMonitor.stop();
            try {
                childProcess.kill();
            }
            catch { }
        }, 15000);
    });
    describe('start/stop', () => {
        it('should start and stop monitoring', () => {
            expect(monitor.isRunning()).toBe(false);
            monitor.start();
            expect(monitor.isRunning()).toBe(true);
            monitor.stop();
            expect(monitor.isRunning()).toBe(false);
        });
        it('should not start twice', () => {
            monitor.start();
            monitor.start();
            expect(monitor.isRunning()).toBe(true);
            monitor.stop();
        });
        it('should handle stop when not running', () => {
            expect(() => monitor.stop()).not.toThrow();
        });
    });
    describe('setOnKillCallback', () => {
        it('should set kill callback', () => {
            const callback = jest.fn();
            monitor.setOnKillCallback(callback);
            expect(monitor).toBeDefined();
        });
    });
    describe('getConfig', () => {
        it('should return a copy of config', () => {
            const config1 = monitor.getConfig();
            const config2 = monitor.getConfig();
            expect(config1).not.toBe(config2);
            expect(config1).toEqual(config2);
        });
    });
});
describe('createProcessHealthMonitor', () => {
    it('should create a ProcessHealthMonitor instance', () => {
        const testMonitor = (0, process_health_monitor_1.createProcessHealthMonitor)();
        expect(testMonitor).toBeInstanceOf(process_health_monitor_1.ProcessHealthMonitor);
        testMonitor.stop();
    });
    it('should accept custom configuration', () => {
        const testMonitor = (0, process_health_monitor_1.createProcessHealthMonitor)({
            checkIntervalMs: 10000,
        });
        const config = testMonitor.getConfig();
        expect(config.checkIntervalMs).toBe(10000);
        testMonitor.stop();
    });
});
//# sourceMappingURL=process-health-monitor.test.js.map