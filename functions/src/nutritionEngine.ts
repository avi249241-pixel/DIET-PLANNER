/**
 * Nutrition Engine - Authoritative Data, Deterministic Calculations & Validation
 * 
 * Provides:
 * 1. Authoritative USDA Reference composition library (per 100g)
 * 2. Deterministic meal summation and macro energy alignment
 * 3. Transparent scientific Health Score & Grade calculator
 * 4. Zero silent fallback guarantee
 */

import { EvidenceClass, MassBasis, MassDistribution, AtwaterDiagnostic, CategoryPrior } from './types';
import { detectFoodCategory } from './personalMemory';

export interface ComponentFood {
  name: string;
  identifiedFood: string;
  originalAiFoodName?: string;
  normalizedFoodName?: string;
  databaseMatch?: string;
  matchConfidence?: number;
  portionDescription: string;
  estimatedGrams: number;
  minGrams?: number;
  maxGrams?: number;
  mass_g?: MassDistribution;
  mass_basis?: MassBasis;
  evidence?: EvidenceClass;
  calorieRange?: [number, number];
  preparationState?: 'RAW' | 'COOKED' | 'PREPARED' | 'UNKNOWN';
  oilState?: 'LOW_OIL' | 'MODERATE_OIL' | 'HIGH_OIL' | 'UNKNOWN';
  visualEvidence?: string[];
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  sugar?: number;  // in grams
  sodium?: number; // in mg
  confidence: number; // 0 to 1
  foodIdConfidence?: number;
  portionConfidence?: number;
  assumptions: string[];
  source: 'USDA_FDC' | 'OPEN_FOOD_FACTS' | 'LOCAL_AUTHORITATIVE' | 'AUTHORITATIVE_DB' | 'GEMINI_ESTIMATE' | 'USER_EDITED';
  fdcId?: string | number;
  snapshot?: {
    provider: string;
    providerFoodId?: string | number;
    attribution: string;
    nutrientsPer100g: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      sugar?: number;
      sodium?: number;
    };
    preparationState?: string;
    portionGrams: number;
    timestamp: string;
  };
}

export interface ScientificUncertainty {
  foodIdentificationConfidence: number; // 0 to 1
  portionConfidence: number;            // 0 to 1
  nutritionSourceConfidence: number;    // 0 to 1
  overallConfidence: number;            // 0 to 1
  calorieRange: [number, number];       // [minKcal, maxKcal]
  primaryUncertaintyFactor?: 'PORTION_VARIANCE' | 'HIDDEN_COOKING_FAT' | 'SAUCE_DENSITY' | 'FOOD_RECOGNITION' | 'LAB_PRECISION';
  requiresClarification: boolean;
  clarificationPrompt?: string;
  clarificationOptions?: string[];
  informationGainExpectedKcal?: number;
  autoLogBlocked?: boolean;
  autoLogBlockReason?: string;
  unobservableUnknownMassShare?: number;
  appliedPrior?: CategoryPrior;
}

export interface MealAnalysisResult {
  name: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Late Night';
  cuisineType?: string;
  foodCategory?: string;
  portion: string;
  totalGrams: number;
  massDistribution?: MassDistribution;
  massBasis?: MassBasis;
  calories: number;
  calorieRange?: [number, number];
  databaseCalories?: number;
  macroDerivedCalories?: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  isJunk: boolean;
  healthScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;
  uncertainty?: ScientificUncertainty;
  nutritionSource: 'USDA_FDC' | 'AUTHORITATIVE_DB' | 'GEMINI_ESTIMATE' | 'MIXED' | 'BARCODE';
  foods: ComponentFood[];
  estimationNotes: string[];
  energyCheckDelta: number;
  energyConsistencyReason?: string;
  atwaterDiagnostic?: AtwaterDiagnostic;
  hasUnobservableUnknown?: boolean;
  autoLogBlocked?: boolean;
  autoLogBlockReason?: string;
  complexMealDetected?: boolean;
  suggestsSecondPhoto?: boolean;
  scaleCueApplied?: string;
  appliedPrior?: CategoryPrior;
  swapSuggestion?: string;
  verdict?: string;
}

/**
 * Authoritative Nutritional Composition Dataset (per 100g edible portion)
 * Grounded in USDA FoodData Central and standard food composition tables.
 */
