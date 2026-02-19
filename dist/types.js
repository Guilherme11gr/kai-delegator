"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KaiCommandType = exports.KaiCommandStatus = void 0;
var KaiCommandStatus;
(function (KaiCommandStatus) {
    KaiCommandStatus["PENDING"] = "PENDING";
    KaiCommandStatus["RUNNING"] = "RUNNING";
    KaiCommandStatus["COMPLETED"] = "COMPLETED";
    KaiCommandStatus["FAILED"] = "FAILED";
})(KaiCommandStatus || (exports.KaiCommandStatus = KaiCommandStatus = {}));
var KaiCommandType;
(function (KaiCommandType) {
    KaiCommandType["FIX"] = "FIX";
    KaiCommandType["REFACTOR"] = "REFACTOR";
    KaiCommandType["TEST"] = "TEST";
    KaiCommandType["DOCS"] = "DOCS";
})(KaiCommandType || (exports.KaiCommandType = KaiCommandType = {}));
//# sourceMappingURL=types.js.map