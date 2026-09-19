export { nutritionService } from '../../src/lib/nutritionProvider';
export {
  calculateDeterministicMealTotals,
  parseMealDescriptionToComponents,
  isUnobservableUnknownFood,
  type ComponentFood
} from '../../src/lib/nutritionEngine';
export {
  deriveCategoryPrior,
  computeFallbackHash,
  cleanBase64,
  findBestMealMatch,
  HIGH_SIMILARITY_THRESHOLD
} from '../../src/lib/personalMemory';