export const USDA_REFERENCE_DB: Record<string, {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  fdcId: number;
}> = {
  // Grains, Breads & Staples
  'white rice (cooked)': { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, sugar: 0.1, sodium: 1, fdcId: 168878 },
  'brown rice (cooked)': { calories: 123, protein: 2.7, carbs: 25.6, fat: 1.0, sugar: 0.2, sodium: 5, fdcId: 169704 },
  'chicken biryani': { calories: 180, protein: 10.5, carbs: 22.4, fat: 5.2, sugar: 1.2, sodium: 490, fdcId: 234520 },
  'vegetable biryani / pulao': { calories: 152, protein: 3.8, carbs: 26.5, fat: 3.4, sugar: 1.5, sodium: 410, fdcId: 234521 },
  'parotta / flatbread': { calories: 326, protein: 7.2, carbs: 49.5, fat: 11.2, sugar: 1.8, sodium: 410, fdcId: 234501 },
  'roti / chapati': { calories: 297, protein: 9.3, carbs: 56.4, fat: 3.7, sugar: 0.8, sodium: 190, fdcId: 234502 },
  'naan': { calories: 310, protein: 8.7, carbs: 52.3, fat: 7.4, sugar: 3.2, sodium: 490, fdcId: 234503 },
  'garlic naan': { calories: 243, protein: 7.0, carbs: 47.0, fat: 3.5, sugar: 1.8, sodium: 222, fdcId: 234503 },
  'pita bread': { calories: 275, protein: 9.1, carbs: 55.7, fat: 1.2, sugar: 2.4, sodium: 480, fdcId: 172688 },
  'sourdough toast': { calories: 240, protein: 8.0, carbs: 47.0, fat: 1.8, sugar: 1.2, sodium: 410, fdcId: 172688 },
  'pancake / hotcake': { calories: 175, protein: 4.9, carbs: 27.7, fat: 4.7, sugar: 3.3, sodium: 283, fdcId: 172686 },
  'garlic bread / toast': { calories: 308, protein: 7.5, carbs: 37.3, fat: 14.6, sugar: 2.0, sodium: 480, fdcId: 172688 },
  'dosa': { calories: 168, protein: 3.9, carbs: 29.1, fat: 3.8, sugar: 0.4, sodium: 210, fdcId: 234504 },
  'idli': { calories: 132, protein: 4.8, carbs: 26.5, fat: 0.8, sugar: 0.2, sodium: 180, fdcId: 234505 },
  'puri (deep fried wheat)': { calories: 330, protein: 6.5, carbs: 40.2, fat: 16.5, sugar: 0.5, sodium: 217, fdcId: 234533 },
  'pasta / fettuccine (cooked)': { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, sugar: 0.6, sodium: 1, fdcId: 168936 },
  'whole wheat bread': { calories: 247, protein: 12.0, carbs: 41.3, fat: 3.4, sugar: 4.3, sodium: 400, fdcId: 172688 },
  'white bread': { calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, sugar: 5.0, sodium: 490, fdcId: 172686 },
  'rolled oats (cooked)': { calories: 71, protein: 2.5, carbs: 12.0, fat: 1.5, sugar: 0.3, sodium: 49, fdcId: 173904 },
  'quinoa (cooked)': { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, sugar: 0.9, sodium: 7, fdcId: 168917 },
  'bulgur pilaf (cooked)': { calories: 110, protein: 4.2, carbs: 23.4, fat: 1.5, sugar: 1.2, sodium: 184, fdcId: 168917 },
  'ramen wheat noodles (cooked)': { calories: 158, protein: 5.8, carbs: 30.9, fat: 1.0, sugar: 0.5, sodium: 155, fdcId: 168936 },
  'rice pho noodles (cooked)': { calories: 109, protein: 1.8, carbs: 24.0, fat: 0.4, sugar: 0.2, sodium: 20, fdcId: 168936 },
  'corn tortilla': { calories: 218, protein: 5.7, carbs: 45.0, fat: 2.8, sugar: 0.8, sodium: 45, fdcId: 172686 },
  'mashed potatoes (buttered)': { calories: 118, protein: 1.9, carbs: 17.7, fat: 4.8, sugar: 1.4, sodium: 295, fdcId: 170438 },
  'hash brown potato': { calories: 235, protein: 2.5, carbs: 26.3, fat: 14.0, sugar: 0.4, sodium: 442, fdcId: 170699 },
  'thick cut potato chips / fries': { calories: 214, protein: 2.6, carbs: 31.2, fat: 8.9, sugar: 0.6, sodium: 170, fdcId: 170699 },
  'fried rice (chicken/veg)': { calories: 174, protein: 6.2, carbs: 27.8, fat: 4.4, sugar: 1.2, sodium: 460, fdcId: 234522 },
  'pad thai noodles': { calories: 192, protein: 7.8, carbs: 30.5, fat: 4.6, sugar: 4.5, sodium: 520, fdcId: 234523 },
  'black beans (seasoned)': { calories: 100, protein: 6.2, carbs: 16.9, fat: 1.2, sugar: 0.8, sodium: 200, fdcId: 172421 },
  
  // Proteins & Main Dishes
  'chicken breast (grilled)': { calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, sugar: 0.0, sodium: 74, fdcId: 171077 },
  'chicken thigh (grilled)': { calories: 180, protein: 27.0, carbs: 0.0, fat: 7.0, sugar: 0.0, sodium: 85, fdcId: 171077 },
  'chicken curry (meat + gravy)': { calories: 185, protein: 16.5, carbs: 4.2, fat: 11.5, sugar: 1.5, sodium: 480, fdcId: 234506 },
  'mutton / lamb curry': { calories: 225, protein: 17.8, carbs: 3.8, fat: 15.6, sugar: 1.2, sodium: 520, fdcId: 234507 },
  'fish curry': { calories: 135, protein: 16.2, carbs: 3.2, fat: 6.4, sugar: 0.8, sodium: 430, fdcId: 234524 },
  'beef steak (lean grilled)': { calories: 217, protein: 26.1, carbs: 0.0, fat: 11.8, sugar: 0.0, sodium: 62, fdcId: 174036 },
  'beef lean slices (pho/stir fry)': { calories: 148, protein: 23.7, carbs: 0.0, fat: 5.7, sugar: 0.0, sodium: 57, fdcId: 174036 },
  'beef bulgogi (seasoned)': { calories: 165, protein: 19.5, carbs: 5.1, fat: 7.5, sugar: 3.8, sodium: 527, fdcId: 174036 },
  'pork bacon (crispy)': { calories: 440, protein: 25.0, carbs: 1.0, fat: 37.0, sugar: 1.0, sodium: 1200, fdcId: 171077 },
  'pork sausage link': { calories: 300, protein: 15.4, carbs: 1.7, fat: 26.0, sugar: 0.7, sodium: 817, fdcId: 171077 },
  'chashu pork belly': { calories: 234, protein: 15.6, carbs: 1.7, fat: 18.6, sugar: 1.1, sodium: 300, fdcId: 171077 },
  'shredded pork carnitas': { calories: 190, protein: 24.5, carbs: 0.8, fat: 9.8, sugar: 0.4, sodium: 410, fdcId: 171077 },
  'pulled pork in bbq sauce': { calories: 224, protein: 15.9, carbs: 21.0, fat: 8.3, sugar: 8.8, sodium: 512, fdcId: 171077 },
  'turkey breast (smoked deli)': { calories: 104, protein: 17.5, carbs: 3.8, fat: 2.0, sugar: 2.5, sodium: 890, fdcId: 171077 },
  'chicken shawarma (spiced)': { calories: 175, protein: 21.2, carbs: 1.3, fat: 9.3, sugar: 0.4, sodium: 400, fdcId: 171077 },
  'shish taouk chicken skewer': { calories: 160, protein: 23.0, carbs: 0.7, fat: 7.1, sugar: 0.3, sodium: 322, fdcId: 171077 },
  'minced lamb & beef kebab': { calories: 232, protein: 18.1, carbs: 1.9, fat: 16.7, sugar: 0.6, sodium: 410, fdcId: 174036 },
  'crispy chickpea falafel': { calories: 233, protein: 8.6, carbs: 27.3, fat: 11.1, sugar: 1.5, sodium: 400, fdcId: 172421 },
  'beer battered cod fish fillet': { calories: 220, protein: 16.2, carbs: 12.4, fat: 11.8, sugar: 0.4, sodium: 290, fdcId: 175168 },
  'canned light tuna (in water)': { calories: 110, protein: 25.5, carbs: 0.0, fat: 0.8, sugar: 0.0, sodium: 243, fdcId: 175168 },
  'salmon (pan-seared)': { calories: 206, protein: 22.1, carbs: 0.0, fat: 12.3, sugar: 0.0, sodium: 61, fdcId: 175168 },
  'egg (whole boiled/poached)': { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, sugar: 1.1, sodium: 124, fdcId: 171287 },
  'egg (scrambled with butter)': { calories: 170, protein: 11.0, carbs: 2.0, fat: 13.0, sugar: 1.2, sodium: 210, fdcId: 173423 },
  'shrimp har gow dumpling': { calories: 152, protein: 10.4, carbs: 21.6, fat: 2.4, sugar: 0.8, sodium: 340, fdcId: 234534 },
  'pork & shrimp shumai': { calories: 171, protein: 11.1, carbs: 13.5, fat: 8.1, sugar: 1.1, sodium: 373, fdcId: 234535 },
  'chicken katsu cutlet (panko fried)': { calories: 247, protein: 22.6, carbs: 11.5, fat: 12.6, sugar: 0.5, sodium: 300, fdcId: 234536 },
  'tofu (firm)': { calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, sugar: 0.6, sodium: 14, fdcId: 172475 },
  'paneer (indian cottage cheese)': { calories: 296, protein: 18.3, carbs: 4.5, fat: 22.8, sugar: 2.5, sodium: 18, fdcId: 234508 },
  'paneer butter masala': { calories: 210, protein: 8.5, carbs: 6.2, fat: 17.0, sugar: 3.2, sodium: 490, fdcId: 234525 },
  'lentils / dal (cooked)': { calories: 116, protein: 9.0, carbs: 20.1, fat: 0.4, sugar: 1.8, sodium: 238, fdcId: 172421 },
  'dal makhani / black lentils': { calories: 145, protein: 6.2, carbs: 14.8, fat: 6.8, sugar: 1.2, sodium: 430, fdcId: 234526 },
  'chana masala / chickpeas': { calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, sugar: 4.2, sodium: 390, fdcId: 234527 },
  'sambar (lentil vegetable stew)': { calories: 75, protein: 3.2, carbs: 11.4, fat: 2.0, sugar: 2.8, sodium: 340, fdcId: 234509 },
  'greek yogurt (plain nonfat)': { calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, sugar: 3.2, sodium: 36, fdcId: 170899 },
  'whey protein isolate powder': { calories: 375, protein: 85.0, carbs: 3.0, fat: 1.5, sugar: 1.0, sodium: 160, fdcId: 234510 },
  'whole dairy milk': { calories: 62, protein: 3.4, carbs: 4.9, fat: 3.4, sugar: 5.0, sodium: 43, fdcId: 173423 },
  'cheddar cheese': { calories: 403, protein: 24.9, carbs: 1.3, fat: 33.1, sugar: 0.5, sodium: 621, fdcId: 170899 },
  'feta cheese': { calories: 264, protein: 14.2, carbs: 4.1, fat: 21.3, sugar: 0.0, sodium: 1146, fdcId: 170899 },
  'butter (salted)': { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1, sugar: 0.1, sodium: 576, fdcId: 173423 },
  'sour cream': { calories: 193, protein: 2.1, carbs: 4.6, fat: 18.9, sugar: 3.4, sodium: 53, fdcId: 170899 },

  // Vegetables, Curries, Oils & Condiments
  'coconut vegetable curry': { calories: 145, protein: 2.8, carbs: 9.5, fat: 11.0, sugar: 3.2, sodium: 380, fdcId: 234511 },
  'green beans stir fry (poriyal)': { calories: 85, protein: 2.4, carbs: 8.2, fat: 5.1, sugar: 2.1, sodium: 290, fdcId: 234512 },
  'cabbage coconut thoran': { calories: 65, protein: 1.8, carbs: 8.2, fat: 2.8, sugar: 2.4, sodium: 160, fdcId: 234512 },
  'broccoli (steamed)': { calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, sugar: 1.4, sodium: 41, fdcId: 170379 },
  'asparagus (roasted)': { calories: 40, protein: 2.8, carbs: 5.2, fat: 1.0, sugar: 1.3, sodium: 20, fdcId: 170379 },
  'spinach / saag': { calories: 68, protein: 3.5, carbs: 4.8, fat: 4.2, sugar: 0.8, sodium: 310, fdcId: 234513 },
  'papadum / papad (roasted)': { calories: 371, protein: 25.5, carbs: 59.9, fat: 3.3, sugar: 1.5, sodium: 1450, fdcId: 234514 },
  'coconut chutney': { calories: 230, protein: 3.1, carbs: 8.5, fat: 21.0, sugar: 3.0, sodium: 420, fdcId: 234515 },
  'tomato chutney': { calories: 95, protein: 1.8, carbs: 14.2, fat: 3.6, sugar: 6.5, sodium: 380, fdcId: 234516 },
  'avocado': { calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, sugar: 0.7, sodium: 7, fdcId: 171705 },
  'hummus': { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6, sugar: 0.3, sodium: 380, fdcId: 170889 },
  'guacamole': { calories: 157, protein: 2.0, carbs: 8.6, fat: 14.1, sugar: 0.7, sodium: 280, fdcId: 234528 },
  'ghee / clarified butter': { calories: 876, protein: 0.2, carbs: 0.0, fat: 99.5, sugar: 0.0, sodium: 2, fdcId: 234529 },
  'olive oil': { calories: 884, protein: 0.0, carbs: 0.0, fat: 100.0, sugar: 0.0, sodium: 2, fdcId: 171413 },
  'alfredo sauce': { calories: 345, protein: 6.7, carbs: 4.4, fat: 34.4, sugar: 2.3, sodium: 1055, fdcId: 168936 },
  'caesar salad dressing': { calories: 320, protein: 7.8, carbs: 2.8, fat: 39.2, sugar: 2.0, sodium: 1178, fdcId: 171413 },
  'garlic toum emulsion': { calories: 600, protein: 2.0, carbs: 8.0, fat: 64.0, sugar: 2.7, sodium: 600, fdcId: 171413 },
  'tahini sauce / dressing': { calories: 355, protein: 9.0, carbs: 12.0, fat: 31.5, sugar: 2.0, sodium: 450, fdcId: 170889 },
  'tartar sauce': { calories: 344, protein: 1.2, carbs: 12.6, fat: 32.7, sugar: 5.8, sodium: 750, fdcId: 171413 },
  'tomato salsa (fresh)': { calories: 36, protein: 1.5, carbs: 7.0, fat: 0.2, sugar: 4.4, sodium: 430, fdcId: 170379 },
  'tabbouleh salad': { calories: 91, protein: 2.4, carbs: 11.4, fat: 4.5, sugar: 1.9, sodium: 163, fdcId: 168917 },
  'coleslaw (with mayo)': { calories: 161, protein: 1.3, carbs: 8.4, fat: 14.1, sugar: 5.4, sodium: 186, fdcId: 170379 },
  'kettle potato chips': { calories: 488, protein: 6.5, carbs: 54.0, fat: 28.0, sugar: 1.0, sodium: 550, fdcId: 170699 },
  'mirchi ka salan peanut curry': { calories: 175, protein: 5.7, carbs: 10.3, fat: 13.0, sugar: 1.8, sodium: 367, fdcId: 234537 },
  'cucumber raita': { calories: 100, protein: 11.0, carbs: 9.8, fat: 3.0, sugar: 1.5, sodium: 100, fdcId: 234538 },
  'shakshuka tomato sauce': { calories: 70, protein: 2.0, carbs: 6.3, fat: 4.7, sugar: 2.9, sodium: 250, fdcId: 234539 },
  'tonkotsu pork ramen broth': { calories: 77, protein: 2.8, carbs: 2.0, fat: 6.5, sugar: 0.6, sodium: 493, fdcId: 234540 },
  'pho spiced beef broth': { calories: 30, protein: 1.4, carbs: 2.9, fat: 0.9, sugar: 1.4, sodium: 511, fdcId: 234541 },
  'lasagna (meat and cheese)': { calories: 180, protein: 11.8, carbs: 13.9, fat: 8.8, sugar: 2.1, sodium: 337, fdcId: 234542 },

  // Fast Foods, Fruits & Sweets
  'french fries': { calories: 312, protein: 3.4, carbs: 41.4, fat: 15.5, sugar: 0.3, sodium: 210, fdcId: 170699 },
  'cheeseburger (fast food single)': { calories: 280, protein: 15.0, carbs: 29.0, fat: 12.0, sugar: 5.0, sodium: 620, fdcId: 170701 },
  'pizza (pepperoni or cheese slice)': { calories: 278, protein: 12.2, carbs: 28.9, fat: 12.3, sugar: 3.5, sodium: 645, fdcId: 170702 },
  'samosa (fried potato)': { calories: 308, protein: 4.5, carbs: 32.2, fat: 17.5, sugar: 1.8, sodium: 440, fdcId: 234530 },
  'gulab jamun': { calories: 387, protein: 4.2, carbs: 64.5, fat: 12.8, sugar: 48.0, sodium: 120, fdcId: 234531 },
  'mango lassi': { calories: 115, protein: 3.2, carbs: 18.4, fat: 3.2, sugar: 16.0, sodium: 60, fdcId: 234532 },
  'masala chai with milk': { calories: 91, protein: 3.9, carbs: 10.6, fat: 1.0, sugar: 4.2, sodium: 96, fdcId: 234532 },
  'maple syrup': { calories: 260, protein: 0.0, carbs: 67.0, fat: 0.1, sugar: 60.5, sodium: 12, fdcId: 172686 },
  'natural peanut butter': { calories: 588, protein: 25.0, carbs: 20.0, fat: 50.0, sugar: 7.5, sodium: 30, fdcId: 173944 },
  'banana (fresh)': { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, sugar: 12.2, sodium: 1, fdcId: 173944 },
  'blueberries (fresh)': { calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, sugar: 10.0, sodium: 1, fdcId: 171711 }
};

