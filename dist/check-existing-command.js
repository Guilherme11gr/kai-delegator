"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExistingCommandAction = void 0;
exports.checkExistingKaiCommand = checkExistingKaiCommand;
exports.findAndCheckExistingCommand = findAndCheckExistingCommand;
exports.isStatusReusable = isStatusReusable;
exports.isStatusBlocking = isStatusBlocking;
const types_1 = require("./types");
var ExistingCommandAction;
(function (ExistingCommandAction) {
    ExistingCommandAction["CREATE_NEW"] = "CREATE_NEW";
    ExistingCommandAction["UPDATE_EXISTING"] = "UPDATE_EXISTING";
    ExistingCommandAction["SKIP"] = "SKIP";
})(ExistingCommandAction || (exports.ExistingCommandAction = ExistingCommandAction = {}));
const REUSABLE_STATUSES = [
    types_1.KaiCommandStatus.FAILED,
    types_1.KaiCommandStatus.PENDING,
];
const BLOCKING_STATUSES = [
    types_1.KaiCommandStatus.COMPLETED,
    types_1.KaiCommandStatus.RUNNING,
];
function checkExistingKaiCommand(existingCommand) {
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
async function findAndCheckExistingCommand(taskId, projectId, repository) {
    const existingCommand = await repository.findByTaskAndProject(taskId, projectId);
    return checkExistingKaiCommand(existingCommand);
}
function isStatusReusable(status) {
    return REUSABLE_STATUSES.includes(status);
}
function isStatusBlocking(status) {
    return BLOCKING_STATUSES.includes(status);
}
//# sourceMappingURL=check-existing-command.js.map