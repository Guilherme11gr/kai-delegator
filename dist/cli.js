"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("/workspace/repos/jt-kill/node_modules/@prisma/client");
const cleanup_duplicates_1 = require("./cleanup-duplicates");
const types_1 = require("./types");
const prisma = new client_1.PrismaClient();
function mapPrismaToKaiCommand(prismaCommand) {
    return {
        id: prismaCommand.id,
        projectId: prismaCommand.projectId,
        taskId: prismaCommand.taskId,
        commandType: prismaCommand.commandType,
        status: prismaCommand.status,
        output: prismaCommand.output,
        resultSummary: prismaCommand.resultSummary,
        branchName: prismaCommand.branchName,
        prUrl: prismaCommand.prUrl,
        createdAt: prismaCommand.createdAt,
        updatedAt: prismaCommand.updatedAt,
        task: {
            id: prismaCommand.task.id,
            readableId: prismaCommand.task.readableId ?? null,
            localId: prismaCommand.task.localId,
            title: prismaCommand.task.title,
            project: prismaCommand.task.project ?? null,
        },
    };
}
const repository = {
    findPendingAndRunning: async () => {
        const commands = await prisma.kaiCommand.findMany({
            where: {
                status: { in: [types_1.KaiCommandStatus.PENDING, types_1.KaiCommandStatus.RUNNING] }
            },
            include: { task: { include: { project: true } } },
            orderBy: { createdAt: 'asc' }
        });
        return commands.map(cmd => mapPrismaToKaiCommand(cmd));
    },
    delete: async (id) => {
        await prisma.kaiCommand.delete({
            where: { id }
        });
    },
    disconnect: async () => {
        await prisma.$disconnect();
    }
};
(0, cleanup_duplicates_1.cleanupDuplicateCommands)(repository)
    .then(result => {
    process.exit(result.duplicatesRemoved > 0 ? 0 : 0);
})
    .catch(error => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map