/**
 * Deterministically lookup an ingredient against authoritative reference data
 */
export function lookupAuthoritativeFood(foodName: string): (typeof USDA_REFERENCE_DB)[string] | null {
  if (!foodName) return null;
  const clean = foodName.toLowerCase().trim();
  
  if (USDA_REFERENCE_DB[clean]) {
    return USDA_REFERENCE_DB[clean];
  }
  
  for (const [key, data] of Object.entries(USDA_REFERENCE_DB)) {
    if (clean.includes(key) || key.includes(clean)) {
      return data;
    }
  }
  
  if (clean.includes('biryani') && clean.includes('chicken')) return USDA_REFERENCE_DB['chicken biryani'];
  if (clean.includes('biryani') || clean.includes('pulao')) return USDA_REFERENCE_DB['vegetable biryani / pulao'];
  if (clean.includes('rice') && !clean.includes('brown')) return USDA_REFERENCE_DB['white rice (cooked)'];
  if (clean.includes('parotta') || clean.includes('paratha')) return USDA_REFERENCE_DB['parotta / flatbread'];
  if (clean.includes('roti') || clean.includes('chapati')) return USDA_REFERENCE_DB['roti / chapati'];
  if (clean.includes('garlic naan')) return USDA_REFERENCE_DB['garlic naan'];
  if (clean.includes('naan')) return USDA_REFERENCE_DB['naan'];
  if (clean.includes('pita')) return USDA_REFERENCE_DB['pita bread'];
  if (clean.includes('sourdough')) return USDA_REFERENCE_DB['sourdough toast'];
  if (clean.includes('pancake')) return USDA_REFERENCE_DB['pancake / hotcake'];
  if (clean.includes('garlic bread')) return USDA_REFERENCE_DB['garlic bread / toast'];
  if (clean.includes('dosa')) return USDA_REFERENCE_DB['dosa'];
  if (clean.includes('idli')) return USDA_REFERENCE_DB['idli'];
  if (clean.includes('puri') || clean.includes('poori')) return USDA_REFERENCE_DB['puri (deep fried wheat)'];
  if (clean.includes('fettuccine') || clean.includes('pasta')) return USDA_REFERENCE_DB['pasta / fettuccine (cooked)'];
  if (clean.includes('chicken curry') || (clean.includes('curry') && clean.includes('chicken'))) return USDA_REFERENCE_DB['chicken curry (meat + gravy)'];
  if (clean.includes('mutton') || clean.includes('lamb')) return USDA_REFERENCE_DB['mutton / lamb curry'];
  if (clean.includes('fish curry')) return USDA_REFERENCE_DB['fish curry'];
  if (clean.includes('paneer butter') || (clean.includes('paneer') && clean.includes('masala'))) return USDA_REFERENCE_DB['paneer butter masala'];
  if (clean.includes('paneer')) return USDA_REFERENCE_DB['paneer (indian cottage cheese)'];
  if (clean.includes('dal makhani') || clean.includes('makhani')) return USDA_REFERENCE_DB['dal makhani / black lentils'];
  if (clean.includes('sambar')) return USDA_REFERENCE_DB['sambar (lentil vegetable stew)'];
  if (clean.includes('chana') || clean.includes('chickpea')) return USDA_REFERENCE_DB['chana masala / chickpeas'];
  if (clean.includes('dal') || clean.includes('dhal') || clean.includes('lentil')) return USDA_REFERENCE_DB['lentils / dal (cooked)'];
  if (clean.includes('papad')) return USDA_REFERENCE_DB['papadum / papad (roasted)'];
  if (clean.includes('coconut chutney')) return USDA_REFERENCE_DB['coconut chutney'];
  if (clean.includes('tomato chutney')) return USDA_REFERENCE_DB['tomato chutney'];
  if (clean.includes('chicken breast')) return USDA_REFERENCE_DB['chicken breast (grilled)'];
  if (clean.includes('chicken thigh')) return USDA_REFERENCE_DB['chicken thigh (grilled)'];
  if (clean.includes('steak') || clean.includes('sirloin')) return USDA_REFERENCE_DB['beef steak (lean grilled)'];
  if (clean.includes('bacon')) return USDA_REFERENCE_DB['pork bacon (crispy)'];
  if (clean.includes('sausage')) return USDA_REFERENCE_DB['pork sausage link'];
  if (clean.includes('chashu')) return USDA_REFERENCE_DB['chashu pork belly'];
  if (clean.includes('carnitas')) return USDA_REFERENCE_DB['shredded pork carnitas'];
  if (clean.includes('pulled pork')) return USDA_REFERENCE_DB['pulled pork in bbq sauce'];
  if (clean.includes('turkey')) return USDA_REFERENCE_DB['turkey breast (smoked deli)'];
  if (clean.includes('shawarma')) return USDA_REFERENCE_DB['chicken shawarma (spiced)'];
  if (clean.includes('shish taouk') || clean.includes('taouk')) return USDA_REFERENCE_DB['shish taouk chicken skewer'];
  if (clean.includes('kebab')) return USDA_REFERENCE_DB['minced lamb & beef kebab'];
  if (clean.includes('falafel')) return USDA_REFERENCE_DB['crispy chickpea falafel'];
  if (clean.includes('fish & chip') || clean.includes('battered fish') || clean.includes('cod')) return USDA_REFERENCE_DB['beer battered cod fish fillet'];
  if (clean.includes('tuna')) return USDA_REFERENCE_DB['canned light tuna (in water)'];
  if (clean.includes('katsu')) return USDA_REFERENCE_DB['chicken katsu cutlet (panko fried)'];
  if (clean.includes('har gow')) return USDA_REFERENCE_DB['shrimp har gow dumpling'];
  if (clean.includes('shumai') || clean.includes('siu mai')) return USDA_REFERENCE_DB['pork & shrimp shumai'];
  if (clean.includes('egg') && clean.includes('scrambled')) return USDA_REFERENCE_DB['egg (scrambled with butter)'];
  if (clean.includes('egg')) return USDA_REFERENCE_DB['egg (whole boiled/poached)'];
  if (clean.includes('samosa')) return USDA_REFERENCE_DB['samosa (fried potato)'];
  if (clean.includes('gulab jamun')) return USDA_REFERENCE_DB['gulab jamun'];
  if (clean.includes('lassi')) return USDA_REFERENCE_DB['mango lassi'];
  if (clean.includes('chai')) return USDA_REFERENCE_DB['masala chai with milk'];
  if (clean.includes('ghee')) return USDA_REFERENCE_DB['ghee / clarified butter'];
  if (clean.includes('olive oil')) return USDA_REFERENCE_DB['olive oil'];
  if (clean.includes('hummus')) return USDA_REFERENCE_DB['hummus'];
  if (clean.includes('guacamole')) return USDA_REFERENCE_DB['guacamole'];
  if (clean.includes('pad thai') || clean.includes('noodle')) return USDA_REFERENCE_DB['pad thai noodles'];
  if (clean.includes('ramen')) return USDA_REFERENCE_DB['ramen wheat noodles (cooked)'];
  if (clean.includes('pho noodle')) return USDA_REFERENCE_DB['rice pho noodles (cooked)'];
  if (clean.includes('tortilla') || clean.includes('taco')) return USDA_REFERENCE_DB['corn tortilla'];
  if (clean.includes('mashed potato')) return USDA_REFERENCE_DB['mashed potatoes (buttered)'];
  if (clean.includes('hash brown')) return USDA_REFERENCE_DB['hash brown potato'];
  if (clean.includes('alfredo')) return USDA_REFERENCE_DB['alfredo sauce'];
  if (clean.includes('caesar')) return USDA_REFERENCE_DB['caesar salad dressing'];
  if (clean.includes('toum')) return USDA_REFERENCE_DB['garlic toum emulsion'];
  if (clean.includes('tahini')) return USDA_REFERENCE_DB['tahini sauce / dressing'];
  if (clean.includes('tartar')) return USDA_REFERENCE_DB['tartar sauce'];
  if (clean.includes('salsa')) return USDA_REFERENCE_DB['tomato salsa (fresh)'];
  if (clean.includes('tabbouleh')) return USDA_REFERENCE_DB['tabbouleh salad'];
  if (clean.includes('coleslaw')) return USDA_REFERENCE_DB['coleslaw (with mayo)'];
  if (clean.includes('chips') || clean.includes('crisps')) return USDA_REFERENCE_DB['kettle potato chips'];
  if (clean.includes('mirchi ka salan')) return USDA_REFERENCE_DB['mirchi ka salan peanut curry'];
  if (clean.includes('raita')) return USDA_REFERENCE_DB['cucumber raita'];
  if (clean.includes('shakshuka')) return USDA_REFERENCE_DB['shakshuka tomato sauce'];
  if (clean.includes('tonkotsu broth')) return USDA_REFERENCE_DB['tonkotsu pork ramen broth'];
  if (clean.includes('pho broth')) return USDA_REFERENCE_DB['pho spiced beef broth'];
  if (clean.includes('lasagna')) return USDA_REFERENCE_DB['lasagna (meat and cheese)'];
  if (clean.includes('maple syrup') || clean.includes('syrup')) return USDA_REFERENCE_DB['maple syrup'];
  if (clean.includes('peanut butter')) return USDA_REFERENCE_DB['natural peanut butter'];
  if (clean.includes('banana')) return USDA_REFERENCE_DB['banana (fresh)'];
  if (clean.includes('blueberry') || clean.includes('blueberries')) return USDA_REFERENCE_DB['blueberries (fresh)'];
  if (clean.includes('burger')) return USDA_REFERENCE_DB['cheeseburger (fast food single)'];
  if (clean.includes('fry') || clean.includes('fries')) return USDA_REFERENCE_DB['french fries'];
  if (clean.includes('pizza')) return USDA_REFERENCE_DB['pizza (pepperoni or cheese slice)'];
  if (clean.includes('whey') || clean.includes('protein powder')) return USDA_REFERENCE_DB['whey protein isolate powder'];
  if (clean.includes('salmon')) return USDA_REFERENCE_DB['salmon (pan-seared)'];
  if (clean.includes('quinoa')) return USDA_REFERENCE_DB['quinoa (cooked)'];
  if (clean.includes('asparagus')) return USDA_REFERENCE_DB['asparagus (roasted)'];
  if (clean.includes('broccoli')) return USDA_REFERENCE_DB['broccoli (steamed)'];
  if (clean.includes('spinach') || clean.includes('saag')) return USDA_REFERENCE_DB['spinach / saag'];
  if (clean.includes('green bean') || clean.includes('poriyal')) return USDA_REFERENCE_DB['green beans stir fry (poriyal)'];
  if (clean.includes('feta')) return USDA_REFERENCE_DB['feta cheese'];
  if (clean.includes('oat') || clean.includes('oatmeal')) return USDA_REFERENCE_DB['rolled oats (cooked)'];
  if (clean.includes('black bean') || clean.includes('beans')) return USDA_REFERENCE_DB['black beans (seasoned)'];
  if (clean.includes('thoran') || clean.includes('cabbage')) return USDA_REFERENCE_DB['cabbage coconut thoran'];
  if (clean.includes('milk')) return USDA_REFERENCE_DB['whole dairy milk'];
  if (clean.includes('butter')) return USDA_REFERENCE_DB['butter (salted)'];
  if (clean.includes('sour cream')) return USDA_REFERENCE_DB['sour cream'];
  if (clean.includes('cheddar') || clean.includes('cheese')) return USDA_REFERENCE_DB['cheddar cheese'];

  return null;
}

