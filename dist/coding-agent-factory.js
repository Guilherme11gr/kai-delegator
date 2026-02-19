"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKiloCodingAgent = exports.KiloCodingAgent = void 0;
exports.registerAgent = registerAgent;
exports.createCodingAgent = createCodingAgent;
exports.createCodingAgentFromConfig = createCodingAgentFromConfig;
exports.getAvailableAgents = getAvailableAgents;
exports.isAgentAvailable = isAgentAvailable;
const kilo_coding_agent_1 = require("./kilo-coding-agent");
Object.defineProperty(exports, "KiloCodingAgent", { enumerable: true, get: function () { return kilo_coding_agent_1.KiloCodingAgent; } });
Object.defineProperty(exports, "createKiloCodingAgent", { enumerable: true, get: function () { return kilo_coding_agent_1.createKiloCodingAgent; } });
const DEFAULT_FACTORY_CONFIG = {
    defaultAgent: 'kilo',
    agents: {},
};
const agentRegistry = new Map([
    ['kilo', () => (0, kilo_coding_agent_1.createKiloCodingAgent)()],
]);
function registerAgent(type, factory) {
    agentRegistry.set(type, factory);
}
function createCodingAgent(type = 'kilo', config) {
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
function createCodingAgentFromConfig(factoryConfig = {}) {
    const config = {
        ...DEFAULT_FACTORY_CONFIG,
        ...factoryConfig,
    };
    const agentType = config.defaultAgent;
    const agentConfig = config.agents[agentType];
    return createCodingAgent(agentType, agentConfig);
}
function getAvailableAgents() {
    return Array.from(agentRegistry.keys());
}
function isAgentAvailable(type) {
    return agentRegistry.has(type);
}
//# sourceMappingURL=coding-agent-factory.js.map