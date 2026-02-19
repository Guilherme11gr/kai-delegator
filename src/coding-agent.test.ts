import {
  CodingAgentStatus,
  TaskInfo,
  ExecutionResult,
  HealthCheckResult,
  CodingAgent,
  CodingAgentConfig,
} from './coding-agent-interface';
import { KiloCodingAgent, createKiloCodingAgent } from './kilo-coding-agent';
import {
  createCodingAgent,
  createCodingAgentFromConfig,
  registerAgent,
  getAvailableAgents,
  isAgentAvailable,
  CodingAgentType,
} from './coding-agent-factory';

class MockCodingAgent implements CodingAgent {
  readonly name = 'mock';
  private config: CodingAgentConfig = {
    name: 'mock',
    scriptPath: '/mock/path',
    workspacePath: '/mock/workspace',
    timeoutMs: 60000,
    maxOutputSize: 10000,
  };

  getName(): string {
    return this.name;
  }

  configure(config: Partial<CodingAgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async execute(task: TaskInfo): Promise<ExecutionResult> {
    return {
      success: true,
      output: `Mock execution for task ${task.taskKey}`,
      branchName: task.branchName,
      exitCode: 0,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      message: 'Mock agent is healthy',
      version: '1.0.0',
      lastChecked: new Date(),
    };
  }

  async getStatus(): Promise<CodingAgentStatus> {
    return 'idle';
  }
}

describe('CodingAgent Interface Types', () => {
  describe('TaskInfo', () => {
    it('should have all required properties', () => {
      const task: TaskInfo = {
        taskId: 'task-123',
        taskKey: 'KAIDE-1',
        title: 'Test task',
        projectKey: 'KAIDE',
        repoUrl: 'https://github.com/test/repo',
        branchName: 'kai/KAIDE-1',
      };

      expect(task.taskId).toBe('task-123');
      expect(task.taskKey).toBe('KAIDE-1');
      expect(task.title).toBe('Test task');
      expect(task.projectKey).toBe('KAIDE');
      expect(task.repoUrl).toBe('https://github.com/test/repo');
      expect(task.branchName).toBe('kai/KAIDE-1');
    });
  });

  describe('ExecutionResult', () => {
    it('should represent a successful result', () => {
      const result: ExecutionResult = {
        success: true,
        output: 'Build successful',
        branchName: 'kai/KAIDE-1',
        exitCode: 0,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should represent a failed result', () => {
      const result: ExecutionResult = {
        success: false,
        output: 'Build failed',
        error: 'TypeScript error',
        branchName: 'kai/KAIDE-1',
        exitCode: 1,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('TypeScript error');
    });
  });

  describe('HealthCheckResult', () => {
    it('should represent a healthy status', () => {
      const health: HealthCheckResult = {
        healthy: true,
        message: 'Agent is healthy',
        version: '1.0.0',
        lastChecked: new Date(),
      };

      expect(health.healthy).toBe(true);
      expect(health.version).toBe('1.0.0');
    });

    it('should represent an unhealthy status', () => {
      const health: HealthCheckResult = {
        healthy: false,
        message: 'Agent is not available',
        lastChecked: new Date(),
      };

      expect(health.healthy).toBe(false);
      expect(health.version).toBeUndefined();
    });
  });
});

describe('KiloCodingAgent', () => {
  let agent: KiloCodingAgent;

  beforeEach(() => {
    agent = new KiloCodingAgent({
      scriptPath: '/nonexistent/script.sh',
      workspacePath: '/nonexistent/workspace',
    });
  });

  describe('getName', () => {
    it('should return kilo', () => {
      expect(agent.getName()).toBe('kilo');
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      agent.configure({ timeoutMs: 300000 });
      expect(agent).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return health check result', async () => {
      const health = await agent.healthCheck();
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.message).toBe('string');
      expect(health.lastChecked).toBeInstanceOf(Date);
    }, 15000);

    it('should include version when CLI is available', async () => {
      const health = await agent.healthCheck();
      if (health.healthy) {
        expect(health.version).toBeDefined();
      }
    }, 15000);
  });

  describe('getStatus', () => {
    it('should return a valid status', async () => {
      const status = await agent.getStatus();
      expect(['idle', 'busy', 'error', 'unavailable']).toContain(status);
    }, 15000);
  });
});

describe('createKiloCodingAgent', () => {
  it('should create a KiloCodingAgent instance', () => {
    const agent = createKiloCodingAgent();
    expect(agent).toBeInstanceOf(KiloCodingAgent);
  });

  it('should accept custom configuration', () => {
    const agent = createKiloCodingAgent({ timeoutMs: 300000 });
    expect(agent).toBeInstanceOf(KiloCodingAgent);
  });
});

describe('CodingAgentFactory', () => {
  describe('createCodingAgent', () => {
    it('should create kilo agent by default', () => {
      const agent = createCodingAgent();
      expect(agent.getName()).toBe('kilo');
    });

    it('should create kilo agent when specified', () => {
      const agent = createCodingAgent('kilo');
      expect(agent.getName()).toBe('kilo');
    });

    it('should throw error for unknown agent type', () => {
      expect(() => createCodingAgent('unknown' as CodingAgentType)).toThrow(
        'Unknown coding agent type: unknown'
      );
    });

    it('should accept configuration', () => {
      const agent = createCodingAgent('kilo', { timeoutMs: 300000 });
      expect(agent.getName()).toBe('kilo');
    });
  });

  describe('registerAgent', () => {
    it('should register a custom agent', () => {
      registerAgent('custom', () => new MockCodingAgent());
      
      expect(isAgentAvailable('custom')).toBe(true);
      
      const agent = createCodingAgent('custom');
      expect(agent.getName()).toBe('mock');
    });
  });

  describe('getAvailableAgents', () => {
    it('should return list of available agents', () => {
      const agents = getAvailableAgents();
      expect(agents).toContain('kilo');
    });
  });

  describe('isAgentAvailable', () => {
    it('should return true for kilo', () => {
      expect(isAgentAvailable('kilo')).toBe(true);
    });

    it('should return false for unregistered agent', () => {
      expect(isAgentAvailable('nonexistent' as CodingAgentType)).toBe(false);
    });
  });

  describe('createCodingAgentFromConfig', () => {
    it('should create agent from factory config', () => {
      const agent = createCodingAgentFromConfig({
        defaultAgent: 'kilo',
      });
      
      expect(agent.getName()).toBe('kilo');
    });

    it('should use default config when not provided', () => {
      const agent = createCodingAgentFromConfig();
      expect(agent.getName()).toBe('kilo');
    });
  });
});

describe('MockCodingAgent (interface compliance)', () => {
  let agent: MockCodingAgent;

  beforeEach(() => {
    agent = new MockCodingAgent();
  });

  it('should implement execute method', async () => {
    const task: TaskInfo = {
      taskId: 'task-123',
      taskKey: 'TEST-1',
      title: 'Test task',
      projectKey: 'TEST',
      repoUrl: 'https://github.com/test/repo',
      branchName: 'kai/TEST-1',
    };

    const result = await agent.execute(task);
    expect(result.success).toBe(true);
    expect(result.branchName).toBe('kai/TEST-1');
  });

  it('should implement healthCheck method', async () => {
    const health = await agent.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.version).toBe('1.0.0');
  });

  it('should implement getStatus method', async () => {
    const status = await agent.getStatus();
    expect(status).toBe('idle');
  });

  it('should implement getName method', () => {
    expect(agent.getName()).toBe('mock');
  });

  it('should implement configure method', () => {
    agent.configure({ timeoutMs: 5000 });
    expect(agent).toBeDefined();
  });
});