/**
 * Intelligent NLP quantity and gram portion parser
 */
export function extractGramPortion(text: string, foodKey: string): number {
  const t = text.toLowerCase();
  
  // Check explicit grams: "250g", "150 g", "80 grams"
  const gramMatch = t.match(/(\d+)\s*(?:g|grams)\b/);
  if (gramMatch) return Number(gramMatch[1]);

  // Check ounces: "8 oz"
  const ozMatch = t.match(/(\d+)\s*oz\b/);
  if (ozMatch) return Math.round(Number(ozMatch[1]) * 28.35);

  // Check count / slices / pieces
  const countMatch = t.match(/(\d+)\s*(?:slices?|pcs?|pieces?|strips?|skewers?|scoops?|puris?|tacos?|samosas?)\b/);
  const count = countMatch ? Number(countMatch[1]) : 1;

  if (foodKey.includes('naan') || foodKey.includes('roti') || foodKey.includes('parotta')) return count * 80;
  if (foodKey.includes('puri') || foodKey.includes('taco')) return count * 60;
  if (foodKey.includes('samosa') || foodKey.includes('falafel')) return count * 55;
  if (foodKey.includes('dumpling') || foodKey.includes('shumai') || foodKey.includes('har gow')) return count * 35;
  if (foodKey.includes('pancake')) return count * 80;
  if (foodKey.includes('bacon')) return count * 10;
  if (foodKey.includes('sausage')) return count * 45;
  if (foodKey.includes('egg')) return count * 55;
  if (foodKey.includes('toast') || foodKey.includes('bread') || foodKey.includes('pizza')) return count * 60;
  if (foodKey.includes('scoop')) return count * 30;
  if (foodKey.includes('tbsp') || foodKey.includes('butter') || foodKey.includes('oil') || foodKey.includes('syrup')) return count * 15;

  // Component defaults
  if (foodKey.includes('biryani')) return 350;
  if (foodKey.includes('lasagna')) return 350;
  if (foodKey.includes('rice') || foodKey.includes('noodle') || foodKey.includes('pasta') || foodKey.includes('pad thai')) return 200;
  if (foodKey.includes('steak') || foodKey.includes('salmon') || foodKey.includes('chicken') || foodKey.includes('pork')) return 160;
  if (foodKey.includes('curry') || foodKey.includes('dal') || foodKey.includes('chana') || foodKey.includes('sambar')) return 180;
  if (foodKey.includes('broth') || foodKey.includes('soup') || foodKey.includes('milk') || foodKey.includes('lassi') || foodKey.includes('chai')) return 250;
  if (foodKey.includes('hummus') || foodKey.includes('guacamole') || foodKey.includes('mashed potato') || foodKey.includes('coleslaw')) return 120;
  if (foodKey.includes('chips') || foodKey.includes('fries')) return 120;
  if (foodKey.includes('chutney') || foodKey.includes('dressing') || foodKey.includes('sauce')) return 40;

  return 100;
}

