import { CodingAgent, CodingAgentConfig, CodingAgentStatus, ExecutionResult, HealthCheckResult, TaskInfo } from './coding-agent-interface';
export declare class KiloCodingAgent implements CodingAgent {
    readonly name = "kilo";
    private config;
    private currentStatus;
    constructor(config?: Partial<CodingAgentConfig>);
    getName(): string;
    configure(config: Partial<CodingAgentConfig>): void;
    getStatus(): Promise<CodingAgentStatus>;
    healthCheck(): Promise<HealthCheckResult>;
    execute(task: TaskInfo): Promise<ExecutionResult>;
    private readHistoryFile;
    private truncateOutput;
    private hasBuildError;
}
export declare function createKiloCodingAgent(config?: Partial<CodingAgentConfig>): KiloCodingAgent;
//# sourceMappingURL=kilo-coding-agent.d.ts.map