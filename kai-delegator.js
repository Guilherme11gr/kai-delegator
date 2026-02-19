const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');
const { Octokit } = require('@octokit/rest');

const envPath = path.join('/workspace/repos/jt-kill/.env.local');
dotenv.config({ path: envPath });

const prismaPath = path.join('/workspace/repos/jt-kill/node_modules/@prisma/client');
const prismaModule = require(prismaPath);

function buildDbUrlWithTimeout(originalUrl) {
  try {
    const url = new URL(originalUrl);
    url.searchParams.set('connect_timeout', '60');
    url.searchParams.set('pool_timeout', '60');
    return url.toString();
  } catch {
    return `${originalUrl}&connect_timeout=60&pool_timeout=60`;
  }
}

const prisma = new prismaModule.PrismaClient({
  datasources: {
    db: { url: buildDbUrlWithTimeout(process.env.DATABASE_URL) }
  },
  __internal: { engine: { connectionLimit: 2 } }
});

let GITHUB_TOKEN = null;
function getGitHubToken() {
  if (!GITHUB_TOKEN) {
    GITHUB_TOKEN = fs.readFileSync('/home/openclaw/.github_token', 'utf-8').trim();
  }
  return GITHUB_TOKEN;
}

const CONFIG = {
  POLL_INTERVAL_MS: 20000,
  MAX_CONCURRENT: 1,
  SCRIPT_PATH: '/workspace/main/kai-delegate-simple.sh',
  EXEC_TIMEOUT_MS: 600000,
  MAX_RETRIES: 3,
  QUERY_DELAY_MS: 100,
  DB_RETRY_DELAY_MS: 3000,
  DB_MAX_RETRIES: 3,
  RUNNING_COUNT_CACHE_TTL: 30000,
  LOG_BUFFER_SIZE: 10,
  MAX_OUTPUT_SIZE: 100000
};

const MODELS = {
  FREE: 'kilo/z-ai/glm-5:free',
  PAID: 'glm-5'
};

const BUILD_ERROR_PATTERNS = [
  /Build error/i,
  /build failed/i,
  /Error:\s*Turbopack build failed/i,
  /Module not found/i,
  /Cannot find module/i,
  /Error:.*build/i
];

const TRANSIENT_ERROR_PATTERNS = [
  /quota/i,
  /rate limit/i,
  /429/i,
  /timeout/i,
  /network error/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i
];

const STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

let activeDelegations = new Map();
let modelAlternator = 0;
let isShuttingDown = false;
let runningCountCache = { count: 0, timestamp: 0 };
let logBuffer = [];
let lastLogFlush = 0;
let configCache = null;

let octokitInstance = null;
function getOctokit() {
  if (!octokitInstance) {
    octokitInstance = new Octokit({ auth: getGitHubToken() });
  }
  return octokitInstance;
}

function flushLogs() {
  if (logBuffer.length === 0) return;
  const now = Date.now();
  if (logBuffer.length >= CONFIG.LOG_BUFFER_SIZE || (now - lastLogFlush) > 5000) {
    for (const log of logBuffer) {
      console.log(log);
    }
    logBuffer = [];
    lastLogFlush = now;
  }
}

function log(message, level = 'info') {
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  const logLine = `${new Date().toISOString()} ${prefix} Kai Delegator: ${message}`;
  
  if (level !== 'info' || message.includes('Falha') || message.includes('Erro') || message.includes('timeout')) {
    console.log(logLine);
  } else {
    logBuffer.push(logLine);
    flushLogs();
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, options = {}) {
  const { maxRetries = CONFIG.DB_MAX_RETRIES, delayMs = CONFIG.DB_RETRY_DELAY_MS, operationName = 'operation', silent = false } = options;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!silent && attempt === maxRetries) {
        log(`${operationName} falhou: ${error.message}`, 'warn');
      }
      if (attempt < maxRetries) {
        await delay(delayMs * attempt);
      }
    }
  }
  throw lastError;
}

const SIMPLE_TASK_PATTERNS = ['bug', '[ui]', '[design]'];
function isSimpleTask(title) {
  const lower = title.toLowerCase();
  return SIMPLE_TASK_PATTERNS.some(p => lower.includes(p));
}

async function getRunningCount() {
  const now = Date.now();
  if (runningCountCache.timestamp && (now - runningCountCache.timestamp) < CONFIG.RUNNING_COUNT_CACHE_TTL) {
    return runningCountCache.count;
  }
  
  const count = await withRetry(
    () => prisma.kaiCommand.count({ where: { status: STATUS.RUNNING } }),
    { operationName: 'Contar tasks RUNNING' }
  );
  
  runningCountCache = { count, timestamp: now };
  return count;
}

