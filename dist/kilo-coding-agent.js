"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KiloCodingAgent = void 0;
exports.createKiloCodingAgent = createKiloCodingAgent;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const DEFAULT_CONFIG = {
    name: 'kilo',
    scriptPath: '/workspace/main/kai-delegate-simple.sh',
    workspacePath: '/workspace/main',
    timeoutMs: 600000,
    maxOutputSize: 100000,
};
class KiloCodingAgent {
    name = 'kilo';
    config;
    currentStatus = 'idle';
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    getName() {
        return this.name;
    }
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    async getStatus() {
        try {
            const health = await this.healthCheck();
            if (!health.healthy) {
                return 'unavailable';
            }
            return this.currentStatus;
        }
        catch {
            return 'error';
        }
    }
    async healthCheck() {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                healthy: false,
                message: `Kilo CLI not available: ${errorMessage}`,
                lastChecked: now,
            };
        }
    }
    async execute(task) {
        this.currentStatus = 'busy';
        try {
            const { stdout, stderr } = await execAsync(`bash ${this.config.scriptPath} ${task.taskKey}`, {
                cwd: this.config.workspacePath,
                timeout: this.config.timeoutMs,
                maxBuffer: this.config.maxOutputSize * 2,
                env: { ...process.env, PATH: process.env.PATH },
            });
            const output = this.readHistoryFile(task.taskKey);
            const combinedOutput = this.truncateOutput(`${output}\n\n=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}`);
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
        }
        catch (error) {
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
    readHistoryFile(taskKey) {
        try {
            const historyPath = path.join(this.config.workspacePath, '.kai-history', `${taskKey}.txt`);
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
        }
        catch {
            return '';
        }
    }
    truncateOutput(output) {
        if (!output || output.length <= this.config.maxOutputSize) {
            return output;
        }
        return output.substring(output.length - this.config.maxOutputSize);
    }
    hasBuildError(output) {
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
exports.KiloCodingAgent = KiloCodingAgent;
function createKiloCodingAgent(config) {
    return new KiloCodingAgent(config);
}
//# sourceMappingURL=kilo-coding-agent.js.map