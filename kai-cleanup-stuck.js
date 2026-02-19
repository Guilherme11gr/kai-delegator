const { PrismaClient } = require('/workspace/repos/jt-kill/node_modules/@prisma/client');
require('dotenv').config({ path: '/workspace/repos/jt-kill/.env.local' });

const prisma = new PrismaClient();

const MAX_RUNNING_MINUTES = 45; // 45 min = considerada travada
const MAX_COMPLEX_MINUTES = 35; // 35 min para tasks complexas (DB, integrações)

async function cleanupStuckTasks() {
  console.log('🧹 Limpando tasks travadas...\n');

  const running = await prisma.kaiCommand.findMany({
    where: { status: 'RUNNING' },
    include: { task: { include: { project: true } } },
    orderBy: { updatedAt: 'asc' }
  });

  let cleaned = 0;
  let kept = 0;

  for (const cmd of running) {
    const minutesAgo = Math.floor((Date.now() - cmd.updatedAt.getTime()) / 60000);
    const taskKey = cmd.task.readableId || `${cmd.task.project.key}-${cmd.task.localId}`;
    const title = cmd.task.title.toLowerCase();
    
    console.log(`🔍 ${taskKey} - ${cmd.task.title}`);
    console.log(`   ⏱️  ${minutesAgo} min atrás`);

    // Verificar se é task complexa (DB, integration, API)
    const isComplex = title.includes('database') || 
                      title.includes('function') || 
                      title.includes('api') ||
                      title.includes('integration') ||
                      title.includes('supabase') ||
                      title.includes('pool');
    
    const maxMinutes = isComplex ? MAX_COMPLEX_MINUTES : MAX_RUNNING_MINUTES;
    const remaining = maxMinutes - minutesAgo;

    if (minutesAgo >= maxMinutes) {
      console.log(`   🔄 Resetando para PENDING (travada - ${isComplex ? 'complexa' : 'normal'})`);
      
      await prisma.kaiCommand.update({
        where: { id: cmd.id },
        data: {
          status: 'PENDING',
          output: `Resetada após ${minutesAgo}min (Kilo CLI travou/saiu sem output)`,
          updatedAt: new Date()
        }
      });
      
      cleaned++;
      console.log(`   ✅ Resetada\n`);
    } else {
      console.log(`   ✅ Mantendo RUNNING (${remaining}min restantes)\n`);
      kept++;
    }
  }

  console.log('================================');
  console.log(`📊 Resumo:`);
  console.log(`   🧹 Limpadas: ${cleaned}`);
  console.log(`   ✅ Mantidas: ${kept}\n`);

  await prisma.$disconnect();
}

cleanupStuckTasks().catch(console.error);