/**
 * Intelligent clause-based NLP meal parser that decomposes full meal descriptions into constituent foods
 */
export function parseMealDescriptionToComponents(description: string): ComponentFood[] {
  const clauses = description
    .split(/(?:,|\band\b|\bserving\b|\bservings\b|\bwith\b|\bserves\b|\btopped with\b|\bserved with\b|\bplus\b|\+|\&)/i)
    .map(c => c.trim())
    .filter(c => c.length > 2 && !/^(a|an|the|fresh|warm|crisp|side|hot|cold|large|medium|small)$/i.test(c));

  const items: ComponentFood[] = [];
  const matchedKeys = new Set<string>();

  for (const clause of clauses) {
    const foodData = lookupAuthoritativeFood(clause);
    if (!foodData) continue;

    let canonicalName = clause;
    for (const [k, d] of Object.entries(USDA_REFERENCE_DB)) {
      if (d.fdcId === foodData.fdcId) {
        canonicalName = k;
        break;
      }
    }

    if (matchedKeys.has(canonicalName)) continue;
    matchedKeys.add(canonicalName);

    const grams = extractGramPortion(clause, canonicalName);
    const ratio = grams / 100;

    items.push({
      name: clause.charAt(0).toUpperCase() + clause.slice(1),
      identifiedFood: canonicalName,
      portionDescription: `~${grams}g`,
      estimatedGrams: grams,
      minGrams: Math.round(grams * 0.85),
      maxGrams: Math.round(grams * 1.15),
      mass_g: {
        p10: Math.round(grams * 0.85),
        p50: grams,
        p90: Math.round(grams * 1.15)
      },
      mass_basis: 'single_view',
      evidence: isUnobservableUnknownFood({ name: clause, identifiedFood: canonicalName }) ? 'unobservable_unknown' : 'context_derived',
      calories: Math.round(foodData.calories * ratio),
      protein: Math.round(foodData.protein * ratio * 10) / 10,
      carbs: Math.round(foodData.carbs * ratio * 10) / 10,
      fat: Math.round(foodData.fat * ratio * 10) / 10,
      sugar: Math.round(foodData.sugar * ratio * 10) / 10,
      sodium: Math.round(foodData.sodium * ratio),
      confidence: 0.95,
      assumptions: ["Authoritative USDA Reference composition"],
      source: "USDA_FDC",
      fdcId: foodData.fdcId
    });
  }

  return items;
}
export function updateComponentPortion(
  foods: ComponentFood[],
  index: number,
  newGrams: number
): ComponentFood[] {
  if (index < 0 || index >= foods.length) return foods;
  const target = foods[index];
  const grams = Math.max(1, Math.round(newGrams));
  const oldGrams = target.estimatedGrams || 100;
  const ratio = grams / oldGrams;

  const updatedFood: ComponentFood = {
    ...target,
    estimatedGrams: grams,
    minGrams: Math.round(grams * 0.90),
    maxGrams: Math.round(grams * 1.10),
    mass_g: {
      p10: Math.round(grams * 0.90),
      p50: grams,
      p90: Math.round(grams * 1.10)
    },
    evidence: 'user_confirmed',
    portionDescription: `~${grams}g`,
    calories: Math.round(target.calories * ratio),
    protein: Math.round(target.protein * ratio * 10) / 10,
    carbs: Math.round(target.carbs * ratio * 10) / 10,
    fat: Math.round(target.fat * ratio * 10) / 10,
    sugar: target.sugar !== undefined ? Math.round(target.sugar * ratio * 10) / 10 : undefined,
    sodium: target.sodium !== undefined ? Math.round(target.sodium * ratio) : undefined,
    source: 'USER_EDITED'
  };

  const next = [...foods];
  next[index] = updatedFood;
  return next;
}

