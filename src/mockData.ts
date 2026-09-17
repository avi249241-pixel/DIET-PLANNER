import { UserProfile, FoodItem, DailyStats, MealType } from './types';

// Deterministic format for current date YYYY-MM-DD
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const initialMockProfile: UserProfile = {
  heightCm: 178,
  weightKg: 78,
  desiredWeightKg: 74,
  age: 28,
  gender: 'male',
  activityLevel: 'moderately_active',
  goal: 'Weight Loss',
  dietaryStyle: 'High Protein Athletic',
  targetCalories: 2150,
  targetProtein: 165,
  targetCarbs: 210,
  targetFat: 65,
  waterGoal: 10,
  maxJunkCaloriePercent: 15,
  favoriteCuisines: ['Mediterranean', 'Japanese', 'Mexican'],
  allergiesOrDislikes: ['Peanuts'],
  autoLoggingEnabled: false,
  updatedAt: Date.now()
};

export const initialMockFoodItems: FoodItem[] = [
  {
    id: 'mock-food-1',
    userId: 'default-user',
    name: 'Steel-Cut Oatmeal with Blueberries & Whey',
    isJunk: false,
    calories: 420,
    protein: 34,
    carbs: 52,
    fat: 8,
    sugar: 12,
    sodium: 140,
    portion: '1 bowl (350g)',
    healthScore: 94,
    grade: 'A',
    mealType: 'Breakfast' as MealType,
    date: getTodayDateString(),
    createdAt: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
    nutritionSource: 'MOCK_SEAM',
    confidence: 0.98
  },
  {
    id: 'mock-food-2',
    userId: 'default-user',
    name: 'Grilled Herb Chicken Bowl with Quinoa & Greens',
    isJunk: false,
    calories: 580,
    protein: 48,
    carbs: 55,
    fat: 14,
    sugar: 4,
    sodium: 480,
    portion: '1 bowl (420g)',
    healthScore: 96,
    grade: 'A',
    mealType: 'Lunch' as MealType,
    date: getTodayDateString(),
    createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    nutritionSource: 'MOCK_SEAM',
    confidence: 0.99
  },
  {
    id: 'mock-food-3',
    userId: 'default-user',
    name: 'Greek Yogurt 0% with Roasted Almonds & Honey',
    isJunk: false,
    calories: 250,
    protein: 22,
    carbs: 20,
    fat: 9,
    sugar: 14,
    sodium: 75,
    portion: '200g serving',
    healthScore: 89,
    grade: 'B',
    mealType: 'Snack' as MealType,
    date: getTodayDateString(),
    createdAt: Date.now() - 1000 * 60 * 45, // 45 mins ago
    nutritionSource: 'MOCK_SEAM',
    confidence: 0.95
  }
];

export const initialMockDailyStats: DailyStats = {
  waterGlasses: 6,
  updatedAt: Date.now()
};
