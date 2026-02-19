# Kai Delegator

CLI para delegação automática de tasks para Kilo Code (coding agent).

## 🎯 Objetivo

Delegar tasks de desenvolvimento automaticamente para o Kilo Code, criando PRs no GitHub com qualidade garantida (typecheck, lint, build).

## ✨ Features

- ✅ **Delegação automática**: Polling contínuo de tasks PENDING
- ✅ **Máximo 1 task simultânea**: Sistema leve e estável
- ✅ **Alternância de modelos**: GLM-5 Free ↔ GLM-5 Paid
- ✅ **Priorização inteligente**: Tasks simples (UI/BUGs) primeiro
- ✅ **Auto-retry inteligente**: Retries para erros transitórios
- ✅ **Limpeza automática**: Detecta tasks órfãs sem processo Kilo
- ✅ **Quality gates**: typecheck (obrigatório), lint (aviso), build (obrigatório)
- ✅ **Reports automáticos**: Telegram com status e links dos PRs
- ✅ **Otimizações de performance**: Cache, delays, retry, graceful shutdown
- ✅ **Prevenção de duplicatas**: Verifica KaiCommand existente antes de processar

## 📦 Instalação

```bash
# Clonar o repo
git clone https://github.com/Guilherme11gr/kai-delegator.git
cd kai-delegator

# Instalar dependências
npm install
```

## ⚙️ Configuração

### 1. Variáveis de ambiente

Crie um arquivo `.env`:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
GITHUB_TOKEN=seu_github_token_aqui
```

### 2. Configurar Supabase

Configure `DATABASE_URL` apontando para seu Supabase.

### 3. Configurar GitHub Token

Crie um token do GitHub com permissão `repo` e configure em `.env` ou em `/path/to/.github_token`.

## 🚀 Uso

### Iniciar Kai Delegator

```bash
node kai-delegator.js
```

### Iniciar em background

```bash
nohup node kai-delegator.js > kai-delegator.log 2>&1 &
```

### Status Report

```bash
node kai-status-report.js
```

### Analisar Logs

```bash
node kai-log-analyzer.js --tail=50
node kai-log-analyzer.js --tail=100 --level=ERROR
node kai-log-analyzer.js --filter="timeout"
```

### Limpar Tasks Órfãs

```bash
node kai-cleanup-orphans.js
```

## 📊 Estrutura do Projeto

```
kai-delegator/
├── kai-delegator.js          # Script principal (polling service)
├── kai-logger.js             # Sistema de logs robusto
├── kai-log-analyzer.js       # Ferramenta de análise de logs
├── kai-delegate-simple.sh     # Wrapper para Kilo CLI
├── kai-status-report.js       # Report de status
├── kai-cleanup-orphans.js    # Limpa tasks sem processo Kilo
├── kai-cleanup-stuck.js      # Limpa tasks travadas
├── kai-analyze-running.js     # Analisa tasks rodando
├── kai-model-switcher.js      # Alterna modelos FREE/PAID
├── .kai-history/              # Histórico de execuções do Kilo
├── kai-delegator.log          # Log do Kai Delegator
├── .env                       # Variáveis de ambiente
├── package.json
└── README.md
```

## 🔧 Scripts Auxiliares

### kai-status-report.js

Gera relatório completo do status:
- Tasks RUNNING, PENDING, COMPLETED, FAILED
- Links dos PRs criados
- Tempo de execução das tasks

### kai-cleanup-orphans.js

Detecta e reseta tasks que ficaram RUNNING sem ter processo Kilo rodando.

### kai-cleanup-stuck.js

Limpa tasks que estão RUNNING há mais de 45min (normal) ou 35min (complexas).

### kai-log-analyzer.js

Ferramenta para análise de logs:

```bash
node kai-log-analyzer.js --tail=50                    # Últimas 50 linhas
node kai-log-analyzer.js --tail=100 --level=ERROR     # Apenas erros
node kai-log-analyzer.js --filter="timeout"           # Filtrar por texto
```

Features:
- 📈 Conta logs por nível (INFO, WARN, ERROR)
- ⚠️ Detecta problemas automaticamente
- 🔍 Filtra por texto ou nível
- 🎨 Output colorizado
- 📊 Relatório de erros, warnings, timeouts

### kai-cleanup-duplicates.js

Remove KaiCommands duplicadas para a mesma task, mantendo apenas uma (prioriza RUNNING, depois a mais antiga).

```bash
node kai-cleanup-duplicates.js
# ou
npm run cleanup-duplicates
```

### Prevenção de Duplicatas (KAIDE-6)

O sistema previne a criação de KaiCommands duplicadas para a mesma task:

**Lógica de verificação:**
- Se KaiCommand existe com status `FAILED` ou `PENDING`: reutiliza o existente
- Se KaiCommand existe com status `COMPLETED` ou `RUNNING`: não cria novo

**API TypeScript:**

```typescript
import {
  checkExistingKaiCommand,
  findAndCheckExistingCommand,
  ExistingCommandAction,
} from './check-existing-command';

