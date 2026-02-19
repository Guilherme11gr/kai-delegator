import {
  groupCommandsByTask,
  sortCommandsByPriority,
  selectCommandsToRemove,
  formatTaskKey,
  cleanupDuplicateCommands,
  KaiCommandRepository,
} from './cleanup-duplicates';
import { KaiCommand, KaiCommandStatus, KaiCommandType, Task, Project } from './types';

function createMockCommand(
  id: string,
  taskId: string,
  status: KaiCommandStatus,
  createdAt: Date,
  task?: Partial<Task>
): KaiCommand {
  const defaultTask: Task = {
    id: taskId,
    readableId: null,
    localId: 1,
    title: 'Test Task',
    project: { id: 'project-1', key: 'TEST' } as Project,
    ...task,
  };
  
  return {
    id,
    projectId: 'project-1',
    taskId,
    commandType: KaiCommandType.FIX,
    status,
    output: null,
    resultSummary: null,
    branchName: null,
    prUrl: null,
    createdAt,
    updatedAt: createdAt,
    task: { ...defaultTask, ...task } as Task,
  };
}

describe('groupCommandsByTask', () => {
  it('should group commands by taskId', () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date()),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.RUNNING, new Date()),
      createMockCommand('cmd-3', 'task-2', KaiCommandStatus.PENDING, new Date()),
    ];
    
    const result = groupCommandsByTask(commands);
    
    expect(result.size).toBe(2);
    expect(result.get('task-1')?.length).toBe(2);
    expect(result.get('task-2')?.length).toBe(1);
  });

  it('should return empty map for empty array', () => {
    const result = groupCommandsByTask([]);
    expect(result.size).toBe(0);
  });
});

describe('sortCommandsByPriority', () => {
  it('should prioritize RUNNING status over PENDING', () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-01')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.RUNNING, new Date('2024-01-02')),
    ];
    
    const result = sortCommandsByPriority(commands);
    
    expect(result[0].status).toBe(KaiCommandStatus.RUNNING);
    expect(result[1].status).toBe(KaiCommandStatus.PENDING);
  });

  it('should sort by createdAt when statuses are equal', () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-02')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-01')),
    ];
    
    const result = sortCommandsByPriority(commands);
    
    expect(result[0].id).toBe('cmd-2');
    expect(result[1].id).toBe('cmd-1');
  });

  it('should prioritize RUNNING and then oldest', () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-01')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.RUNNING, new Date('2024-01-03')),
      createMockCommand('cmd-3', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-02')),
    ];
    
    const result = sortCommandsByPriority(commands);
    
    expect(result[0].id).toBe('cmd-2');
    expect(result[1].id).toBe('cmd-1');
    expect(result[2].id).toBe('cmd-3');
  });
});

describe('selectCommandsToRemove', () => {
  it('should select first command to keep and rest to remove', () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.RUNNING, new Date('2024-01-01')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-02')),
      createMockCommand('cmd-3', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-03')),
    ];
    
    const result = selectCommandsToRemove(commands);
    
    expect(result.keep.id).toBe('cmd-1');
    expect(result.remove.length).toBe(2);
    expect(result.remove.map(c => c.id)).toEqual(['cmd-2', 'cmd-3']);
  });

  it('should return empty remove array for single command', () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date()),
    ];
    
    const result = selectCommandsToRemove(commands);
    
    expect(result.keep.id).toBe('cmd-1');
    expect(result.remove.length).toBe(0);
  });
});

describe('formatTaskKey', () => {
  it('should return readableId when available', () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date(), {
      readableId: 'KAIDE-42',
    });
    
    expect(formatTaskKey(command)).toBe('KAIDE-42');
  });

  it('should return project-localId when readableId is null', () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date(), {
      readableId: null,
      localId: 42,
      project: { id: 'p1', key: 'TEST' } as Project,
    });
    
    expect(formatTaskKey(command)).toBe('TEST-42');
  });

  it('should use TASK as fallback when project is null', () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date(), {
      readableId: null,
      localId: 42,
      project: null,
    });
    
    expect(formatTaskKey(command)).toBe('TASK-42');
  });
});

describe('cleanupDuplicateCommands', () => {
  it('should return empty result when no commands found', async () => {
    const repository: KaiCommandRepository = {
      findPendingAndRunning: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      disconnect: jest.fn(),
    };
    
    const logger = jest.fn();
    const result = await cleanupDuplicateCommands(repository, logger);
    
    expect(result.duplicatesRemoved).toBe(0);
    expect(result.commandsKept).toBe(0);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.disconnect).toHaveBeenCalled();
  });

  it('should not remove anything when no duplicates', async () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date()),
      createMockCommand('cmd-2', 'task-2', KaiCommandStatus.RUNNING, new Date()),
    ];
    
    const repository: KaiCommandRepository = {
      findPendingAndRunning: jest.fn().mockResolvedValue(commands),
      delete: jest.fn(),
      disconnect: jest.fn(),
    };
    
    const result = await cleanupDuplicateCommands(repository);
    
    expect(result.duplicatesRemoved).toBe(0);
    expect(result.commandsKept).toBe(2);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('should remove duplicates keeping RUNNING command', async () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-01')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.RUNNING, new Date('2024-01-02')),
    ];
    
    const repository: KaiCommandRepository = {
      findPendingAndRunning: jest.fn().mockResolvedValue(commands),
      delete: jest.fn(),
      disconnect: jest.fn(),
    };
    
    const result = await cleanupDuplicateCommands(repository);
    
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.commandsKept).toBe(1);
    expect(repository.delete).toHaveBeenCalledWith('cmd-1');
  });

  it('should remove duplicates keeping oldest when no RUNNING', async () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-02')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-01')),
    ];
    
    const repository: KaiCommandRepository = {
      findPendingAndRunning: jest.fn().mockResolvedValue(commands),
      delete: jest.fn(),
      disconnect: jest.fn(),
    };
    
    const result = await cleanupDuplicateCommands(repository);
    
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.commandsKept).toBe(1);
    expect(repository.delete).toHaveBeenCalledWith('cmd-1');
  });

  it('should handle multiple tasks with duplicates', async () => {
    const commands = [
      createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING, new Date('2024-01-01')),
      createMockCommand('cmd-2', 'task-1', KaiCommandStatus.RUNNING, new Date('2024-01-02')),
      createMockCommand('cmd-3', 'task-2', KaiCommandStatus.PENDING, new Date('2024-01-01')),
      createMockCommand('cmd-4', 'task-2', KaiCommandStatus.PENDING, new Date('2024-01-02')),
    ];
    
    const repository: KaiCommandRepository = {
      findPendingAndRunning: jest.fn().mockResolvedValue(commands),
      delete: jest.fn(),
      disconnect: jest.fn(),
    };
    
    const result = await cleanupDuplicateCommands(repository);
    
    expect(result.duplicatesRemoved).toBe(2);
    expect(result.commandsKept).toBe(2);
    expect(repository.delete).toHaveBeenCalledTimes(2);
  });
});
