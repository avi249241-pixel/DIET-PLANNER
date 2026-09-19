import {
  ComponentFood,
  MealAnalysisResult,
  CategoryPrior,
  CorrectionLogEntry,
  ConfirmedMealRecord
} from '../../src/types';
import { NormalizedFoodItem } from '../../src/lib/nutritionProvider';

export { ComponentFood };
export declare const HIGH_SIMILARITY_THRESHOLD = 0.85;
export declare function cleanBase64(base64: string): string;
export declare function computeFallbackHash(str: string): string;
export declare function findBestMealMatch(
  hash: string,
  confirmedMeals: ConfirmedMealRecord[],
  threshold?: number
): { bestMatch: ConfirmedMealRecord; similarity: number } | null;
export declare function deriveCategoryPrior(params: {
  userId: string;
  category: string;
  existingPrior?: CategoryPrior | null;
  corrections: CorrectionLogEntry[];
}): CategoryPrior;
export declare const nutritionService: {
  resolveFoodEntity(query: string): Promise<NormalizedFoodItem | null>;
};
export declare function calculateDeterministicMealTotals(
  foods: ComponentFood[],
  options?: {
    mealName?: string;
    mealType?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Late Night';
    cuisineType?: string;
    estimationNotes?: string[];
    massBasis?: any;
    scaleCue?: string;
    hasSecondPhoto?: boolean;
    categoryPriors?: Record<string, CategoryPrior> | CategoryPrior[];
  }
): MealAnalysisResult;
export declare function parseMealDescriptionToComponents(description: string): ComponentFood[];
export declare function isUnobservableUnknownFood(food: string | Partial<ComponentFood>): boolean;
