export declare const DELEGATOR_CONFIG: {
    readonly POLL_INTERVAL_MS: 20000;
    readonly MAX_CONCURRENT: 2;
    readonly EXEC_TIMEOUT_MS: 600000;
    readonly MAX_RETRIES: 3;
    readonly QUERY_DELAY_MS: 100;
    readonly DB_RETRY_DELAY_MS: 3000;
    readonly DB_MAX_RETRIES: 3;
    readonly RUNNING_COUNT_CACHE_TTL: 30000;
    readonly LOG_BUFFER_SIZE: 10;
    readonly MAX_OUTPUT_SIZE: 100000;
};
export declare const STATUS: {
    readonly PENDING: "PENDING";
    readonly RUNNING: "RUNNING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
};
export type StatusType = typeof STATUS[keyof typeof STATUS];
//# sourceMappingURL=delegator-config.d.ts.map