import 'dotenv/config';
import { PrismaClient } from '/workspace/repos/jt-kill/node_modules/@prisma/client';
import { cleanupDuplicateCommands, KaiCommandRepository } from './cleanup-duplicates';
import { KaiCommand, KaiCommandStatus, KaiCommandType } from './types';

const prisma = new PrismaClient();

function mapPrismaToKaiCommand(prismaCommand: {
  id: string;
  projectId: string;
  taskId: string;
  commandType: string;
  status: string;
  output: string | null;
  resultSummary: string | null;
  branchName: string | null;
  prUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  task: {
    id: string;
    readableId?: string | null;
    localId: number;
    title: string;
    project?: {
      id: string;
      key: string;
    } | null;
  };
}): KaiCommand {
  return {
    id: prismaCommand.id,
    projectId: prismaCommand.projectId,
    taskId: prismaCommand.taskId,
    commandType: prismaCommand.commandType as KaiCommandType,
    status: prismaCommand.status as KaiCommandStatus,
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

const repository: KaiCommandRepository = {
  findPendingAndRunning: async () => {
    const commands = await prisma.kaiCommand.findMany({
      where: {
        status: { in: [KaiCommandStatus.PENDING, KaiCommandStatus.RUNNING] }
      },
      include: { task: { include: { project: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return commands.map(cmd => mapPrismaToKaiCommand(cmd as Parameters<typeof mapPrismaToKaiCommand>[0]));
  },
  delete: async (id: string) => {
    await prisma.kaiCommand.delete({
      where: { id }
    });
  },
  disconnect: async () => {
    await prisma.$disconnect();
  }
};

cleanupDuplicateCommands(repository)
  .then(result => {
    process.exit(result.duplicatesRemoved > 0 ? 0 : 0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
