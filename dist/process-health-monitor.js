"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessHealthMonitor = void 0;
exports.isComplexTask = isComplexTask;
exports.createProcessHealthMonitor = createProcessHealthMonitor;
exports.killProcessTree = killProcessTree;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const DEFAULT_CONFIG = {
    checkIntervalMs: 5 * 60 * 1000,
    normalTimeoutMs: 35 * 60 * 1000,
    complexTimeoutMs: 25 * 60 * 1000,
    maxCpuPercent: 95,
    maxMemoryMB: 2048,
    cpuSpikeThreshold: 90,
    cpuSpikeCountThreshold: 3,
};
const COMPLEX_TASK_PATTERNS = [
    /database/i,
    /function/i,
    /api/i,
    /integration/i,
    /supabase/i,
    /pool/i,
    /migration/i,
    /refactor/i,
    /backend/i,
];
function isComplexTask(title) {
    return COMPLEX_TASK_PATTERNS.some(pattern => pattern.test(title));
}
class ProcessHealthMonitor {
    config;
    processes = new Map();
    checkInterval = null;
    cpuHistory = new Map();
    onKillCallback = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    setOnKillCallback(callback) {
        this.onKillCallback = callback;
    }
    registerProcess(pid, taskKey, commandId, taskTitle) {
        const processInfo = {
            pid,
            startTime: new Date(),
            taskKey,
            commandId,
            isComplex: isComplexTask(taskTitle),
        };
        this.processes.set(commandId, processInfo);
        this.cpuHistory.set(pid, []);
    }
    unregisterProcess(commandId) {
        const info = this.processes.get(commandId);
        if (info) {
            this.cpuHistory.delete(info.pid);
        }
        this.processes.delete(commandId);
    }
    getRegisteredProcesses() {
        return Array.from(this.processes.values());
    }
    async checkProcessAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    async getProcessMetrics(pid) {
        try {
            const { stdout } = await execAsync(`ps -p ${pid} -o %cpu,rss --no-headers 2>/dev/null || echo "0 0"`, { timeout: 5000 });
            const parts = stdout.trim().split(/\s+/);
            const cpuPercent = parseFloat(parts[0]) || 0;
            const rssKB = parseInt(parts[1], 10) || 0;
            const memoryMB = Math.round(rssKB / 1024);
            return {
                cpuPercent,
                memoryMB,
                timestamp: new Date(),
            };
        }
        catch {
            return {
                cpuPercent: 0,
                memoryMB: 0,
                timestamp: new Date(),
            };
        }
    }
    async checkProcessHealth(processInfo) {
        const { pid, startTime, isComplex } = processInfo;
        const now = Date.now();
        const runtimeMs = now - startTime.getTime();
        const timeoutMs = isComplex ? this.config.complexTimeoutMs : this.config.normalTimeoutMs;
        const isAlive = await this.checkProcessAlive(pid);
        const metrics = isAlive ? await this.getProcessMetrics(pid) : { cpuPercent: 0, memoryMB: 0, timestamp: new Date() };
        const isStuck = runtimeMs >= timeoutMs;
        const shouldKill = isStuck && isAlive;
        let history = this.cpuHistory.get(pid) || [];
        history.push(metrics.cpuPercent);
        if (history.length > this.config.cpuSpikeCountThreshold) {
            history = history.slice(-this.config.cpuSpikeCountThreshold);
        }
        this.cpuHistory.set(pid, history);
        const status = {
            pid,
            isAlive,
            cpuPercent: metrics.cpuPercent,
            memoryMB: metrics.memoryMB,
            runtimeMs,
            isStuck,
            shouldKill,
        };
        let action = 'none';
        let reason = '';
        if (!isAlive) {
            action = 'warn';
            reason = `Process ${pid} is dead but still registered`;
        }
        else if (shouldKill) {
            action = 'kill';
            const timeoutMin = Math.round(timeoutMs / 60000);
            const runtimeMin = Math.round(runtimeMs / 60000);
            reason = `Process stuck for ${runtimeMin}min (max ${timeoutMin}min for ${isComplex ? 'complex' : 'normal'} task)`;
        }
        else if (metrics.cpuPercent > this.config.maxCpuPercent) {
            action = 'warn';
            reason = `High CPU usage: ${metrics.cpuPercent.toFixed(1)}%`;
        }
        else if (metrics.memoryMB > this.config.maxMemoryMB) {
            action = 'warn';
            reason = `High memory usage: ${metrics.memoryMB}MB`;
        }
        return {
            processInfo,
            status,
            action,
            reason,
        };
    }
    async killProcess(pid) {
        try {
            const isAlive = await this.checkProcessAlive(pid);
            if (!isAlive) {
                return true;
            }
            process.kill(pid, 'SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 5000));
            const stillAlive = await this.checkProcessAlive(pid);
            if (stillAlive) {
                process.kill(pid, 'SIGKILL');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            return !(await this.checkProcessAlive(pid));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to kill process ${pid}: ${errorMessage}`);
            return false;
        }
    }
    async runHealthChecks() {
        const results = [];
        for (const processInfo of this.processes.values()) {
            const result = await this.checkProcessHealth(processInfo);
            results.push(result);
            if (result.action === 'kill') {
                const killed = await this.killProcess(result.processInfo.pid);
                if (killed && this.onKillCallback) {
                    await this.onKillCallback(result.processInfo.commandId, result.reason);
                }
                this.unregisterProcess(result.processInfo.commandId);
            }
        }
        return results;
    }
    start() {
        if (this.checkInterval) {
            return;
        }
        this.checkInterval = setInterval(async () => {
            try {
                await this.runHealthChecks();
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Health check error: ${errorMessage}`);
            }
        }, this.config.checkIntervalMs);
        console.log(`Process health monitor started (interval: ${this.config.checkIntervalMs / 60000}min)`);
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        console.log('Process health monitor stopped');
    }
    isRunning() {
        return this.checkInterval !== null;
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.ProcessHealthMonitor = ProcessHealthMonitor;
function createProcessHealthMonitor(config) {
    return new ProcessHealthMonitor(config);
}
function killProcessTree(pid) {
    return new Promise((resolve, reject) => {
        const pkill = (0, child_process_1.spawn)('pkill', ['-P', String(pid)]);
        pkill.on('close', () => {
            try {
                process.kill(pid, 'SIGTERM');
                setTimeout(() => {
                    try {
                        process.kill(pid, 'SIGKILL');
                    }
                    catch { }
                    resolve();
                }, 5000);
            }
            catch {
                resolve();
            }
        });
        pkill.on('error', reject);
    });
}
//# sourceMappingURL=process-health-monitor.js.map