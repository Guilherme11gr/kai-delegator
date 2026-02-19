const { PrismaClient } = require('/workspace/repos/jt-kill/node_modules/@prisma/client');
const { execSync } = require('child_process');
require('dotenv').config({ path: '/workspace/repos/jt-kill/.env.local' });

const prisma = new PrismaClient();

async function cleanupOrphanTasks() {
  console.log('🧹 Limpando tasks órfãs (sem processo rodando)...\n');

  // Buscar todas as tasks RUNNING
  const running = await prisma.kaiCommand.findMany({
    where: { status: 'RUNNING' },
    include: { task: { include: { project: true } } }
  });

  if (running.length === 0) {
    console.log('✅ Nenhuma task RUNNING encontrada.\n');
    await prisma.$disconnect();
    return;
  }

  // Verificar se há processos Kilo rodando
  try {
    const output = execSync('ps aux | grep kilo | grep -v grep', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const hasKiloProcesses = output.trim().length > 0;

    console.log(`🔍 Tasks RUNNING: ${running.length}`);
    console.log(`🔍 Processos Kilo: ${hasKiloProcesses ? 'SIM' : 'NÃO'}\n`);

    // Se NÃO há processos Kilo rodando, resetar todas as tasks RUNNING
    if (!hasKiloProcesses) {
      console.log('⚠️  Nenhum processo Kilo encontrado!');
      console.log('🔄 Resetando todas as tasks RUNNING para PENDING...\n');

      let reseted = 0;
      for (const cmd of running) {
        const taskKey = cmd.task.readableId || `${cmd.task.project.key}-${cmd.task.localId}`;
        
        await prisma.kaiCommand.update({
          where: { id: cmd.id },
          data: {
            status: 'PENDING',
            output: 'Resetada: Processo Kilo não encontrado (órfã)',
            updatedAt: new Date()
          }
        });

        console.log(`   ✅ ${taskKey} resetada`);
        reseted++;
      }

      console.log(`\n📊 Resumo:`);
      console.log(`   🧹 Resetadas: ${reseted}`);
      console.log(`   ✅ Voltaram para PENDING\n`);
    } else {
      console.log('✅ Há processos Kilo rodando, mantendo tasks RUNNING.\n');
    }

  } catch (error) {
    console.log(`⚠️  Erro ao verificar processos: ${error.message}\n`);
    console.log('🔄 Assumindo que não há processos, resetando tasks RUNNING...\n');

    let reseted = 0;
    for (const cmd of running) {
      const taskKey = cmd.task.readableId || `${cmd.task.project.key}-${cmd.task.localId}`;
      
      await prisma.kaiCommand.update({
        where: { id: cmd.id },
        data: {
          status: 'PENDING',
          output: 'Resetada: Processo Kilo não encontrado (órfã)',
          updatedAt: new Date()
        }
      });

      console.log(`   ✅ ${taskKey} resetada`);
      reseted++;
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   🧹 Resetadas: ${reseted}`);
    console.log(`   ✅ Voltaram para PENDING\n`);
  }

  await prisma.$disconnect();
}

cleanupOrphanTasks().catch(console.error);
