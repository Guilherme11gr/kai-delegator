import { KaiCommand, KaiCommandStatus } from './types';
export declare enum ExistingCommandAction {
    CREATE_NEW = "CREATE_NEW",
    UPDATE_EXISTING = "UPDATE_EXISTING",
    SKIP = "SKIP"
}
export interface ExistingCommandResult {
    action: ExistingCommandAction;
    existingCommand: KaiCommand | null;
    reason: string;
}
export interface CheckExistingCommandRepository {
    findByTaskAndProject(taskId: string, projectId: string): Promise<KaiCommand | null>;
}
export declare function checkExistingKaiCommand(existingCommand: KaiCommand | null): ExistingCommandResult;
export declare function findAndCheckExistingCommand(taskId: string, projectId: string, repository: CheckExistingCommandRepository): Promise<ExistingCommandResult>;
export declare function isStatusReusable(status: KaiCommandStatus): boolean;
export declare function isStatusBlocking(status: KaiCommandStatus): boolean;
//# sourceMappingURL=check-existing-command.d.ts.map