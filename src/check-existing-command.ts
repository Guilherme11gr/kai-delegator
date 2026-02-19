import { KaiCommand, KaiCommandStatus } from './types';

export enum ExistingCommandAction {
  CREATE_NEW = 'CREATE_NEW',
  UPDATE_EXISTING = 'UPDATE_EXISTING',
  SKIP = 'SKIP',
}

export interface ExistingCommandResult {
  action: ExistingCommandAction;
  existingCommand: KaiCommand | null;
  reason: string;
}

export interface CheckExistingCommandRepository {
  findByTaskAndProject(taskId: string, projectId: string): Promise<KaiCommand | null>;
}

const REUSABLE_STATUSES: KaiCommandStatus[] = [
  KaiCommandStatus.FAILED,
  KaiCommandStatus.PENDING,
];

const BLOCKING_STATUSES: KaiCommandStatus[] = [
  KaiCommandStatus.COMPLETED,
  KaiCommandStatus.RUNNING,
];

export function checkExistingKaiCommand(
  existingCommand: KaiCommand | null
): ExistingCommandResult {
  if (!existingCommand) {
    return {
      action: ExistingCommandAction.CREATE_NEW,
      existingCommand: null,
      reason: 'No existing KaiCommand found for this task',
    };
  }

  const { status } = existingCommand;

  if (REUSABLE_STATUSES.includes(status)) {
    return {
      action: ExistingCommandAction.UPDATE_EXISTING,
      existingCommand,
      reason: `Existing KaiCommand found with status ${status}, will update to RUNNING`,
    };
  }

  if (BLOCKING_STATUSES.includes(status)) {
    return {
      action: ExistingCommandAction.SKIP,
      existingCommand,
      reason: `Existing KaiCommand found with status ${status}, cannot create new`,
    };
  }

  return {
    action: ExistingCommandAction.CREATE_NEW,
    existingCommand: null,
    reason: `Unknown status ${status}, will create new`,
  };
}

export async function findAndCheckExistingCommand(
  taskId: string,
  projectId: string,
  repository: CheckExistingCommandRepository
): Promise<ExistingCommandResult> {
  const existingCommand = await repository.findByTaskAndProject(taskId, projectId);
  return checkExistingKaiCommand(existingCommand);
}

export function isStatusReusable(status: KaiCommandStatus): boolean {
  return REUSABLE_STATUSES.includes(status);
}

export function isStatusBlocking(status: KaiCommandStatus): boolean {
  return BLOCKING_STATUSES.includes(status);
}
