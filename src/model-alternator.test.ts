import { ModelAlternator, MODELS, createModelAlternator } from './model-alternator';

describe('ModelAlternator', () => {
  let alternator: ModelAlternator;

  beforeEach(() => {
    alternator = new ModelAlternator();
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
      expect(alternator.getNextModel()).toBe(MODELS.FREE);
    });

    it('should alternate between FREE and PAID models', () => {
      expect(alternator.getNextModel()).toBe(MODELS.FREE);
      expect(alternator.getNextModel()).toBe(MODELS.PAID);
      expect(alternator.getNextModel()).toBe(MODELS.FREE);
      expect(alternator.getNextModel()).toBe(MODELS.PAID);
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
    const alternator = createModelAlternator();
    expect(alternator).toBeInstanceOf(ModelAlternator);
  });

  it('should create independent instances', () => {
    const alternator1 = createModelAlternator();
    const alternator2 = createModelAlternator();
    
    alternator1.getNextModelIndex();
    
    expect(alternator1.getCurrentModelIndex()).toBe(1);
    expect(alternator2.getCurrentModelIndex()).toBe(0);
  });
});

describe('MODELS constant', () => {
  it('should have FREE model as GLM-5 free', () => {
    expect(MODELS.FREE).toBe('kilo/z-ai/glm-5:free');
  });

  it('should have PAID model as GLM-5', () => {
    expect(MODELS.PAID).toBe('glm-5');
  });
});
