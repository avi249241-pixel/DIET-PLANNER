import React from 'react';

export type FitnessGoal = 'Weight Loss' | 'Muscle Gain' | 'Clean Maintenance' | 'Keto / Low Carb' | 'High Protein Athletic';

export type DietaryStyle = 'Standard Balanced' | 'High Protein Athletic' | 'Keto / Low Carb' | 'Mediterranean' | 'Vegetarian' | 'Vegan' | 'Pescatarian' | 'Intermittent Fasting';

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'athlete';

export interface UserProfile {
  heightCm: number;
  weightKg: number;
  desiredWeightKg: number;
  targetCalories: number;
  maxJunkCaloriePercent: number;
  goal?: FitnessGoal;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  activityLevel?: ActivityLevel;
  dietaryStyle?: DietaryStyle;
  favoriteCuisines?: string[];
  allergiesOrDislikes?: string[];
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  waterGoal?: number;
  autoLoggingEnabled?: boolean;
  automationPreferences?: {
    autoSuggestNextMeal?: boolean;
    proactiveNudges?: boolean;
    smartGroceryAutoSync?: boolean;
  };
  weightHistory?: Array<{ date: string; weightKg: number }>;
  recalibrationHistory?: Array<{
    date: string;
    previousCalories: number;
    newCalories: number;
    reason: string;
  }>;
  dismissedRecalibrationDate?: string;
  updatedAt: number;
}

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Late Night';

export interface PersonalizedMealOption {
  id?: string;
  name: string;
  type: 'Quick 5-Min Fuel' | "High-Protein Chef's Pick" | 'Smart Dining/Takeout Option';
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  sodium?: number;
  healthScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  isJunk: boolean;
  prepTime: string;
  ingredients: string[];
  quickRecipe: string;
  matchReason: string;
}

export interface PersonalizedCoachBriefing {
  currentSlot: MealType;
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  coachInsight: string;
  proactiveTip: string;
  urgencyLevel: 'optimal' | 'moderate' | 'action_needed';
  recommendations: PersonalizedMealOption[];
}

export interface NaturalVoiceLogResult {
  detectedMealType: MealType;
  items: Array<{
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar: number;
    sodium: number;
    isJunk: boolean;
    category: string;
    grade: string;
    healthScore: number;
    verdict?: string;
  }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  hasJunk: boolean;
  overallGrade: string;
  overallVerdict: string;
}

export type EvidenceClass = 'visible' | 'context_derived' | 'user_confirmed' | 'unobservable_unknown';

export type MassBasis = 'single_view' | 'two_view_calibrated';

export interface MassDistribution {
  p10: number;
  p50: number;
  p90: number;
}

export interface AtwaterDiagnostic {
  expectedCalories: number;
  delta: number;
  isInconsistent: boolean;
  reason: string;
}

export interface ComponentFoodItem {
  name: string;
  identifiedFood: string;
  portionDescription: string;
  estimatedGrams: number;
  minGrams?: number;
  maxGrams?: number;
  mass_g?: MassDistribution;
  mass_basis?: MassBasis;
  evidence?: EvidenceClass;
  calorieRange?: [number, number];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  sodium?: number;
  confidence: number;
  preparationState?: 'RAW' | 'COOKED' | 'PREPARED' | 'UNKNOWN' | string;
  oilState?: 'LOW_OIL' | 'MODERATE_OIL' | 'HIGH_OIL' | 'UNKNOWN' | string;
  visualEvidence?: string[];
  assumptions?: string[];
  source?: 'USDA_FDC' | 'AUTHORITATIVE_DB' | 'GEMINI_ESTIMATE' | 'USER_EDITED' | string;
  fdcId?: string | number;
  snapshot?: any;
}

export interface FoodItem {
  id: string; // Document ID
  userId: string;
  name: string;
  isJunk: boolean;
  calories: number;
  minCal?: number;
  maxCal?: number;
  calorieRange?: [number, number];
  massDistribution?: MassDistribution;
  massBasis?: MassBasis;
  scaleCue?: string;
  atwaterDiagnostic?: AtwaterDiagnostic;
  hasUnobservableUnknown?: boolean;
  autoLogBlocked?: boolean;
  requiresClarification?: boolean;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  sodium?: number;
  portion?: string;
  healthScore?: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | string;
  mealType: MealType | string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  imageUrl?: string;
  swapSuggestion?: string;
  verdict?: string;
  category?: 'junk' | 'healthy' | 'neutral' | string;
  barcode?: string;
  foods?: ComponentFoodItem[];
  confidence?: number;
  uncertainty?: any;
  nutritionSource?: 'USDA_FDC' | 'AUTHORITATIVE_DB' | 'GEMINI_ESTIMATE' | 'MIXED' | 'BARCODE' | string;
  estimationNotes?: string[];
  energyCheckDelta?: number;
}

export interface DailyStats {
  waterGlasses: number;
  updatedAt: number;
}

export type GroceryCategory = 
  | 'Produce' 
  | 'Proteins' 
  | 'Protein & Meat'
  | 'Grains & Carbs' 
  | 'Dairy & Plant Milks' 
  | 'Dairy & Eggs'
  | 'Pantry & Grains'
  | 'Pantry Staples'
  | 'Healthy Snacks' 
  | 'Snacks & Beverages'
  | 'Frozen'
  | 'Other';

export interface RecipeIngredient {
  name: string;
  amount: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  servings: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  sugarPerServing?: number;
  sodiumPerServing?: number;
  healthScore?: number;
  isJunk: boolean;
  grade: string;
  ingredients: RecipeIngredient[];
  instructions?: string;
  prepTips?: string;
  createdAt: number;
}

export interface GroceryItem {
  id: string;
  userId: string;
  name: string;
  category: GroceryCategory;
  completed?: boolean;
  checked?: boolean;
  quantity?: string;
  source?: string;
  notes?: string;
  createdAt: number;
}


export interface WeeklyAuditReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionPlan: string[];
  smartSwaps: Array<{ currentFood: string; recommendedSwap: string; reason: string }>;
  suggestedWeeklyGrocery: string[];
  closingEncouragement?: string;
}

export interface FoodPreset {
  id: string;
  name: string;
  category: 'junk' | 'healthy';
  isJunk: boolean;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  portion: string;
  emoji: string;
  tag: string;
}