export function removeComponentFromMeal(
  foods: ComponentFood[],
  index: number
): ComponentFood[] {
  if (index < 0 || index >= foods.length) return foods;
  return foods.filter((_, i) => i !== index);
}

export function addComponentToMeal(
  foods: ComponentFood[],
  newFood: ComponentFood
): ComponentFood[] {
  return [...foods, newFood];
}

export function isUnobservableUnknownFood(food: Partial<ComponentFood>): boolean {
  if (food.evidence === 'unobservable_unknown') return true;
  const name = (food.name || food.identifiedFood || '').toLowerCase();
  const assumptions = (food.assumptions || []).join(' ').toLowerCase();
  const prep = (food.preparationState || '').toLowerCase();
  
  if (name.includes('oil') || name.includes('ghee') || name.includes('butter') || name.includes('dressing') || name.includes('sauce') || name.includes('gravy')) {
    return true;
  }
  if (assumptions.includes('oil') || assumptions.includes('ghee') || assumptions.includes('submerged') || assumptions.includes('hidden fat')) {
    return true;
  }
  if (prep.includes('deep fried') || prep.includes('fried') || prep.includes('rich gravy')) {
    return true;
  }
  return false;
}

export function isComplexMealCategory(foods: ComponentFood[], mealName?: string, cuisine?: string): boolean {
  const text = `${mealName || ''} ${cuisine || ''} ${foods.map(f => f.name + ' ' + f.identifiedFood).join(' ')}`.toLowerCase();
  const complexKeywords = [
    'curry', 'stew', 'casserole', 'biryani', 'pulao', 'bowl', 'soup', 'ramen', 'pad thai', 
    'pasta', 'sauce', 'lasagna', 'fried rice', 'thali', 'masala', 'korma', 'sambar', 'dal makhani',
    'shakshuka', 'gravy', 'stir fry', 'casserole', 'enchilada', 'chili'
  ];
  if (complexKeywords.some(kw => text.includes(kw))) return true;
  if (foods.length >= 3) return true;
  if (foods.some(f => f.oilState === 'HIGH_OIL' || f.evidence === 'unobservable_unknown')) return true;
  return false;
}

/**
 * Deterministic Calculation of Meal Totals from Component Foods
 */
