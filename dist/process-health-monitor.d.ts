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
export declare function isComplexTask(title: string): boolean;
export declare class ProcessHealthMonitor {
    private config;
    private processes;
    private checkInterval;
    private cpuHistory;
    private onKillCallback;
    constructor(config?: Partial<HealthCheckConfig>);
    configure(config: Partial<HealthCheckConfig>): void;
    setOnKillCallback(callback: (commandId: string, reason: string) => Promise<void>): void;
    registerProcess(pid: number, taskKey: string, commandId: string, taskTitle: string): void;
    unregisterProcess(commandId: string): void;
    getRegisteredProcesses(): ProcessInfo[];
    checkProcessAlive(pid: number): Promise<boolean>;
    getProcessMetrics(pid: number): Promise<WatchdogMetrics>;
    checkProcessHealth(processInfo: ProcessInfo): Promise<HealthCheckResult>;
    killProcess(pid: number): Promise<boolean>;
    runHealthChecks(): Promise<HealthCheckResult[]>;
    start(): void;
    stop(): void;
    isRunning(): boolean;
    getConfig(): HealthCheckConfig;
}
export declare function createProcessHealthMonitor(config?: Partial<HealthCheckConfig>): ProcessHealthMonitor;
export declare function killProcessTree(pid: number): Promise<void>;
//# sourceMappingURL=process-health-monitor.d.ts.map