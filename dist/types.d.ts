export declare enum KaiCommandStatus {
    PENDING = "PENDING",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}
export declare enum KaiCommandType {
    FIX = "FIX",
    REFACTOR = "REFACTOR",
    TEST = "TEST",
    DOCS = "DOCS"
}
export interface Project {
    id: string;
    key: string;
}
export interface Task {
    id: string;
    readableId: string | null;
    localId: number;
    title: string;
    project: Project | null;
}
export interface KaiCommand {
    id: string;
    projectId: string;
    taskId: string;
    commandType: KaiCommandType;
    status: KaiCommandStatus;
    output: string | null;
    resultSummary: string | null;
    branchName: string | null;
    prUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    task: Task;
}
export interface CleanupResult {
    duplicatesRemoved: number;
    commandsKept: number;
}
export interface GroupedCommands {
    taskId: string;
    commands: KaiCommand[];
}
//# sourceMappingURL=types.d.ts.map