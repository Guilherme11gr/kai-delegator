"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cleanup_duplicates_1 = require("./cleanup-duplicates");
const types_1 = require("./types");
function createMockCommand(id, taskId, status, createdAt, task) {
    const defaultTask = {
        id: taskId,
        readableId: null,
        localId: 1,
        title: 'Test Task',
        project: { id: 'project-1', key: 'TEST' },
        ...task,
    };
    return {
        id,
        projectId: 'project-1',
        taskId,
        commandType: types_1.KaiCommandType.FIX,
        status,
        output: null,
        resultSummary: null,
        branchName: null,
        prUrl: null,
        createdAt,
        updatedAt: createdAt,
        task: { ...defaultTask, ...task },
    };
}
describe('groupCommandsByTask', () => {
    it('should group commands by taskId', () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date()),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.RUNNING, new Date()),
            createMockCommand('cmd-3', 'task-2', types_1.KaiCommandStatus.PENDING, new Date()),
        ];
        const result = (0, cleanup_duplicates_1.groupCommandsByTask)(commands);
        expect(result.size).toBe(2);
        expect(result.get('task-1')?.length).toBe(2);
        expect(result.get('task-2')?.length).toBe(1);
    });
    it('should return empty map for empty array', () => {
        const result = (0, cleanup_duplicates_1.groupCommandsByTask)([]);
        expect(result.size).toBe(0);
    });
});
describe('sortCommandsByPriority', () => {
    it('should prioritize RUNNING status over PENDING', () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.RUNNING, new Date('2024-01-02')),
        ];
        const result = (0, cleanup_duplicates_1.sortCommandsByPriority)(commands);
        expect(result[0].status).toBe(types_1.KaiCommandStatus.RUNNING);
        expect(result[1].status).toBe(types_1.KaiCommandStatus.PENDING);
    });
    it('should sort by createdAt when statuses are equal', () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-02')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
        ];
        const result = (0, cleanup_duplicates_1.sortCommandsByPriority)(commands);
        expect(result[0].id).toBe('cmd-2');
        expect(result[1].id).toBe('cmd-1');
    });
    it('should prioritize RUNNING and then oldest', () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.RUNNING, new Date('2024-01-03')),
            createMockCommand('cmd-3', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-02')),
        ];
        const result = (0, cleanup_duplicates_1.sortCommandsByPriority)(commands);
        expect(result[0].id).toBe('cmd-2');
        expect(result[1].id).toBe('cmd-1');
        expect(result[2].id).toBe('cmd-3');
    });
});
describe('selectCommandsToRemove', () => {
    it('should select first command to keep and rest to remove', () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.RUNNING, new Date('2024-01-01')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-02')),
            createMockCommand('cmd-3', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-03')),
        ];
        const result = (0, cleanup_duplicates_1.selectCommandsToRemove)(commands);
        expect(result.keep.id).toBe('cmd-1');
        expect(result.remove.length).toBe(2);
        expect(result.remove.map(c => c.id)).toEqual(['cmd-2', 'cmd-3']);
    });
    it('should return empty remove array for single command', () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date()),
        ];
        const result = (0, cleanup_duplicates_1.selectCommandsToRemove)(commands);
        expect(result.keep.id).toBe('cmd-1');
        expect(result.remove.length).toBe(0);
    });
});
describe('formatTaskKey', () => {
    it('should return readableId when available', () => {
        const command = createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date(), {
            readableId: 'KAIDE-42',
        });
        expect((0, cleanup_duplicates_1.formatTaskKey)(command)).toBe('KAIDE-42');
    });
    it('should return project-localId when readableId is null', () => {
        const command = createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date(), {
            readableId: null,
            localId: 42,
            project: { id: 'p1', key: 'TEST' },
        });
        expect((0, cleanup_duplicates_1.formatTaskKey)(command)).toBe('TEST-42');
    });
    it('should use TASK as fallback when project is null', () => {
        const command = createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date(), {
            readableId: null,
            localId: 42,
            project: null,
        });
        expect((0, cleanup_duplicates_1.formatTaskKey)(command)).toBe('TASK-42');
    });
});
describe('cleanupDuplicateCommands', () => {
    it('should return empty result when no commands found', async () => {
        const repository = {
            findPendingAndRunning: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            disconnect: jest.fn(),
        };
        const logger = jest.fn();
        const result = await (0, cleanup_duplicates_1.cleanupDuplicateCommands)(repository, logger);
        expect(result.duplicatesRemoved).toBe(0);
        expect(result.commandsKept).toBe(0);
        expect(repository.delete).not.toHaveBeenCalled();
        expect(repository.disconnect).toHaveBeenCalled();
    });
    it('should not remove anything when no duplicates', async () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date()),
            createMockCommand('cmd-2', 'task-2', types_1.KaiCommandStatus.RUNNING, new Date()),
        ];
        const repository = {
            findPendingAndRunning: jest.fn().mockResolvedValue(commands),
            delete: jest.fn(),
            disconnect: jest.fn(),
        };
        const result = await (0, cleanup_duplicates_1.cleanupDuplicateCommands)(repository);
        expect(result.duplicatesRemoved).toBe(0);
        expect(result.commandsKept).toBe(2);
        expect(repository.delete).not.toHaveBeenCalled();
    });
    it('should remove duplicates keeping RUNNING command', async () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.RUNNING, new Date('2024-01-02')),
        ];
        const repository = {
            findPendingAndRunning: jest.fn().mockResolvedValue(commands),
            delete: jest.fn(),
            disconnect: jest.fn(),
        };
        const result = await (0, cleanup_duplicates_1.cleanupDuplicateCommands)(repository);
        expect(result.duplicatesRemoved).toBe(1);
        expect(result.commandsKept).toBe(1);
        expect(repository.delete).toHaveBeenCalledWith('cmd-1');
    });
    it('should remove duplicates keeping oldest when no RUNNING', async () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-02')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
        ];
        const repository = {
            findPendingAndRunning: jest.fn().mockResolvedValue(commands),
            delete: jest.fn(),
            disconnect: jest.fn(),
        };
        const result = await (0, cleanup_duplicates_1.cleanupDuplicateCommands)(repository);
        expect(result.duplicatesRemoved).toBe(1);
        expect(result.commandsKept).toBe(1);
        expect(repository.delete).toHaveBeenCalledWith('cmd-1');
    });
    it('should handle multiple tasks with duplicates', async () => {
        const commands = [
            createMockCommand('cmd-1', 'task-1', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
            createMockCommand('cmd-2', 'task-1', types_1.KaiCommandStatus.RUNNING, new Date('2024-01-02')),
            createMockCommand('cmd-3', 'task-2', types_1.KaiCommandStatus.PENDING, new Date('2024-01-01')),
            createMockCommand('cmd-4', 'task-2', types_1.KaiCommandStatus.PENDING, new Date('2024-01-02')),
        ];
        const repository = {
            findPendingAndRunning: jest.fn().mockResolvedValue(commands),
            delete: jest.fn(),
            disconnect: jest.fn(),
        };
        const result = await (0, cleanup_duplicates_1.cleanupDuplicateCommands)(repository);
        expect(result.duplicatesRemoved).toBe(2);
        expect(result.commandsKept).toBe(2);
        expect(repository.delete).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=cleanup-duplicates.test.js.map