async function fetchPendingCommands() {
  try {
    const runningCount = await getRunningCount();
    const slotsAvailable = Math.max(0, CONFIG.MAX_CONCURRENT - runningCount);
    
    if (slotsAvailable === 0) {
      return { commands: [], runningCount, slotsAvailable: 0 };
    }

    const commands = await withRetry(
      () => prisma.kaiCommand.findMany({
        where: { status: STATUS.PENDING },
        select: {
          id: true,
          taskId: true,
          task: {
            select: {
              id: true,
              readableId: true,
              localId: true,
              title: true,
              project: {
                select: {
                  githubRepoUrl: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      { operationName: 'Buscar comandos PENDING' }
    );

    if (commands.length === 0) return { commands: [], runningCount, slotsAvailable };

    const prioritized = commands.sort((a, b) => {
      const aIsSimple = isSimpleTask(a.task.title);
      const bIsSimple = isSimpleTask(b.task.title);
      if (aIsSimple !== bIsSimple) return aIsSimple ? -1 : 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const selected = prioritized.slice(0, slotsAvailable);
    return { commands: selected, runningCount, slotsAvailable };
  } catch (error) {
    log(`Erro ao buscar comandos: ${error.message}`, 'error');
    return { commands: [], runningCount: CONFIG.MAX_CONCURRENT, slotsAvailable: 0 };
  }
}

function getNextModelIndex() {
  const current = modelAlternator;
  modelAlternator = (modelAlternator + 1) % 2;
  return current;
}

async function alternateModel() {
  const modelIndex = getNextModelIndex();
  const model = modelIndex === 0 ? MODELS.FREE : MODELS.PAID;
  const modelName = modelIndex === 0 ? 'FREE' : 'PAGO';

  try {
    const configPath = path.join(process.env.HOME, '.config/kilo/opencode.json');
    
    if (!configCache || configCache.model !== model) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.model = model;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      configCache = config;
    }

    log(`Modelo: ${modelName}`);
  } catch (error) {
    log(`Erro ao alternar modelo: ${error.message}`, 'error');
  }
}

function extractKaiDescription(output) {
  if (!output) return 'Implementação automatizada via Kilo CLI.';

  const patterns = [
    /(?:What I did|O que fiz|Changes|Mudanças)[:\s]*([^\n]+(?:\n[^#\n]*){0,5})/i,
    /#?\s*(?:Todos|Done|Summary|Resumo)[^\n]*\n((?:[^\n]+\n){0,5})/i
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) return match[1].trim().substring(0, 500);
  }

  const checkmarks = output.match(/[✓✅]\s+[^\n]+(?:\n[✓✅]\s+[^\n]*){0,3}/g);
  if (checkmarks) return checkmarks.join('\n').substring(0, 500);

  const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('> code') && !l.startsWith('$'));
  if (lines.length > 0) return lines.slice(0, 5).join('\n').substring(0, 500);

  return 'Implementação automatizada via Kilo CLI.';
}

async function createPullRequest(repo, branchName, taskTitle, taskReadableId, kaiDescription) {
  const match = repo.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    log(`URL do repo inválida: ${repo}`, 'error');
    return null;
  }

  const [, owner, repoName] = match;

  const prBody = `## Task
${taskTitle}

## O que foi feito
${kaiDescription || 'Implementação automatizada via Kilo CLI.'}

---

🤖 *Automated by Kai Delegation*`;

  try {
    const response = await getOctokit().rest.pulls.create({
      owner,
      repo: repoName,
      title: `Kai-${taskReadableId}: ${taskTitle}`,
      head: branchName,
      base: 'main',
      body: prBody
    });

    log(`PR criado: ${response.data.html_url}`);
    return response.data.html_url;
  } catch (error) {
    log(`Erro ao criar PR: ${error.message}`, 'error');
    return null;
  }
}

function updateCommandStatus(commandId, data) {
  runningCountCache = { count: 0, timestamp: 0 };
  
  return withRetry(
    () => prisma.kaiCommand.update({
      where: { id: commandId },
      data: { ...data, updatedAt: new Date() }
    }),
    { operationName: `Atualizar comando ${commandId}` }
  );
}

function hasBuildError(output) {
  return BUILD_ERROR_PATTERNS.some(pattern => pattern.test(output || ''));
}

function shouldAutoRetry(output, resultSummary) {
  const text = `${output || ''} ${resultSummary || ''}`;
  const isTransient = TRANSIENT_ERROR_PATTERNS.some(pattern => pattern.test(text));
  const isBuildError = (resultSummary || '').toLowerCase().includes('build');
  return isTransient && !isBuildError;
}

function execCommand(scriptPath, taskKey) {
  return new Promise((resolve) => {
    exec(`bash ${scriptPath} ${taskKey}`, {
      cwd: '/workspace/main',
      timeout: CONFIG.EXEC_TIMEOUT_MS,
      env: { ...process.env, PATH: process.env.PATH }
    }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error });
    });
  });
}

function truncateOutput(output, maxSize = CONFIG.MAX_OUTPUT_SIZE) {
  if (!output || output.length <= maxSize) return output;
  return output.substring(output.length - maxSize);
}

async function executeDelegation(command) {
  const { taskId, id: commandId, task } = command;
  const taskKey = task.readableId || `JKILL-${task.localId || taskId.substring(0, 8)}`;
  const branchName = `kai/${taskKey}`;

  try {
    await updateCommandStatus(commandId, { status: STATUS.RUNNING, branchName });
    await alternateModel();

    const { stdout, stderr, error: execError } = await execCommand(CONFIG.SCRIPT_PATH, taskKey);
    
    const historyPath = path.join('/workspace/main/.kai-history', `${taskKey}.txt`);
    let output = '';
    
    try {
      if (fs.existsSync(historyPath)) {
        const fd = fs.openSync(historyPath, 'r');
        const stats = fs.fstatSync(fd);
        const readSize = Math.min(stats.size, CONFIG.MAX_OUTPUT_SIZE);
        const buffer = Buffer.alloc(readSize);
        const position = Math.max(0, stats.size - readSize);
        fs.readSync(fd, buffer, 0, readSize, position);
        fs.closeSync(fd);
        output = buffer.toString('utf-8');
      }
    } catch {
      output = '';
    }

    if (stdout) output += `\n\n=== STDOUT ===\n${truncateOutput(stdout)}`;
    if (stderr) output += `\n\n=== STDERR ===\n${truncateOutput(stderr)}`;

    const kaiDescription = extractKaiDescription(output);

    let finalStatus = STATUS.FAILED;
    let resultSummary = 'Delegação iniciada';
    let prUrl = null;
    let failureReason = '';

    if (execError && execError.killed) {
      failureReason = 'Timeout - execução excedeu limite de tempo';
    } else if (hasBuildError(output)) {
      failureReason = 'Build falhou - corrigir dependências ou erros de código';
    } else if (stderr && stderr.includes('error') && !stderr.includes('error TS')) {
      failureReason = 'Erros críticos durante execução';
    } else if (task.project.githubRepoUrl) {
      prUrl = await createPullRequest(task.project.githubRepoUrl, branchName, task.title, taskKey, kaiDescription);

      if (prUrl) {
        finalStatus = STATUS.COMPLETED;
        resultSummary = 'Delegação concluída e PR criada!';
      } else {
        failureReason = 'Falha ao criar PR';
      }
    } else {
      failureReason = 'URL do repositório não configurada';
    }

    if (finalStatus === STATUS.FAILED) {
      resultSummary = `Falha: ${failureReason}`;
    }

    await updateCommandStatus(commandId, {
      status: finalStatus,
      output: truncateOutput(output),
      resultSummary,
      branchName,
      prUrl
    });

    if (finalStatus === STATUS.FAILED && shouldAutoRetry(output, resultSummary)) {
      const retryCount = parseInt(output?.match(/Re-tentando \((\d+)\/3\)/)?.[1] || '0');

      if (retryCount < CONFIG.MAX_RETRIES) {
        await updateCommandStatus(commandId, {
          status: STATUS.PENDING,
          output: `Re-tentando (${retryCount + 1})/3 - Auto-retry: ${resultSummary}`
        });
        return;
      }
    }

  } catch (error) {
    log(`Erro ao executar delegação ${taskKey}: ${error.message}`, 'error');
    try {
      await updateCommandStatus(commandId, {
        status: STATUS.FAILED,
        output: truncateOutput(error.message),
        resultSummary: 'Erro durante execução'
      });
    } catch {}
  } finally {
    activeDelegations.delete(taskId);
    
    if (global.gc) {
      try {
        global.gc();
      } catch {}
    }
  }
}

async function main() {
  log('Kai Delegator iniciado (optimized)');

  while (!isShuttingDown) {
    try {
      const { commands, runningCount, slotsAvailable } = await fetchPendingCommands();

      if (slotsAvailable > 0 && commands.length > 0) {
        for (const cmd of commands) {
          if (isShuttingDown) break;
          
          if (activeDelegations.has(cmd.taskId)) {
            continue;
          }

          const promise = executeDelegation(cmd);
          activeDelegations.set(cmd.taskId, promise);
          await promise;
        }
      }

    } catch (error) {
      log(`Erro no loop: ${error.message}`, 'error');
      await delay(CONFIG.DB_RETRY_DELAY_MS);
    }

    await delay(CONFIG.POLL_INTERVAL_MS);
  }
  
  flushLogs();
}

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  log(`Recebido ${signal}, encerrando...`);
  
  if (activeDelegations.size > 0) {
    try {
      await Promise.race([
        Promise.all(Array.from(activeDelegations.values())),
        new Promise(resolve => setTimeout(resolve, 30000))
      ]);
    } catch {}
  }
  
  try {
    await prisma.$disconnect();
  } catch {}
  
  flushLogs();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

main().catch(error => {
  log(`Erro fatal: ${error.message}`, 'error');
  process.exit(1);
});
