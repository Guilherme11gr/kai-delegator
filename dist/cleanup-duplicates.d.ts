import { KaiCommand, CleanupResult } from './types';
export declare function groupCommandsByTask(commands: KaiCommand[]): Map<string, KaiCommand[]>;
export declare function sortCommandsByPriority(commands: KaiCommand[]): KaiCommand[];
export declare function selectCommandsToRemove(commands: KaiCommand[]): {
    keep: KaiCommand;
    remove: KaiCommand[];
};
export declare function formatTaskKey(command: KaiCommand): string;
export interface KaiCommandRepository {
    findPendingAndRunning(): Promise<KaiCommand[]>;
    delete(id: string): Promise<void>;
    disconnect(): Promise<void>;
}
export declare function cleanupDuplicateCommands(repository: KaiCommandRepository, logger?: (message: string) => void): Promise<CleanupResult>;
//# sourceMappingURL=cleanup-duplicates.d.ts.map