import { CodingAgent, CodingAgentConfig } from './coding-agent-interface';
import { KiloCodingAgent, createKiloCodingAgent } from './kilo-coding-agent';

export type CodingAgentType = 'kilo' | 'bolt' | 'codeium' | 'custom';

export interface CodingAgentFactoryConfig {
  defaultAgent: CodingAgentType;
  agents: Record<string, Partial<CodingAgentConfig> | undefined>;
}

const DEFAULT_FACTORY_CONFIG: CodingAgentFactoryConfig = {
  defaultAgent: 'kilo',
  agents: {},
};

const agentRegistry = new Map<CodingAgentType, () => CodingAgent>([
  ['kilo', () => createKiloCodingAgent()],
]);

export function registerAgent(type: CodingAgentType, factory: () => CodingAgent): void {
  agentRegistry.set(type, factory);
}

export function createCodingAgent(
  type: CodingAgentType = 'kilo',
  config?: Partial<CodingAgentConfig>
): CodingAgent {
  const factory = agentRegistry.get(type);
  
  if (!factory) {
    throw new Error(`Unknown coding agent type: ${type}. Available types: ${Array.from(agentRegistry.keys()).join(', ')}`);
  }

  const agent = factory();
  
  if (config) {
    agent.configure(config);
  }
  
  return agent;
}

export function createCodingAgentFromConfig(
  factoryConfig: Partial<CodingAgentFactoryConfig> = {}
): CodingAgent {
  const config: CodingAgentFactoryConfig = {
    ...DEFAULT_FACTORY_CONFIG,
    ...factoryConfig,
  };

  const agentType = config.defaultAgent;
  const agentConfig = config.agents[agentType];

  return createCodingAgent(agentType, agentConfig);
}

export function getAvailableAgents(): CodingAgentType[] {
  return Array.from(agentRegistry.keys());
}

export function isAgentAvailable(type: CodingAgentType): boolean {
  return agentRegistry.has(type);
}

export { KiloCodingAgent, createKiloCodingAgent };
