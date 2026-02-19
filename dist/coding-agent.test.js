"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kilo_coding_agent_1 = require("./kilo-coding-agent");
const coding_agent_factory_1 = require("./coding-agent-factory");
class MockCodingAgent {
    name = 'mock';
    config = {
        name: 'mock',
        scriptPath: '/mock/path',
        workspacePath: '/mock/workspace',
        timeoutMs: 60000,
        maxOutputSize: 10000,
    };
    getName() {
        return this.name;
    }
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    async execute(task) {
        return {
            success: true,
            output: `Mock execution for task ${task.taskKey}`,
            branchName: task.branchName,
            exitCode: 0,
        };
    }
    async healthCheck() {
        return {
            healthy: true,
            message: 'Mock agent is healthy',
            version: '1.0.0',
            lastChecked: new Date(),
        };
    }
    async getStatus() {
        return 'idle';
    }
}
describe('CodingAgent Interface Types', () => {
    describe('TaskInfo', () => {
        it('should have all required properties', () => {
            const task = {
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
            const result = {
                success: true,
                output: 'Build successful',
                branchName: 'kai/KAIDE-1',
                exitCode: 0,
            };
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });
        it('should represent a failed result', () => {
            const result = {
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
            const health = {
                healthy: true,
                message: 'Agent is healthy',
                version: '1.0.0',
                lastChecked: new Date(),
            };
            expect(health.healthy).toBe(true);
            expect(health.version).toBe('1.0.0');
        });
        it('should represent an unhealthy status', () => {
            const health = {
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
    let agent;
    beforeEach(() => {
        agent = new kilo_coding_agent_1.KiloCodingAgent({
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
        const agent = (0, kilo_coding_agent_1.createKiloCodingAgent)();
        expect(agent).toBeInstanceOf(kilo_coding_agent_1.KiloCodingAgent);
    });
    it('should accept custom configuration', () => {
        const agent = (0, kilo_coding_agent_1.createKiloCodingAgent)({ timeoutMs: 300000 });
        expect(agent).toBeInstanceOf(kilo_coding_agent_1.KiloCodingAgent);
    });
});
describe('CodingAgentFactory', () => {
    describe('createCodingAgent', () => {
        it('should create kilo agent by default', () => {
            const agent = (0, coding_agent_factory_1.createCodingAgent)();
            expect(agent.getName()).toBe('kilo');
        });
        it('should create kilo agent when specified', () => {
            const agent = (0, coding_agent_factory_1.createCodingAgent)('kilo');
            expect(agent.getName()).toBe('kilo');
        });
        it('should throw error for unknown agent type', () => {
            expect(() => (0, coding_agent_factory_1.createCodingAgent)('unknown')).toThrow('Unknown coding agent type: unknown');
        });
        it('should accept configuration', () => {
            const agent = (0, coding_agent_factory_1.createCodingAgent)('kilo', { timeoutMs: 300000 });
            expect(agent.getName()).toBe('kilo');
        });
    });
    describe('registerAgent', () => {
        it('should register a custom agent', () => {
            (0, coding_agent_factory_1.registerAgent)('custom', () => new MockCodingAgent());
            expect((0, coding_agent_factory_1.isAgentAvailable)('custom')).toBe(true);
            const agent = (0, coding_agent_factory_1.createCodingAgent)('custom');
            expect(agent.getName()).toBe('mock');
        });
    });
    describe('getAvailableAgents', () => {
        it('should return list of available agents', () => {
            const agents = (0, coding_agent_factory_1.getAvailableAgents)();
            expect(agents).toContain('kilo');
        });
    });
    describe('isAgentAvailable', () => {
        it('should return true for kilo', () => {
            expect((0, coding_agent_factory_1.isAgentAvailable)('kilo')).toBe(true);
        });
        it('should return false for unregistered agent', () => {
            expect((0, coding_agent_factory_1.isAgentAvailable)('nonexistent')).toBe(false);
        });
    });
    describe('createCodingAgentFromConfig', () => {
        it('should create agent from factory config', () => {
            const agent = (0, coding_agent_factory_1.createCodingAgentFromConfig)({
                defaultAgent: 'kilo',
            });
            expect(agent.getName()).toBe('kilo');
        });
        it('should use default config when not provided', () => {
            const agent = (0, coding_agent_factory_1.createCodingAgentFromConfig)();
            expect(agent.getName()).toBe('kilo');
        });
    });
});
describe('MockCodingAgent (interface compliance)', () => {
    let agent;
    beforeEach(() => {
        agent = new MockCodingAgent();
    });
    it('should implement execute method', async () => {
        const task = {
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
//# sourceMappingURL=coding-agent.test.js.map