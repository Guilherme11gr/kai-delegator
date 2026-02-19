const fs = require('fs');
const path = require('path');

const LOG_FILE = '/workspace/main/kai-delegator.log';

/**
 * Analisa logs do Kai Delegator
 */
function analyzeLogs(options = {}) {
  const { tail = 100, level = null, filter = null } = options;

  if (!fs.existsSync(LOG_FILE)) {
    console.log('❌ Log file não encontrado:', LOG_FILE);
    return;
  }

  // Ler arquivo
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.trim().split('\n');

  // Pegar últimas N linhas
  const recentLines = tail ? lines.slice(-tail) : lines;

  console.log(`\n📊 ANÁLISE DE LOGS - Kai Delegator`);
  console.log(`   Total de linhas: ${lines.length}`);
  console.log(`   Mostrando: ${recentLines.length} últimas linhas\n`);

  // Filtrar por nível
  let filteredLines = recentLines;
  if (level) {
    const levelUpper = level.toUpperCase();
    filteredLines = recentLines.filter(line => line.includes(`[${levelUpper}]`));
  }

  // Filtrar por texto
  if (filter) {
    filteredLines = filteredLines.filter(line =>
      line.toLowerCase().includes(filter.toLowerCase())
    );
  }

  // Contar por nível
  const levelCounts = {};
  lines.forEach(line => {
    const match = line.match(/\[(DEBUG|INFO|WARN|ERROR)\]/);
    if (match) {
      const lvl = match[1];
      levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    }
  });

  // Stats
  console.log('📈 ESTADO ATUAL');
  console.log(`   ✅ INFO: ${levelCounts.INFO || 0}`);
  console.log(`   ⚠️  WARN: ${levelCounts.WARN || 0}`);
  console.log(`   ❌ ERROR: ${levelCounts.ERROR || 0}`);
  console.log(`   🔍 DEBUG: ${levelCounts.DEBUG || 0}\n`);

  // Mostrar logs filtrados
  if (filteredLines.length === 0) {
    console.log(`ℹ️  Nenhum log encontrado com os filtros aplicados.\n`);
  } else {
    console.log('📋 LOGS FILTRADOS');
    console.log('─'.repeat(80));

    filteredLines.forEach((line, index) => {
      // Formatar com cores
      let coloredLine = line;

      if (line.includes('[ERROR]')) {
        coloredLine = `\x1b[31m${line}\x1b[0m`; // Vermelho
      } else if (line.includes('[WARN]')) {
        coloredLine = `\x1b[33m${line}\x1b[0m`; // Amarelo
      } else if (line.includes('[INFO]')) {
        coloredLine = `\x1b[32m${line}\x1b[0m`; // Verde
      } else if (line.includes('[DEBUG]')) {
        coloredLine = `\x1b[36m${line}\x1b[0m`; // Ciano
      }

      console.log(`${String(index + 1).padStart(3)}. ${coloredLine}`);
    });

    console.log('─'.repeat(80));
  }

  // Detecção de problemas
  const errors = lines.filter(line => line.includes('[ERROR]'));
  const warnings = lines.filter(line => line.includes('[WARN]'));
  const timeouts = lines.filter(line => line.toLowerCase().includes('timeout'));

  console.log('\n⚠️  PROBLEMAS DETECTADOS');

  if (errors.length > 0) {
    console.log(`   ❌ Erros: ${errors.length}`);
    const uniqueErrors = [...new Set(errors.map(e => {
      const match = e.match(/:\s*(.+?)(?:\s*\||$)/);
      return match ? match[1].trim().substring(0, 80) : 'Erro desconhecido';
    }))];
    console.log('      Principais:');
    uniqueErrors.slice(0, 5).forEach(err => console.log(`      - ${err}`));
  } else {
    console.log('   ✅ Nenhum erro detectado');
  }

  if (warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${warnings.length}`);
  } else {
    console.log('   ✅ Nenhum warning detectado');
  }

  if (timeouts.length > 0) {
    console.log(`   ⏱️  Timeouts: ${timeouts.length}`);
  } else {
    console.log('   ✅ Nenhum timeout detectado');
  }

  console.log('\n');
}

// Parse CLI args
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
  if (arg.startsWith('--tail=')) {
    options.tail = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--level=')) {
    options.level = arg.split('=')[1];
  } else if (arg.startsWith('--filter=')) {
    options.filter = arg.split('=')[1];
  }
});

// Run
analyzeLogs(options);
