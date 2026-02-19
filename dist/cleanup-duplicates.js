"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupCommandsByTask = groupCommandsByTask;
exports.sortCommandsByPriority = sortCommandsByPriority;
exports.selectCommandsToRemove = selectCommandsToRemove;
exports.formatTaskKey = formatTaskKey;
exports.cleanupDuplicateCommands = cleanupDuplicateCommands;
const types_1 = require("./types");
function groupCommandsByTask(commands) {
    const groupedByTask = new Map();
    for (const cmd of commands) {
        const taskId = cmd.taskId;
        if (!groupedByTask.has(taskId)) {
            groupedByTask.set(taskId, []);
        }
        groupedByTask.get(taskId).push(cmd);
    }
    return groupedByTask;
}
function sortCommandsByPriority(commands) {
    return commands.sort((a, b) => {
        if (a.status === types_1.KaiCommandStatus.RUNNING && b.status !== types_1.KaiCommandStatus.RUNNING)
            return -1;
        if (a.status !== types_1.KaiCommandStatus.RUNNING && b.status === types_1.KaiCommandStatus.RUNNING)
            return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}
function selectCommandsToRemove(commands) {
    const sorted = sortCommandsByPriority(commands);
    return {
        keep: sorted[0],
        remove: sorted.slice(1),
    };
}
function formatTaskKey(command) {
    return command.task.readableId ||
        `${command.task.project?.key || 'TASK'}-${command.task.localId}`;
}
async function cleanupDuplicateCommands(repository, logger = console.log) {
    logger('Limpando KaiCommands duplicadas...\n');
    const allCommands = await repository.findPendingAndRunning();
    if (allCommands.length === 0) {
        logger('Nenhuma KaiCommand encontrada.\n');
        await repository.disconnect();
        return { duplicatesRemoved: 0, commandsKept: 0 };
    }
    const groupedByTask = groupCommandsByTask(allCommands);
    let duplicatesRemoved = 0;
    let commandsKept = 0;
    for (const [, commands] of groupedByTask) {
        if (commands.length <= 1) {
            commandsKept += commands.length;
            continue;
        }
        const taskKey = formatTaskKey(commands[0]);
        logger(`Task ${taskKey}: ${commands.length} comandos encontrados`);
        const { keep, remove } = selectCommandsToRemove(commands);
        logger(`   Mantendo: ${keep.id.substring(0, 8)}... (${keep.status})`);
        for (const cmd of remove) {
            logger(`   Removendo: ${cmd.id.substring(0, 8)}... (${cmd.status})`);
            await repository.delete(cmd.id);
            duplicatesRemoved++;
        }
        commandsKept++;
        logger('');
    }
    logger('================================');
    logger('Resumo:');
    logger(`   Duplicatas removidas: ${duplicatesRemoved}`);
    logger(`   Comandos mantidos: ${commandsKept}\n`);
    await repository.disconnect();
    return { duplicatesRemoved, commandsKept };
}
//# sourceMappingURL=cleanup-duplicates.js.map