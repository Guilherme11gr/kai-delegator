import {
  checkExistingKaiCommand,
  findAndCheckExistingCommand,
  isStatusReusable,
  isStatusBlocking,
  ExistingCommandAction,
  CheckExistingCommandRepository,
} from './check-existing-command';
import { KaiCommand, KaiCommandStatus, KaiCommandType, Task, Project } from './types';

function createMockCommand(
  id: string,
  taskId: string,
  status: KaiCommandStatus,
  projectId: string = 'project-1'
): KaiCommand {
  const task: Task = {
    id: taskId,
    readableId: 'TEST-1',
    localId: 1,
    title: 'Test Task',
    project: { id: projectId, key: 'TEST' } as Project,
  };

  return {
    id,
    projectId,
    taskId,
    commandType: KaiCommandType.FIX,
    status,
    output: null,
    resultSummary: null,
    branchName: null,
    prUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    task,
  };
}

describe('checkExistingKaiCommand', () => {
  describe('when no existing command', () => {
    it('should return CREATE_NEW action', () => {
      const result = checkExistingKaiCommand(null);

      expect(result.action).toBe(ExistingCommandAction.CREATE_NEW);
      expect(result.existingCommand).toBeNull();
      expect(result.reason).toBe('No existing KaiCommand found for this task');
    });
  });

  describe('when existing command with FAILED status', () => {
    it('should return UPDATE_EXISTING action', () => {
      const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.FAILED);
      const result = checkExistingKaiCommand(command);

      expect(result.action).toBe(ExistingCommandAction.UPDATE_EXISTING);
      expect(result.existingCommand).toBe(command);
      expect(result.reason).toContain('FAILED');
      expect(result.reason).toContain('will update to RUNNING');
    });
  });

  describe('when existing command with PENDING status', () => {
    it('should return UPDATE_EXISTING action', () => {
      const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING);
      const result = checkExistingKaiCommand(command);

      expect(result.action).toBe(ExistingCommandAction.UPDATE_EXISTING);
      expect(result.existingCommand).toBe(command);
      expect(result.reason).toContain('PENDING');
      expect(result.reason).toContain('will update to RUNNING');
    });
  });

  describe('when existing command with COMPLETED status', () => {
    it('should return SKIP action', () => {
      const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.COMPLETED);
      const result = checkExistingKaiCommand(command);

      expect(result.action).toBe(ExistingCommandAction.SKIP);
      expect(result.existingCommand).toBe(command);
      expect(result.reason).toContain('COMPLETED');
      expect(result.reason).toContain('cannot create new');
    });
  });

  describe('when existing command with RUNNING status', () => {
    it('should return SKIP action', () => {
      const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.RUNNING);
      const result = checkExistingKaiCommand(command);

      expect(result.action).toBe(ExistingCommandAction.SKIP);
      expect(result.existingCommand).toBe(command);
      expect(result.reason).toContain('RUNNING');
      expect(result.reason).toContain('cannot create new');
    });
  });

  describe('when existing command with unknown status', () => {
    it('should return CREATE_NEW action for unknown status', () => {
      const command = createMockCommand('cmd-1', 'task-1', 'UNKNOWN_STATUS' as KaiCommandStatus);
      const result = checkExistingKaiCommand(command);

      expect(result.action).toBe(ExistingCommandAction.CREATE_NEW);
      expect(result.existingCommand).toBeNull();
      expect(result.reason).toContain('Unknown status');
    });
  });
});

describe('findAndCheckExistingCommand', () => {
  it('should return CREATE_NEW when no command found', async () => {
    const repository: CheckExistingCommandRepository = {
      findByTaskAndProject: jest.fn().mockResolvedValue(null),
    };

    const result = await findAndCheckExistingCommand('task-1', 'project-1', repository);

    expect(result.action).toBe(ExistingCommandAction.CREATE_NEW);
    expect(repository.findByTaskAndProject).toHaveBeenCalledWith('task-1', 'project-1');
  });

  it('should return UPDATE_EXISTING when command with FAILED status found', async () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.FAILED);
    const repository: CheckExistingCommandRepository = {
      findByTaskAndProject: jest.fn().mockResolvedValue(command),
    };

    const result = await findAndCheckExistingCommand('task-1', 'project-1', repository);

    expect(result.action).toBe(ExistingCommandAction.UPDATE_EXISTING);
    expect(result.existingCommand).toBe(command);
  });

  it('should return UPDATE_EXISTING when command with PENDING status found', async () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.PENDING);
    const repository: CheckExistingCommandRepository = {
      findByTaskAndProject: jest.fn().mockResolvedValue(command),
    };

    const result = await findAndCheckExistingCommand('task-1', 'project-1', repository);

    expect(result.action).toBe(ExistingCommandAction.UPDATE_EXISTING);
    expect(result.existingCommand).toBe(command);
  });

  it('should return SKIP when command with COMPLETED status found', async () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.COMPLETED);
    const repository: CheckExistingCommandRepository = {
      findByTaskAndProject: jest.fn().mockResolvedValue(command),
    };

    const result = await findAndCheckExistingCommand('task-1', 'project-1', repository);

    expect(result.action).toBe(ExistingCommandAction.SKIP);
    expect(result.existingCommand).toBe(command);
  });

  it('should return SKIP when command with RUNNING status found', async () => {
    const command = createMockCommand('cmd-1', 'task-1', KaiCommandStatus.RUNNING);
    const repository: CheckExistingCommandRepository = {
      findByTaskAndProject: jest.fn().mockResolvedValue(command),
    };

    const result = await findAndCheckExistingCommand('task-1', 'project-1', repository);

    expect(result.action).toBe(ExistingCommandAction.SKIP);
    expect(result.existingCommand).toBe(command);
  });
});

describe('isStatusReusable', () => {
  it('should return true for FAILED status', () => {
    expect(isStatusReusable(KaiCommandStatus.FAILED)).toBe(true);
  });

  it('should return true for PENDING status', () => {
    expect(isStatusReusable(KaiCommandStatus.PENDING)).toBe(true);
  });

  it('should return false for COMPLETED status', () => {
    expect(isStatusReusable(KaiCommandStatus.COMPLETED)).toBe(false);
  });

  it('should return false for RUNNING status', () => {
    expect(isStatusReusable(KaiCommandStatus.RUNNING)).toBe(false);
  });
});

describe('isStatusBlocking', () => {
  it('should return false for FAILED status', () => {
    expect(isStatusBlocking(KaiCommandStatus.FAILED)).toBe(false);
  });

  it('should return false for PENDING status', () => {
    expect(isStatusBlocking(KaiCommandStatus.PENDING)).toBe(false);
  });

  it('should return true for COMPLETED status', () => {
    expect(isStatusBlocking(KaiCommandStatus.COMPLETED)).toBe(true);
  });

  it('should return true for RUNNING status', () => {
    expect(isStatusBlocking(KaiCommandStatus.RUNNING)).toBe(true);
  });
});
