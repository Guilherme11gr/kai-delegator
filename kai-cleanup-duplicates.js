const { PrismaClient } = require('/workspace/repos/jt-kill/node_modules/@prisma/client');
require('dotenv').config({ path: '/workspace/repos/jt-kill/.env.local' });

const prisma = new PrismaClient();

async function cleanupDuplicateCommands() {
  console.log('🧹 Limpando KaiCommands duplicadas...\n');

  const allCommands = await prisma.kaiCommand.findMany({
    where: {
      status: { in: ['PENDING', 'RUNNING'] }
    },
    include: { task: { include: { project: true } } },
    orderBy: { createdAt: 'asc' }
  });

  if (allCommands.length === 0) {
    console.log('✅ Nenhuma KaiCommand encontrada.\n');
    await prisma.$disconnect();
    return;
  }

  const groupedByTask = new Map();
  
  for (const cmd of allCommands) {
    const taskId = cmd.taskId;
    if (!groupedByTask.has(taskId)) {
      groupedByTask.set(taskId, []);
    }
    groupedByTask.get(taskId).push(cmd);
  }

  let duplicatesRemoved = 0;
  let commandsKept = 0;

  for (const [taskId, commands] of groupedByTask) {
    if (commands.length <= 1) {
      commandsKept += commands.length;
      continue;
    }

    const taskKey = commands[0].task.readableId || 
      `${commands[0].task.project?.key || 'TASK'}-${commands[0].task.localId}`;
    
    console.log(`🔍 Task ${taskKey}: ${commands.length} comandos encontrados`);

    commands.sort((a, b) => {
      if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
      if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const keepCommand = commands[0];
    const toRemove = commands.slice(1);

    console.log(`   ✅ Mantendo: ${keepCommand.id.substring(0, 8)}... (${keepCommand.status})`);

    for (const cmd of toRemove) {
      console.log(`   🗑️  Removendo: ${cmd.id.substring(0, 8)}... (${cmd.status})`);
      
      await prisma.kaiCommand.delete({
        where: { id: cmd.id }
      });
      
      duplicatesRemoved++;
    }

    commandsKept++;
    console.log('');
  }

  console.log('================================');
  console.log('📊 Resumo:');
  console.log(`   🧹 Duplicatas removidas: ${duplicatesRemoved}`);
  console.log(`   ✅ Comandos mantidos: ${commandsKept}\n`);

  await prisma.$disconnect();
}

cleanupDuplicateCommands().catch(console.error);
