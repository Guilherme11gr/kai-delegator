const { PrismaClient } = require('/workspace/repos/jt-kill/node_modules/@prisma/client');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
require('dotenv').config({ path: '/workspace/repos/jt-kill/.env.local' });

const prisma = new PrismaClient();
const GITHUB_TOKEN = fs.readFileSync('/home/openclaw/.github_token', 'utf-8').trim();
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Cores
const colors = {
  green: '✅',
  yellow: '⏳',
  cyan: '🔄',
  red: '❌',
  magenta: '🎉'
};

async function getStatusReport() {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  
  // Buscar status
  const summary = await prisma.kaiCommand.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  const running = await prisma.kaiCommand.findMany({
    where: { status: 'RUNNING' },
    include: { task: true },
    orderBy: { updatedAt: 'asc' }
  });

  const pending = await prisma.kaiCommand.findMany({
    where: { status: 'PENDING' },
    include: { task: { include: { project: true } } },
    orderBy: { createdAt: 'asc' }
  });

  const completed = await prisma.kaiCommand.count({
    where: { status: 'COMPLETED' }
  });

  // Buscar PRs
  const { data: prs } = await octokit.rest.pulls.list({
    owner: 'Guilherme11gr',
    repo: 'jt-kill',
    state: 'open',
    sort: 'updated',
    per_page: 20
  });

  const kaiPRs = prs.filter(pr => pr.title.includes('Kai-') || pr.title.includes('KAI-'));

  // Verificar Kai Delegator
  const { stdout } = await new Promise(resolve => {
    require('child_process').exec('ps aux | grep kai-delegator | grep -v grep', (error, stdout) => {
      resolve({ stdout: stdout || '' });
    });
  });

  const isRunning = stdout.trim().length > 0;

  // Construir report
  let report = `📊 **KAI DELEGATION STATUS REPORT**
🕒 ${now}

`;

  // Kai Delegator status
  report += `🤖 **Kai Delegator:** ${isRunning ? '✅ RODANDO' : '❌ PARADO'}

`;

  // Resumo geral
  report += `📈 **RESUMO GERAL**
`;
  summary.forEach(item => {
    const icon = item.status === 'COMPLETED' ? colors.green :
                 item.status === 'RUNNING' ? colors.cyan :
                 item.status === 'PENDING' ? colors.yellow :
                 colors.red;
    report += `${icon} ${item.status}: ${item._count.status}\n`;
  });
  report += `
`;

  // Tasks rodando
  if (running.length > 0) {
    report += `🔄 **TASKS RODANDO (${running.length})**
`;
    running.slice(0, 5).forEach((cmd, idx) => {
      const taskKey = cmd.task.readableId || `JKILL-${cmd.task.localId}`;
      const minutes = Math.floor((Date.now() - cmd.updatedAt.getTime()) / 60000);
      const title = cmd.task.title.substring(0, 40);
      report += `${idx + 1}. ${taskKey} - ${title} (${minutes}min)\n`;
    });
    report += `
`;
  }

  // Fila
  if (pending.length > 0) {
    report += `⏳ **FILA (${pending.length})**
`;
    pending.slice(0, 5).forEach((cmd, idx) => {
      const taskKey = cmd.task.readableId || `${cmd.task.project.key}-${cmd.task.localId}`;
      const title = cmd.task.title.substring(0, 40);
      report += `${idx + 1}. ${taskKey} - ${title}\n`;
    });
    if (pending.length > 5) {
      report += `...e mais ${pending.length - 5} tasks\n`;
    }
    report += `
`;
  }

  // PRs
  if (kaiPRs.length > 0) {
    report += `📌 **PRs KAI (${kaiPRs.length})**
`;
    kaiPRs.slice(0, 5).forEach((pr, idx) => {
      const hoursAgo = Math.floor((Date.now() - new Date(pr.updated_at).getTime()) / 3600000);
      const title = pr.title.length > 40 ? pr.title.substring(0, 40) + '...' : pr.title;
      report += `${idx + 1}. ${title} (${hoursAgo}h)\n`;
      report += `   🔗 ${pr.html_url}\n`;
    });
    report += `
`;
  }

  // Resumo final
  report += `---
✅ Meta: 5-6 PRs até amanhã
🎯 Atualmente: ${completed} tasks completadas, ${kaiPRs.length} PRs criados
`;

  await prisma.$disconnect();

  return report;
}

// Main
getStatusReport()
  .then(report => console.log(report))
  .catch(error => {
    console.log(`❌ Erro: ${error.message}`);
    process.exit(1);
  });
