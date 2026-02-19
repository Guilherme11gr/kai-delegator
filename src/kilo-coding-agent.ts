import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodingAgent,
  CodingAgentConfig,
  CodingAgentStatus,
  ExecutionResult,
  HealthCheckResult,
  TaskInfo,
} from './coding-agent-interface';

const execAsync = promisify(exec);

const DEFAULT_CONFIG: CodingAgentConfig = {
  name: 'kilo',
  scriptPath: '/workspace/main/kai-delegate-simple.sh',
  workspacePath: '/workspace/main',
  timeoutMs: 600000,
  maxOutputSize: 100000,
};

export class KiloCodingAgent implements CodingAgent {
  readonly name = 'kilo';
  private config: CodingAgentConfig;
  private currentStatus: CodingAgentStatus = 'idle';

  constructor(config: Partial<CodingAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getName(): string {
    return this.name;
  }

  configure(config: Partial<CodingAgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async getStatus(): Promise<CodingAgentStatus> {
    try {
      const health = await this.healthCheck();
      if (!health.healthy) {
        return 'unavailable';
      }
      return this.currentStatus;
    } catch {
      return 'error';
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const now = new Date();
    
    try {
      const { stdout } = await execAsync('npx @kilocode/cli --version', {
        timeout: 10000,
      });
      
      const version = stdout.trim();
      
      const scriptExists = fs.existsSync(this.config.scriptPath);
      if (!scriptExists) {
        return {
          healthy: false,
          message: `Script not found: ${this.config.scriptPath}`,
          version,
          lastChecked: now,
        };
      }

      return {
        healthy: true,
        message: 'Kilo CLI is available and ready',
        version,
        lastChecked: now,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        healthy: false,
        message: `Kilo CLI not available: ${errorMessage}`,
        lastChecked: now,
      };
    }
  }

  async execute(task: TaskInfo): Promise<ExecutionResult> {
    this.currentStatus = 'busy';
    
    try {
      const { stdout, stderr } = await execAsync(
        `bash ${this.config.scriptPath} ${task.taskKey}`,
        {
          cwd: this.config.workspacePath,
          timeout: this.config.timeoutMs,
          maxBuffer: this.config.maxOutputSize * 2,
          env: { ...process.env, PATH: process.env.PATH },
        }
      );

      const output = this.readHistoryFile(task.taskKey);
      const combinedOutput = this.truncateOutput(
        `${output}\n\n=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}`
      );

      const hasError = this.hasBuildError(combinedOutput) || 
                       (stderr && stderr.includes('error') && !stderr.includes('error TS'));

      this.currentStatus = 'idle';
      
      return {
        success: !hasError,
        output: combinedOutput,
        error: hasError ? 'Build or execution error detected' : undefined,
        branchName: task.branchName,
        exitCode: hasError ? 1 : 0,
      };
    } catch (error) {
      this.currentStatus = 'error';
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('timeout');
      
      return {
        success: false,
        output: '',
        error: isTimeout ? 'Execution timeout' : errorMessage,
        branchName: task.branchName,
        exitCode: 1,
      };
    }
  }

  private readHistoryFile(taskKey: string): string {
    try {
      const historyPath = path.join(
        this.config.workspacePath,
        '.kai-history',
        `${taskKey}.txt`
      );
      
      if (!fs.existsSync(historyPath)) {
        return '';
      }

      const stats = fs.statSync(historyPath);
      const readSize = Math.min(stats.size, this.config.maxOutputSize);
      const buffer = Buffer.alloc(readSize);
      const fd = fs.openSync(historyPath, 'r');
      const position = Math.max(0, stats.size - readSize);
      fs.readSync(fd, buffer, 0, readSize, position);
      fs.closeSync(fd);
      
      return buffer.toString('utf-8');
    } catch {
      return '';
    }
  }

  private truncateOutput(output: string): string {
    if (!output || output.length <= this.config.maxOutputSize) {
      return output;
    }
    return output.substring(output.length - this.config.maxOutputSize);
  }

  private hasBuildError(output: string): boolean {
    const buildErrorPatterns = [
      /Build error/i,
      /build failed/i,
      /Error:\s*Turbopack build failed/i,
      /Module not found/i,
      /Cannot find module/i,
      /Error:.*build/i,
    ];
    
    return buildErrorPatterns.some((pattern) => pattern.test(output || ''));
  }
}

export function createKiloCodingAgent(config?: Partial<CodingAgentConfig>): KiloCodingAgent {
  return new KiloCodingAgent(config);
}