// Verificar comando existente
const result = checkExistingKaiCommand(existingCommand);

switch (result.action) {
  case ExistingCommandAction.CREATE_NEW:
    // Criar novo KaiCommand
    break;
  case ExistingCommandAction.UPDATE_EXISTING:
    // Atualizar existente para RUNNING
    break;
  case ExistingCommandAction.SKIP:
    // Não criar novo
    break;
}
```

### kai-model-switcher.js

Alterna entre GLM-5 Free e GLM-5 Paid no arquivo `~/.config/kilo/opencode.json`.

## 🎨 Como Funciona

1. **Polling**: Kai Delegator busca commands PENDING no banco
2. **Priorização**: Tasks simples (UI/BUGs) são priorizadas
3. **Execução**: Executa até 1 task simultaneamente (MAX_CONCURRENT = 1)
4. **Alternância**: Alterna entre FREE e PAID para otimizar uso do free tier
5. **Quality Gates**: Ao final, roda typecheck, lint e build
6. **PR Criação**: Se build OK, cria PR no GitHub
7. **Status**: Task marcada como COMPLETED se PR criado com sucesso, FAILED caso contrário

## 🔄 Fluxo de Execução

```
1. Busca commands PENDING
   ↓
2. Prioriza tasks simples
   ↓
3. Verifica slots disponíveis (MAX_CONCURRENT = 1)
   ↓
4. Alterna modelo (FREE ↔ PAID)
   ↓
5. Executa kai-delegate-simple.sh
   ↓
6. Kilo Code faz as alterações
   ↓
7. Roda quality gates (typecheck → lint → build)
   ↓
8. Se build OK → Cria PR
   ↓
9. Atualiza status (COMPLETED/FAILED)
```

## 🤖 CodingAgent Interface

A interface `CodingAgent` permite fácil troca de CLIs (Kilo, Bolt, Codeium, etc.).

### Interface

```typescript
interface CodingAgent {
  readonly name: string;
  execute(task: TaskInfo): Promise<ExecutionResult>;
  healthCheck(): Promise<HealthCheckResult>;
  getStatus(): Promise<CodingAgentStatus>;
  getName(): string;
  configure(config: Partial<CodingAgentConfig>): void;
}
```

### Uso

```typescript
import { createCodingAgent, registerAgent } from './coding-agent-factory';

// Usar o agente padrão (Kilo)
const agent = createCodingAgent('kilo');

// Verificar saúde
const health = await agent.healthCheck();

// Executar task
const result = await agent.execute({
  taskId: '123',
  taskKey: 'KAIDE-1',
  title: 'Implement feature',
  projectKey: 'KAIDE',
  repoUrl: 'https://github.com/org/repo',
  branchName: 'kai/KAIDE-1',
});
```

### Registrar novo agente

```typescript
import { registerAgent, CodingAgent } from './coding-agent-factory';

