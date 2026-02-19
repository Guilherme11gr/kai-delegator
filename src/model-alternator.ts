export const MODELS = {
  FREE: 'kilo/z-ai/glm-5:free',
  PAID: 'glm-5',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

export class ModelAlternator {
  private alternator: number = 0;

  getNextModelIndex(): number {
    const current = this.alternator;
    this.alternator = (this.alternator + 1) % 2;
    return current;
  }

  getNextModel(): ModelType {
    const modelIndex = this.getNextModelIndex();
    return modelIndex === 0 ? MODELS.FREE : MODELS.PAID;
  }

  getCurrentModelIndex(): number {
    return this.alternator;
  }

  reset(): void {
    this.alternator = 0;
  }
}

export function createModelAlternator(): ModelAlternator {
  return new ModelAlternator();
}
