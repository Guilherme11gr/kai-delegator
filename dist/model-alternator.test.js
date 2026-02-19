"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const model_alternator_1 = require("./model-alternator");
describe('ModelAlternator', () => {
    let alternator;
    beforeEach(() => {
        alternator = new model_alternator_1.ModelAlternator();
    });
    describe('getNextModelIndex', () => {
        it('should return 0 on first call', () => {
            expect(alternator.getNextModelIndex()).toBe(0);
        });
        it('should alternate between 0 and 1', () => {
            expect(alternator.getNextModelIndex()).toBe(0);
            expect(alternator.getNextModelIndex()).toBe(1);
            expect(alternator.getNextModelIndex()).toBe(0);
            expect(alternator.getNextModelIndex()).toBe(1);
        });
        it('should cycle back to 0 after 1', () => {
            alternator.getNextModelIndex();
            alternator.getNextModelIndex();
            expect(alternator.getNextModelIndex()).toBe(0);
        });
    });
    describe('getNextModel', () => {
        it('should return FREE model on first call', () => {
            expect(alternator.getNextModel()).toBe(model_alternator_1.MODELS.FREE);
        });
        it('should alternate between FREE and PAID models', () => {
            expect(alternator.getNextModel()).toBe(model_alternator_1.MODELS.FREE);
            expect(alternator.getNextModel()).toBe(model_alternator_1.MODELS.PAID);
            expect(alternator.getNextModel()).toBe(model_alternator_1.MODELS.FREE);
            expect(alternator.getNextModel()).toBe(model_alternator_1.MODELS.PAID);
        });
    });
    describe('getCurrentModelIndex', () => {
        it('should return 0 initially', () => {
            expect(alternator.getCurrentModelIndex()).toBe(0);
        });
        it('should return next index after getNextModelIndex call', () => {
            alternator.getNextModelIndex();
            expect(alternator.getCurrentModelIndex()).toBe(1);
            alternator.getNextModelIndex();
            expect(alternator.getCurrentModelIndex()).toBe(0);
        });
    });
    describe('reset', () => {
        it('should reset alternator to 0', () => {
            alternator.getNextModelIndex();
            alternator.getNextModelIndex();
            expect(alternator.getCurrentModelIndex()).toBe(0);
            alternator.getNextModelIndex();
            expect(alternator.getCurrentModelIndex()).toBe(1);
            alternator.reset();
            expect(alternator.getCurrentModelIndex()).toBe(0);
            expect(alternator.getNextModelIndex()).toBe(0);
        });
    });
});
describe('createModelAlternator', () => {
    it('should create a new ModelAlternator instance', () => {
        const alternator = (0, model_alternator_1.createModelAlternator)();
        expect(alternator).toBeInstanceOf(model_alternator_1.ModelAlternator);
    });
    it('should create independent instances', () => {
        const alternator1 = (0, model_alternator_1.createModelAlternator)();
        const alternator2 = (0, model_alternator_1.createModelAlternator)();
        alternator1.getNextModelIndex();
        expect(alternator1.getCurrentModelIndex()).toBe(1);
        expect(alternator2.getCurrentModelIndex()).toBe(0);
    });
});
describe('MODELS constant', () => {
    it('should have FREE model as GLM-5 free', () => {
        expect(model_alternator_1.MODELS.FREE).toBe('kilo/z-ai/glm-5:free');
    });
    it('should have PAID model as GLM-5', () => {
        expect(model_alternator_1.MODELS.PAID).toBe('glm-5');
    });
});
//# sourceMappingURL=model-alternator.test.js.map