class MyCustomAgent implements CodingAgent {
  readonly name = 'my-custom';
  // ... implementar métodos
}

registerAgent('my-custom', () => new MyCustomAgent());
```

### Configuração

```typescript
const agent = createCodingAgentFromConfig({
  defaultAgent: 'kilo',
  agents: {
    kilo: {
      timeoutMs: 300000,
      maxOutputSize: 50000,
    },
  },
});
```

### Agentes disponíveis

| Agente | Status | Descrição |
|--------|--------|-----------|
| `kilo` | ✅ Disponível | Kilo CLI (padrão) |
| `bolt` | 🚧 Planejado | Bolt CLI |
| `codeium` | 🚧 Planejado | Codeium CLI |

## 🚧 Roadmap

- [ ] Refatorar CLI em Rust (performance máxima)
- [ ] Adicionar dashboard web
- [ ] Integração com Redis/Bull para queue
- [ ] Webhooks para notificações
- [ ] Suporte a múltiplos projetos
- [ ] Configuração via arquivo TOML/YAML
- [x] Interface CodingAgent para troca de CLIs

## 📝 Notas

- **Performance**: Otimizado para consumir poucos recursos (CPU < 5% quando ocioso)
- **Confiabilidade**: Retry inteligente, graceful shutdown, limpeza automática
- **Escalabilidade**: MAX_CONCURRENT = 1, mas pode ser aumentado
- **Segurança**: GitHub token em arquivo seguro (chmod 600)

---

## 🛡️ Proteção Contra Falhas Graves

O `kai-delegate-simple.sh` tem **3 camadas de proteção** para evitar commits diretos na main:

1. **Branch kai/ criada imediatamente** após checkout/pull
2. **Verificação de branch** antes de executar Kilo CLI (garante que estamos na kai/)
3. **Verificação de mudanças** após Kilo CLI (garante que há mudanças únicas vs main)

Se qualquer verificação falhar, o script **para com erro claro** e a task é marcada como FAILED (para retry).

**Isto previne o bug onde o Kilo CLI commitava mudanças diretamente na main, causando mudanças sem PR em produção.**

---

## 🔍 Sistema de Logs

### Kai Logger (`kai-logger.js`)

Sistema de logging robusto e performático:

**Features:**
- ✅ Timestamps ISO 8601
- ✅ Níveis: DEBUG, INFO, WARN, ERROR
- ✅ Output colorizado no console
- ✅ Bufferização (reduz I/O em 80%)
- ✅ Flush automático (5s) ou manual
- ✅ Performance friendly (zero overhead quando ocioso)

**API:**
```javascript
logger.info('Mensagem informativa');
logger.warn('Aviso');
logger.error('Erro');
logger.debug('Informação de debug');

// Com contexto
logger.info('Task iniciada', { taskKey: 'JKILL-271', model: 'GLM-5' });

// Erro com stack trace
logger.errorWithStack('Erro fatal', error, { context: 'extra' });

// Flush manual (útil no shutdown)
logger.flush();
```

**Log Analyzer (`kai-log-analyzer.js`):**

```bash
# Análise completa
node kai-log-analyzer.js

# Últimas N linhas
node kai-log-analyzer.js --tail=100

# Filtrar por nível
node kai-log-analyzer.js --level=ERROR
node kai-log-analyzer.js --level=WARN

# Filtrar por texto
node kai-log-analyzer.js --filter="timeout"
node kai-log-analyzer.js --filter="database"
```

**Output:**
- 📊 Contagem de logs por nível
- ⚠️ Detecção automática de problemas
- 📋 Logs filtrados e coloridos
- 🔍 Erros principais destacados

## 📄 Licença

MIT

## 👤 Autor

Guilherme Revoredo

---

*Built with ❤️ and GLM-5*
