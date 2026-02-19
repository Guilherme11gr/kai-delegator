const { PrismaClient } = require('/workspace/repos/jt-kill/node_modules/@prisma/client');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '/workspace/repos/jt-kill/.env.local' });

const prisma = new PrismaClient();

// Configurações
const KAI_CONFIG_PATH = path.join(process.env.HOME, '.config/kilo/opencode.json');
const QUOTA_PATTERNS = /quota|429|rate limit|limit exceeded|token limit/i;

// Modelos disponíveis (ordem de prioridade) - SEMPRE GLM-5!
const MODELS = {
  GLM5_FREE: 'kilo/z-ai/glm-5:free',
  GLM5_PAID: 'glm-5'
};

const MODEL_SEQUENCE = [MODELS.GLM5_FREE, MODELS.GLM5_PAID];

// Função de log
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Obter modelo atual do config
function getCurrentModel() {
  try {
    const config = JSON.parse(fs.readFileSync(KAI_CONFIG_PATH, 'utf-8'));
    return config.model || MODELS.GLM5_FREE;
  } catch (error) {
    log(`Erro ao ler config: ${error.message}`);
    return MODELS.GLM5_FREE;
  }
}

// Definir novo modelo
async function setModel(model) {
  try {
    const config = JSON.parse(fs.readFileSync(KAI_CONFIG_PATH, 'utf-8'));
    config.model = model;
    fs.writeFileSync(KAI_CONFIG_PATH, JSON.stringify(config, null, 2));
    log(`✅ Modelo alterado para: ${model}`);
    return true;
  } catch (error) {
    log(`❌ Erro ao alterar modelo: ${error.message}`);
    return false;
  }
}

// Verificar se há erro de quota no output
function hasQuotaError(output) {
  if (!output) return false;
  return QUOTA_PATTERNS.test(output || '');
}

// Obter próximo modelo na sequência
function getNextModel(currentModel) {
  const currentIndex = MODEL_SEQUENCE.indexOf(currentModel);
  if (currentIndex === -1) {
    return MODEL_SEQUENCE[0]; // Se não encontrar, volta para o primeiro
  }

  const nextIndex = (currentIndex + 1) % MODEL_SEQUENCE.length;
  return MODEL_SEQUENCE[nextIndex];
}

// Processar KaiCommand falhada com erro de quota
async function handleQuotaError(commandId) {
  log(`🔄 Processando erro de quota para KaiCommand: ${commandId}`);

  const command = await prisma.kaiCommand.findUnique({
    where: { id: commandId },
    include: { task: true }
  });

  if (!command) {
    log(`❌ KaiCommand não encontrada: ${commandId}`);
    return;
  }

  log(`📋 Task: ${command.task.title}`);
  log(`📄 Output: ${command.output?.substring(0, 200)}...`);

  // Verificar se é erro de quota
  if (!hasQuotaError(command.output)) {
    log('⚠️  Não é erro de quota, saindo...');
    return;
  }

  // Obter modelo atual
  const currentModel = getCurrentModel();
  log(`📋 Modelo atual: ${currentModel}`);

  // Obter próximo modelo
  const nextModel = getNextModel(currentModel);
  log(`🔄 Próximo modelo: ${nextModel}`);

  // Alternar modelo
  const success = await setModel(nextModel);
  if (!success) {
    log('❌ Falha ao alterar modelo');
    return;
  }

  // Atualizar KaiCommand para PENDING (para re-executar)
  await prisma.kaiCommand.update({
    where: { id: commandId },
    data: {
      status: 'PENDING',
      output: `Reprocessando com novo modelo: ${nextModel}`
    }
  });

  log(`✅ KaiCommand ${command.id} marcada para re-execução com ${nextModel}`);
}

// Monitorar KaiCommands FAILED com erro de quota
async function monitorQuotaErrors() {
  log('🔍 Buscando KaiCommands com erro de quota...');

  const failedCommands = await prisma.kaiCommand.findMany({
    where: { status: 'FAILED' },
    include: { task: true },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });

  let processed = 0;

  for (const cmd of failedCommands) {
    // Verificar se é erro de quota
    if (hasQuotaError(cmd.output)) {
      log(`\n🔄 Processando: ${cmd.task.title}`);
      await handleQuotaError(cmd.id);
      processed++;
    }
  }

  if (processed === 0) {
    log('✅ Nenhum erro de quota encontrado');
  } else {
    log(`\n✅ Processadas ${processed} KaiCommands com erro de quota`);
  }

  await prisma.$disconnect();
}

// Mostrar status
async function showStatus() {
  log('📊 Status do Kai Model Switcher');
  log('================================');

  const currentModel = getCurrentModel();
  const nextModel = getNextModel(currentModel);

  log(`📋 Modelo atual: ${currentModel}`);
  log(`🔄 Próximo modelo: ${nextModel}`);
  log(`📝 Config: ${KAI_CONFIG_PATH}`);

  log('\n🔥 Sequência de modelos (SEMPRE GLM-5!):');
  MODEL_SEQUENCE.forEach((model, idx) => {
    const marker = model === currentModel ? ' ← ATUAL' : '';
    log(`   ${idx + 1}. ${model}${marker}`);
  });

  // Contar KaiCommands por status
  const summary = await prisma.kaiCommand.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  log('\n📊 KaiCommands:');
  summary.forEach(item => {
    const icon = item.status === 'COMPLETED' ? '✅' :
                 item.status === 'RUNNING' ? '🔄' :
                 item.status === 'PENDING' ? '⏳' :
                 item.status === 'FAILED' ? '❌' : '❓';
    log(`   ${icon} ${item.status}: ${item._count.status}`);
  });
  log('================================\n');

  await prisma.$disconnect();
}

// Main
const action = process.argv[2] || 'status';

(async () => {
  try {
    switch (action) {
      case 'status':
        await showStatus();
        break;
      case 'monitor':
        await monitorQuotaErrors();
        break;
      case 'set':
        const model = process.argv[3];
        if (!model) {
          console.log('❌ Uso: node kai-model-switcher.js set <model>');
          console.log('   Exemplo: node kai-model-switcher.js set glm-5');
          process.exit(1);
        }
        const success = await setModel(model);
        if (success) {
          console.log('✅ Modelo alterado com sucesso!');
        } else {
          console.log('❌ Falha ao alterar modelo');
          process.exit(1);
        }
        await prisma.$disconnect();
        break;
      default:
        console.log(`❌ Comando desconhecido: ${action}`);
        console.log('\nUso:');
        console.log('   node kai-model-switcher.js status   - Mostrar status');
        console.log('   node kai-model-switcher.js set <model> - Definir modelo');
        console.log('   node kai-model-switcher.js monitor - Monitorar e corrigir erros de quota');
        console.log('\n🔥 Modelos disponíveis (SEMPRE GLM-5!):');
        console.log(`   ${MODELS.GLM5_FREE} (GLM-5 Free - Padrão)`);
        console.log(`   ${MODELS.GLM5_PAID} (GLM-5 Pago - Fallback do Zai)`);
        process.exit(1);
    }
  } catch (error) {
    log(`❌ Erro: ${error.message}`);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
