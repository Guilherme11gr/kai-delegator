"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelAlternator = exports.MODELS = void 0;
exports.createModelAlternator = createModelAlternator;
exports.MODELS = {
    FREE: 'kilo/z-ai/glm-5:free',
    PAID: 'glm-5',
};
class ModelAlternator {
    alternator = 0;
    getNextModelIndex() {
        const current = this.alternator;
        this.alternator = (this.alternator + 1) % 2;
        return current;
    }
    getNextModel() {
        const modelIndex = this.getNextModelIndex();
        return modelIndex === 0 ? exports.MODELS.FREE : exports.MODELS.PAID;
    }
    getCurrentModelIndex() {
        return this.alternator;
    }
    reset() {
        this.alternator = 0;
    }
}
exports.ModelAlternator = ModelAlternator;
function createModelAlternator() {
    return new ModelAlternator();
}
//# sourceMappingURL=model-alternator.js.map