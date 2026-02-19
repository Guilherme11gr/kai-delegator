import { CodingAgent, CodingAgentConfig } from './coding-agent-interface';
import { KiloCodingAgent, createKiloCodingAgent } from './kilo-coding-agent';
export type CodingAgentType = 'kilo' | 'bolt' | 'codeium' | 'custom';
export interface CodingAgentFactoryConfig {
    defaultAgent: CodingAgentType;
    agents: Record<string, Partial<CodingAgentConfig> | undefined>;
}
export declare function registerAgent(type: CodingAgentType, factory: () => CodingAgent): void;
export declare function createCodingAgent(type?: CodingAgentType, config?: Partial<CodingAgentConfig>): CodingAgent;
export declare function createCodingAgentFromConfig(factoryConfig?: Partial<CodingAgentFactoryConfig>): CodingAgent;
export declare function getAvailableAgents(): CodingAgentType[];
export declare function isAgentAvailable(type: CodingAgentType): boolean;
export { KiloCodingAgent, createKiloCodingAgent };
//# sourceMappingURL=coding-agent-factory.d.ts.map