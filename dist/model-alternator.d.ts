export declare const MODELS: {
    readonly FREE: "kilo/z-ai/glm-5:free";
    readonly PAID: "glm-5";
};
export type ModelType = typeof MODELS[keyof typeof MODELS];
export declare class ModelAlternator {
    private alternator;
    getNextModelIndex(): number;
    getNextModel(): ModelType;
    getCurrentModelIndex(): number;
    reset(): void;
}
export declare function createModelAlternator(): ModelAlternator;
//# sourceMappingURL=model-alternator.d.ts.map