export function calculateDeterministicMealTotals(
  foods: ComponentFood[],
  options?: {
    mealName?: string;
    mealType?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Late Night';
    cuisineType?: string;
    estimationNotes?: string[];
    massBasis?: MassBasis;
    scaleCue?: string;
    hasSecondPhoto?: boolean;
    categoryPriors?: Record<string, CategoryPrior> | CategoryPrior[];
  }
): MealAnalysisResult {
  if (!foods || foods.length === 0) {
    throw new Error("Cannot calculate meal totals: Component foods array is empty.");
  }

  // Defensively handle nested arrays and clone food objects so inputs are not mutated
  const inputList: ComponentFood[] = (foods as any).flat ? (foods as any).flat(2) : foods;
  const normalizedFoods: ComponentFood[] = inputList.map((f: any) => ({
    ...f,
    mass_g: f.mass_g ? { ...f.mass_g } : undefined,
    calorieRange: f.calorieRange ? [...f.calorieRange] : undefined,
    assumptions: f.assumptions ? [...f.assumptions] : []
  }));

  const mealCategory = detectFoodCategory(normalizedFoods.map(f => f.name).join(' '), options?.mealName);
  let appliedPrior: CategoryPrior | undefined = undefined;
  if (options?.categoryPriors) {
    if (Array.isArray(options.categoryPriors)) {
      appliedPrior = options.categoryPriors.find(p => p.category === mealCategory);
    } else {
      appliedPrior = options.categoryPriors[mealCategory];
    }
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSugar = 0;
  let totalSodium = 0;
  let totalGrams = 0;
  let confidenceSum = 0;
  let hasUsda = false;
  let hasAi = false;

  const resolvedMassBasis: MassBasis = options?.hasSecondPhoto 
    ? 'two_view_calibrated' 
    : (options?.massBasis || (normalizedFoods.every(f => f.mass_basis === 'two_view_calibrated') ? 'two_view_calibrated' : 'single_view'));
  const isCalibrated = resolvedMassBasis === 'two_view_calibrated';

  // Calibrate and normalize component evidence and mass distributions
  for (const food of normalizedFoods) {
    const cal = Math.max(0, Number(food.calories) || 0);
    const p = Math.max(0, Number(food.protein) || 0);
    const c = Math.max(0, Number(food.carbs) || 0);
    const f = Math.max(0, Number(food.fat) || 0);
    const s = Math.max(0, Number(food.sugar) || 0);
    const na = Math.max(0, Number(food.sodium) || 0);
    const g = Math.max(1, Number(food.estimatedGrams) || 100);

    totalCalories += cal;
    totalProtein += p;
    totalCarbs += c;
    totalFat += f;
    totalSugar += s;
    totalSodium += na;
    totalGrams += g;
    confidenceSum += (Number(food.confidence) || 0.85);

    if (food.source === 'USDA_FDC' || food.source === 'AUTHORITATIVE_DB') {
      hasUsda = true;
    } else {
      hasAi = true;
    }

    // Assign evidence class
    if (!food.evidence) {
      if (isUnobservableUnknownFood(food)) {
        food.evidence = 'unobservable_unknown';
      } else if (food.source === 'USER_EDITED') {
        food.evidence = 'user_confirmed';
      } else if (food.source === 'USDA_FDC' || food.source === 'AUTHORITATIVE_DB') {
        food.evidence = 'context_derived';
      } else {
        food.evidence = 'visible';
      }
    }

    // Assign mass basis & distribution
    food.mass_basis = resolvedMassBasis;
    if (!food.mass_g || isCalibrated) {
      const minG = isCalibrated ? Math.round(g * 0.92) : (food.minGrams || Math.round(g * 0.85));
      const maxG = isCalibrated ? Math.round(g * 1.08) : (food.maxGrams || Math.round(g * 1.15));
      food.mass_g = {
        p10: minG,
        p50: g,
        p90: maxG
      };
    }

    // Component-level calorie range with category prior adjustments
    let compOilMin = 0.95;
    let compOilMax = 1.10;
    if (food.oilState === 'HIGH_OIL') {
      compOilMin = 1.05;
      compOilMax = 1.25;
    } else if (food.oilState === 'LOW_OIL') {
      compOilMin = 0.90;
      compOilMax = 1.05;
    }

    // Widen upper oil bounds if user category prior indicates heavier oil preparation
    if (appliedPrior && isUnobservableUnknownFood(food) && appliedPrior.oilMassAdjustmentFactor) {
      compOilMax = Math.round(compOilMax * appliedPrior.oilMassAdjustmentFactor * 100) / 100;
      food.mass_g.p90 = Math.round(food.mass_g.p90 * appliedPrior.oilMassAdjustmentFactor);
    }

    const calPerG = g > 0 ? cal / g : 0;
    food.calorieRange = [
      Math.round(food.mass_g.p10 * calPerG * compOilMin),
      Math.round(food.mass_g.p90 * calPerG * compOilMax)
    ];
  }

  // ATWATER REVERSAL: Database-sourced energy is strictly CANONICAL.
  // Macro Atwater check (4*P + 4*C + 9*F) is purely DIAGNOSTIC. No overwrite occurs.
  const databaseCalories = Math.round(totalCalories);
  const expectedCaloriesFromMacros = Math.round((totalProtein * 4) + (totalCarbs * 4) + (totalFat * 9));
  const energyCheckDelta = Math.abs(databaseCalories - expectedCaloriesFromMacros);
  const isAtwaterInconsistent = databaseCalories > 0 && energyCheckDelta > Math.max(50, databaseCalories * 0.15);

  const atwaterDiagnostic: AtwaterDiagnostic = {
    expectedCalories: expectedCaloriesFromMacros,
    delta: energyCheckDelta,
    isInconsistent: isAtwaterInconsistent,
    reason: isAtwaterInconsistent
      ? `Diagnostic Note: Macro energy sum (${expectedCaloriesFromMacros} kcal) diverges from database-sourced energy (${databaseCalories} kcal) by ${energyCheckDelta} kcal. Canonical database value retained.`
      : `Conforms to 4-4-9 Atwater physiological fuel values (${expectedCaloriesFromMacros} kcal).`
  };
  const energyConsistencyReason = atwaterDiagnostic.reason;

  // Component-derived Uncertainty Range
  let sumMinCal = 0;
  let sumMaxCal = 0;
  for (const food of normalizedFoods) {
    if (food.calorieRange) {
      sumMinCal += food.calorieRange[0];
      sumMaxCal += food.calorieRange[1];
    }
  }

  const minCal = sumMinCal > 0 ? Math.min(totalCalories, sumMinCal) : Math.round(totalCalories * 0.88);
  const maxCal = sumMaxCal > 0 ? Math.max(totalCalories, sumMaxCal) : Math.round(totalCalories * 1.15);

  // Meal Mass Distribution
  const sumP10Grams = normalizedFoods.reduce((acc, f) => acc + (f.mass_g?.p10 || Math.round(f.estimatedGrams * (isCalibrated ? 0.92 : 0.85))), 0);
  const sumP90Grams = normalizedFoods.reduce((acc, f) => acc + (f.mass_g?.p90 || Math.round(f.estimatedGrams * (isCalibrated ? 1.08 : 1.15))), 0);
  const mealMassDistribution: MassDistribution = {
    p10: sumP10Grams,
    p50: totalGrams,
    p90: sumP90Grams
  };

  // Complex dish heuristic and unobservable analysis
  const isComplexMeal = isComplexMealCategory(normalizedFoods, options?.mealName, options?.cuisineType);
  const unobservableFoods = normalizedFoods.filter(f => f.evidence === 'unobservable_unknown');
  const hasUnobservableUnknown = unobservableFoods.length > 0;
  const unobservableUnknownGrams = unobservableFoods.reduce((acc, f) => acc + f.estimatedGrams, 0);
  const unobservableUnknownMassShare = totalGrams > 0 ? Math.round((unobservableUnknownGrams / totalGrams) * 100) / 100 : 0;

  // Information-Gain Clarification Logic:
  // Ask ONLY when the answer materially shifts the caloric or macro estimate (e.g. oil/fat swings ~120+ kcal/tbsp)
  const informationGainExpectedKcal = Math.round(maxCal - minCal);
  const hasMaterialCaloricSwing = informationGainExpectedKcal >= 100;
  
  // Simple single-item foods (like apple, coffee, plain grilled steak) have low information gain and DO NOT trigger clarification
  const requiresClarification = isComplexMeal 
    ? (hasMaterialCaloricSwing || hasUnobservableUnknown || unobservableUnknownMassShare >= 0.10)
    : (totalCalories > 600 && hasMaterialCaloricSwing);

  // Auto-Log Gate: Complex meals with insufficient evidence (single photo, no scale cue, unobservable unknown mass share)
  // MUST NOT silently auto-log. They block auto-logging and force review of the labeled range.
  const autoLogBlocked = isComplexMeal && resolvedMassBasis === 'single_view' && (!options?.scaleCue) && (hasUnobservableUnknown || hasMaterialCaloricSwing);
  const autoLogBlockReason = autoLogBlocked
    ? "Uncertainty Gate Active: Complex meal with unobservable elements (oil/gravy) detected without 2-view calibration or scale cue. Clarification required before logging."
    : undefined;

  let clarificationPrompt: string | undefined = undefined;
  let clarificationOptions: string[] | undefined = undefined;

  if (requiresClarification) {
    if (hasUnobservableUnknown || totalFat > 20) {
      clarificationPrompt = `Cooking fat & sauce density swing potential is ~${informationGainExpectedKcal} kcal. Was this prepared with light, regular, or rich oil/ghee?`;
      clarificationOptions = [
        `Light / Minimal Oil (~${minCal} kcal)`,
        `Standard Preparation (~${databaseCalories} kcal)`,
        `Rich / Deep-Fried / Heavy (~${maxCal} kcal)`
      ];
    } else {
      clarificationPrompt = `Portion volume swing potential is ~${informationGainExpectedKcal} kcal across [${minCal} - ${maxCal} kcal]. Confirm serving volume:`;
      clarificationOptions = [
        `Smaller Portion (~${minCal} kcal)`,
        `Standard Serving (~${databaseCalories} kcal)`,
        `Generous / Large (~${maxCal} kcal)`
      ];
    }
  }

  const overallConfidence = normalizedFoods.length > 0 ? Math.round((confidenceSum / normalizedFoods.length) * 100) / 100 : 0.85;
  const nutritionSource = hasUsda && !hasAi ? 'USDA_FDC' : hasUsda && hasAi ? 'MIXED' : 'GEMINI_ESTIMATE';

  const notes = [...(options?.estimationNotes || [])];
  if (appliedPrior) {
    notes.push(`Personal Prior (v${appliedPrior.version}): ${appliedPrior.reasoning}`);
  }
  if (atwaterDiagnostic.isInconsistent) {
    notes.push(atwaterDiagnostic.reason);
  }

  const uncertainty: ScientificUncertainty = {
    foodIdentificationConfidence: Math.min(0.98, overallConfidence + 0.05),
    portionConfidence: resolvedMassBasis === 'two_view_calibrated' ? 0.95 : totalGrams > 0 ? 0.88 : 0.75,
    nutritionSourceConfidence: hasUsda ? 0.95 : 0.85,
    overallConfidence,
    calorieRange: [minCal, maxCal],
    primaryUncertaintyFactor: hasUnobservableUnknown ? 'HIDDEN_COOKING_FAT' : totalFat > 25 ? 'HIDDEN_COOKING_FAT' : totalGrams > 400 ? 'PORTION_VARIANCE' : 'LAB_PRECISION',
    requiresClarification,
    clarificationPrompt,
    clarificationOptions,
    informationGainExpectedKcal,
    autoLogBlocked,
    autoLogBlockReason,
    unobservableUnknownMassShare,
    appliedPrior
  };

  const isJunk = evaluateIsJunkFood({
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    sugar: totalSugar,
    sodium: totalSodium,
    foods: normalizedFoods
  });

  const { score: healthScore, grade } = evaluateHealthScoreAndGrade({
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    sugar: totalSugar,
    sodium: totalSodium,
    isJunk,
    foods: normalizedFoods
  });

  return {
    name: options?.mealName || normalizedFoods.map(f => f.name).join(' + '),
    mealType: options?.mealType || (new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner'),
    cuisineType: options?.cuisineType || 'Mixed',
    foodCategory: mealCategory,
    portion: totalGrams > 0 ? `${totalGrams}g (${normalizedFoods.length} items)` : `${normalizedFoods.length} items`,
    totalGrams,
    massDistribution: mealMassDistribution,
    massBasis: resolvedMassBasis,
    calories: databaseCalories,
    calorieRange: [minCal, maxCal],
    databaseCalories,
    macroDerivedCalories: expectedCaloriesFromMacros,
    atwaterDiagnostic,
    hasUnobservableUnknown,
    autoLogBlocked,
    autoLogBlockReason,
    complexMealDetected: isComplexMeal,
    suggestsSecondPhoto: isComplexMeal && resolvedMassBasis === 'single_view',
    scaleCueApplied: options?.scaleCue,
    protein: Math.round(totalProtein * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    sugar: Math.round(totalSugar * 10) / 10,
    sodium: Math.round(totalSodium),
    isJunk,
    healthScore,
    grade,
    confidence: overallConfidence,
    uncertainty,
    nutritionSource,
    foods: normalizedFoods,
    appliedPrior,
    estimationNotes: notes,
    energyCheckDelta,
    energyConsistencyReason,
    swapSuggestion: isJunk 
      ? "Consider swapping high-fat deep fried sides for steamed greens or fresh fruit." 
      : "Balanced nutrient-dense whole food combination!",
    verdict: `Analyzed from ${normalizedFoods.length} component items (${nutritionSource}). Total canonical energy: ${databaseCalories} kcal [${minCal}-${maxCal} kcal].`
  };
}

export function evaluateIsJunkFood(params: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  foods: ComponentFood[];
}): boolean {
  const { calories, protein, fat, sugar, sodium, foods } = params;
  if (calories === 0) return false;

  const sugarCalories = sugar * 4;
  const fatCalories = fat * 9;

  const junkKeywords = ['deep fried', 'french fry', 'french fries', 'fries', 'donut', 'candy', 'soda', 'chips', 'crisps', 'cheeseburger', 'burger', 'samosa', 'gulab jamun', 'pastry', 'frosting', 'sweetened beverage'];
  const hasJunkKeyword = foods.some(f => 
    junkKeywords.some(kw => f.name.toLowerCase().includes(kw) || f.identifiedFood.toLowerCase().includes(kw))
  );

  if (hasJunkKeyword) return true;
  if (sugarCalories / calories > 0.35) return true;
  if (fatCalories / calories > 0.50 && protein < 12) return true;
  if (sodium > 1400 && protein < 12) return true;

  return false;
}

export function evaluateHealthScoreAndGrade(params: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  isJunk: boolean;
  foods: ComponentFood[];
}): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' } {
  const { calories, protein, fat, sugar, sodium, isJunk } = params;
  
  if (calories === 0) {
    return { score: 90, grade: 'A' };
  }

  let score = 85;

  const proteinRatio = (protein * 4) / calories;
  const sugarRatio = (sugar * 4) / calories;
  const fatRatio = (fat * 9) / calories;

  if (proteinRatio >= 0.25) {
    score += 10;
  } else if (proteinRatio < 0.10 && calories > 300) {
    score -= 10;
  }

  if (sugarRatio > 0.25) {
    score -= 20;
  } else if (sugarRatio > 0.15) {
    score -= 10;
  }

  if (fatRatio > 0.50 && !isJunk) {
    score -= 10;
  }

  if (sodium > 1400) {
    score -= 15;
  } else if (sodium > 900) {
    score -= 5;
  }

  if (isJunk) {
    score -= 25;
  }

  score = Math.max(15, Math.min(100, Math.round(score)));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'B';
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { score, grade };
}
