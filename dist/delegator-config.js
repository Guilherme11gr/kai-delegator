"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS = exports.DELEGATOR_CONFIG = void 0;
exports.DELEGATOR_CONFIG = {
    POLL_INTERVAL_MS: 20000,
    MAX_CONCURRENT: 2,
    EXEC_TIMEOUT_MS: 600000,
    MAX_RETRIES: 3,
    QUERY_DELAY_MS: 100,
    DB_RETRY_DELAY_MS: 3000,
    DB_MAX_RETRIES: 3,
    RUNNING_COUNT_CACHE_TTL: 30000,
    LOG_BUFFER_SIZE: 10,
    MAX_OUTPUT_SIZE: 100000,
};
exports.STATUS = {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
};
//# sourceMappingURL=delegator-config.js.map