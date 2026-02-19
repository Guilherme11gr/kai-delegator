export type CodingAgentStatus = 'idle' | 'busy' | 'error' | 'unavailable';

export interface TaskInfo {
  taskId: string;
  taskKey: string;
  title: string;
  projectKey: string;
  repoUrl: string;
  branchName: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  prUrl?: string;
  branchName: string;
  exitCode: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  version?: string;
  lastChecked: Date;
}

export interface CodingAgentConfig {
  name: string;
  scriptPath: string;
  workspacePath: string;
  timeoutMs: number;
  maxOutputSize: number;
}

export interface CodingAgent {
  readonly name: string;

  execute(task: TaskInfo): Promise<ExecutionResult>;
  healthCheck(): Promise<HealthCheckResult>;
  getStatus(): Promise<CodingAgentStatus>;
  getName(): string;
  configure(config: Partial<CodingAgentConfig>): void;
}
