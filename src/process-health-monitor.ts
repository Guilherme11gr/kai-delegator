import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  startTime: Date;
  taskKey: string;
  commandId: string;
  isComplex: boolean;
}

export interface ProcessHealthStatus {
  pid: number;
  isAlive: boolean;
  cpuPercent: number;
  memoryMB: number;
  runtimeMs: number;
  isStuck: boolean;
  shouldKill: boolean;
}

export interface WatchdogMetrics {
  cpuPercent: number;
  memoryMB: number;
  timestamp: Date;
}

export interface HealthCheckConfig {
  checkIntervalMs: number;
  normalTimeoutMs: number;
  complexTimeoutMs: number;
  maxCpuPercent: number;
  maxMemoryMB: number;
  cpuSpikeThreshold: number;
  cpuSpikeCountThreshold: number;
}

export interface HealthCheckResult {
  processInfo: ProcessInfo;
  status: ProcessHealthStatus;
  action: 'none' | 'kill' | 'warn';
  reason: string;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
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

export function isComplexTask(title: string): boolean {
  return COMPLEX_TASK_PATTERNS.some(pattern => pattern.test(title));
}

export class ProcessHealthMonitor {
  private config: HealthCheckConfig;
  private processes: Map<string, ProcessInfo> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private cpuHistory: Map<number, number[]> = new Map();
  private onKillCallback: ((commandId: string, reason: string) => Promise<void>) | null = null;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  configure(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setOnKillCallback(callback: (commandId: string, reason: string) => Promise<void>): void {
    this.onKillCallback = callback;
  }

  registerProcess(pid: number, taskKey: string, commandId: string, taskTitle: string): void {
    const processInfo: ProcessInfo = {
      pid,
      startTime: new Date(),
      taskKey,
      commandId,
      isComplex: isComplexTask(taskTitle),
    };
    
    this.processes.set(commandId, processInfo);
    this.cpuHistory.set(pid, []);
  }

  unregisterProcess(commandId: string): void {
    const info = this.processes.get(commandId);
    if (info) {
      this.cpuHistory.delete(info.pid);
    }
    this.processes.delete(commandId);
  }

  getRegisteredProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  async checkProcessAlive(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async getProcessMetrics(pid: number): Promise<WatchdogMetrics> {
    try {
      const { stdout } = await execAsync(
        `ps -p ${pid} -o %cpu,rss --no-headers 2>/dev/null || echo "0 0"`,
        { timeout: 5000 }
      );
      
      const parts = stdout.trim().split(/\s+/);
      const cpuPercent = parseFloat(parts[0]) || 0;
      const rssKB = parseInt(parts[1], 10) || 0;
      const memoryMB = Math.round(rssKB / 1024);
      
      return {
        cpuPercent,
        memoryMB,
        timestamp: new Date(),
      };
    } catch {
      return {
        cpuPercent: 0,
        memoryMB: 0,
        timestamp: new Date(),
      };
    }
  }

  async checkProcessHealth(processInfo: ProcessInfo): Promise<HealthCheckResult> {
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
    
    const status: ProcessHealthStatus = {
      pid,
      isAlive,
      cpuPercent: metrics.cpuPercent,
      memoryMB: metrics.memoryMB,
      runtimeMs,
      isStuck,
      shouldKill,
    };
    
    let action: 'none' | 'kill' | 'warn' = 'none';
    let reason = '';
    
    if (!isAlive) {
      action = 'warn';
      reason = `Process ${pid} is dead but still registered`;
    } else if (shouldKill) {
      action = 'kill';
      const timeoutMin = Math.round(timeoutMs / 60000);
      const runtimeMin = Math.round(runtimeMs / 60000);
      reason = `Process stuck for ${runtimeMin}min (max ${timeoutMin}min for ${isComplex ? 'complex' : 'normal'} task)`;
    } else if (metrics.cpuPercent > this.config.maxCpuPercent) {
      action = 'warn';
      reason = `High CPU usage: ${metrics.cpuPercent.toFixed(1)}%`;
    } else if (metrics.memoryMB > this.config.maxMemoryMB) {
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

  async killProcess(pid: number): Promise<boolean> {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to kill process ${pid}: ${errorMessage}`);
      return false;
    }
  }

  async runHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const processInfo of this.processes.values()) {
      const result = await this.checkProcessHealth(processInfo);
      results.push(result);
      
      if (result.action === 'kill') {
        const killed = await this.killProcess(result.processInfo.pid);
        
        if (killed && this.onKillCallback) {
          await this.onKillCallback(
            result.processInfo.commandId,
            result.reason
          );
        }
        
        this.unregisterProcess(result.processInfo.commandId);
      }
    }
    
    return results;
  }

  start(): void {
    if (this.checkInterval) {
      return;
    }
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Health check error: ${errorMessage}`);
      }
    }, this.config.checkIntervalMs);
    
    console.log(`Process health monitor started (interval: ${this.config.checkIntervalMs / 60000}min)`);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('Process health monitor stopped');
  }

  isRunning(): boolean {
    return this.checkInterval !== null;
  }

  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }
}

export function createProcessHealthMonitor(config?: Partial<HealthCheckConfig>): ProcessHealthMonitor {
  return new ProcessHealthMonitor(config);
}

export function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const pkill = spawn('pkill', ['-P', String(pid)]);
    pkill.on('close', () => {
      try {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
          resolve();
        }, 5000);
      } catch {
        resolve();
      }
    });
    pkill.on('error', reject);
  });
}
