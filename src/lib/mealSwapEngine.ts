import { FoodItem, MealType } from '../types';
import { HEALTHY_FOOD_PRESETS } from '../data/presets';

export interface MealSwapOption {
  id: string;
  name: string;
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  portion: string;
  healthScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  isJunk: boolean;
  calorieDelta: number; // alternative - original
  proteinDelta: number;
  carbsDelta: number;
  fatDelta: number;
  reason: string;
  tag: string;
}

export interface MealSwapResult {
  originalItem: FoodItem;
  alternatives: MealSwapOption[];
  isDegraded: boolean;
  explanation: string;
}

// Reusable catalog of balanced, high-protein athletic and whole-food meals
// aligned with existing personalized-recommendations options
const SWAP_CANDIDATES: Array<{
  name: string;
  mealTypes: MealType[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  portion: string;
  healthScore: number;
  grade: 'A' | 'B';
  tag: string;
  defaultReason: string;
}> = [
  // Breakfast items
  {
    name: 'Steel-Cut Oatmeal with Blueberries & Whey',
    mealTypes: ['Breakfast', 'Snack'],
    calories: 420,
    protein: 34,
    carbs: 52,
    fat: 8,
    sugar: 10,
    sodium: 130,
    portion: '1 bowl (350g)',
    healthScore: 97,
    grade: 'A',
    tag: 'Complex Carbs & Protein',
    defaultReason: 'Sustained low-glycemic fuel with high bioavailable protein and antioxidant berries.'
  },
  {
    name: 'Avocado & Smoked Salmon on Sourdough',
    mealTypes: ['Breakfast', 'Lunch'],
    calories: 460,
    protein: 34,
    carbs: 38,
    fat: 16,
    sugar: 2,
    sodium: 480,
    portion: '2 slices + 80g salmon',
    healthScore: 95,
    grade: 'A',
    tag: 'Heart-Healthy Omega-3',
    defaultReason: 'Rich in EPA/DHA fatty acids and quality protein for mental focus and recovery.'
  },
  {
    name: '0% Greek Yogurt Parfait with Walnuts & Raw Honey',
    mealTypes: ['Breakfast', 'Snack'],
    calories: 310,
    protein: 28,
    carbs: 26,
    fat: 9,
    sugar: 12,
    sodium: 90,
    portion: '250g cup + walnuts',
    healthScore: 96,
    grade: 'A',
    tag: 'High Satiety & Probiotics',
    defaultReason: 'High satiety index with gut-friendly probiotics and zero saturated fat.'
  },
  {
    name: '3 Soft Boiled Eggs with Spinach & Rye Toast',
    mealTypes: ['Breakfast', 'Lunch'],
    calories: 340,
    protein: 24,
    carbs: 22,
    fat: 17,
    sugar: 1,
    sodium: 290,
    portion: '3 eggs + 1 slice rye',
    healthScore: 94,
    grade: 'A',
    tag: 'Whole Food Choline',
    defaultReason: 'Complete amino acid profile with micronutrient density from pasture eggs and greens.'
  },

  // Lunch / Dinner items
  {
    name: 'Flame-Grilled Chicken Breast, Quinoa & Steamed Broccoli',
    mealTypes: ['Lunch', 'Dinner'],
    calories: 520,
    protein: 52,
    carbs: 46,
    fat: 12,
    sugar: 3,
    sodium: 380,
    portion: '200g chicken + 1 cup quinoa',
    healthScore: 98,
    grade: 'A',
    tag: 'Lean Muscle Fuel',
    defaultReason: 'Optimal lean protein-to-calorie ratio fueling muscle protein synthesis without excess sodium.'
  },
  {
    name: 'Pan-Seared Salmon Fillet with Roasted Sweet Potato',
    mealTypes: ['Lunch', 'Dinner'],
    calories: 580,
    protein: 44,
    carbs: 48,
    fat: 20,
    sugar: 6,
    sodium: 360,
    portion: '180g salmon + 1 sweet potato',
    healthScore: 96,
    grade: 'A',
    tag: 'Anti-Inflammatory Plate',
    defaultReason: 'Potent anti-inflammatory fats paired with slow-burning complex sweet potato carbs.'
  },
  {
    name: 'Double Chicken & Black Bean Brown Rice Bowl',
    mealTypes: ['Lunch', 'Dinner'],
    calories: 610,
    protein: 56,
    carbs: 58,
    fat: 14,
    sugar: 4,
    sodium: 680,
    portion: '1 large bowl (420g)',
    healthScore: 92,
    grade: 'A',
    tag: 'Power Bowl',
    defaultReason: 'Clean restaurant-style power bowl supplying 56g protein and prebiotic fiber.'
  },
  {
    name: 'Grilled Turkey Breast Meatballs with Whole Grain Penne',
    mealTypes: ['Lunch', 'Dinner'],
    calories: 490,
    protein: 42,
    carbs: 52,
    fat: 11,
    sugar: 5,
    sodium: 440,
    portion: '1 plate (380g)',
    healthScore: 94,
    grade: 'A',
    tag: 'Lean Comfort Food',
    defaultReason: 'Lean ground turkey in homemade crushed marinara over complex carbohydrates.'
  },
  {
    name: 'Tofu & Edamame Vegetable Stir-Fry with Jasmine Brown Rice',
    mealTypes: ['Lunch', 'Dinner'],
    calories: 440,
    protein: 30,
    carbs: 54,
    fat: 12,
    sugar: 5,
    sodium: 410,
    portion: '1 plate (360g)',
    healthScore: 95,
    grade: 'A',
    tag: 'Plant-Based High Protein',
    defaultReason: 'Complete plant proteins with crisp micronutrient-dense bell peppers and bok choy.'
  },

  // Snacks & Light Meals
  {
    name: 'Chocolate Peanut Butter Whey Isolate Shake',
    mealTypes: ['Snack', 'Breakfast'],
    calories: 260,
    protein: 32,
    carbs: 14,
    fat: 6,
    sugar: 2,
    sodium: 180,
    portion: '1 shaker (400ml)',
    healthScore: 96,
    grade: 'A',
    tag: 'Rapid Amino Delivery',
    defaultReason: 'Ultra-fast branched-chain amino acid absorption with negligible simple sugars.'
  },
  {
    name: 'Steamed Edamame Pods with Sea Salt & Lemon',
    mealTypes: ['Snack'],
    calories: 180,
    protein: 17,
    carbs: 14,
    fat: 5,
    sugar: 3,
    sodium: 310,
    portion: '1 bowl (180g)',
    healthScore: 98,
    grade: 'A',
    tag: 'Fiber & Clean Protein',
    defaultReason: 'High fiber, zero cholesterol snack that curbs afternoon cravings steadily.'
  },
  {
    name: 'Hard-Boiled Eggs with Raw Almonds & Sea Salt',
    mealTypes: ['Snack'],
    calories: 240,
    protein: 16,
    carbs: 4,
    fat: 17,
    sugar: 1,
    sodium: 210,
    portion: '2 eggs + 15 almonds',
    healthScore: 94,
    grade: 'A',
    tag: 'Steady Energy',
    defaultReason: 'Zero insulin spike with essential fat-soluble vitamins and dietary magnesium.'
  },
  {
    name: 'Cottage Cheese 2% with Sliced Strawberries',
    mealTypes: ['Snack', 'Breakfast'],
    calories: 190,
    protein: 26,
    carbs: 15,
    fat: 3,
    sugar: 8,
    sodium: 380,
    portion: '1 cup (225g)',
    healthScore: 95,
    grade: 'A',
    tag: 'Slow-Release Casein',
    defaultReason: 'Slow-digesting casein protein providing hours of sustained muscle satiety.'
  }
];

/**
 * Generates 1 to 3 meal swap alternatives for a given FoodItem.
 * Reuses personalized recommendation matching logic by comparing macro ratios.
 * Degrades gracefully if no exact macro match exists.
 */
export function getMealSwapSuggestions(originalItem: FoodItem): MealSwapResult {
  const origCal = Math.max(1, originalItem.calories || 300);
  const origProt = originalItem.protein || 15;
  const origName = (originalItem.name || '').toLowerCase().trim();
  const origMealType = (originalItem.mealType || 'Lunch') as MealType;

  // Filter out identical item
  const eligible = SWAP_CANDIDATES.filter(
    (c) => c.name.toLowerCase().trim() !== origName
  );

  // Score candidates by macro proximity and slot alignment
  const scored = eligible.map((cand) => {
    // Calorie delta ratio
    const calDiffRatio = Math.abs(cand.calories - origCal) / origCal;
    // Protein proximity ratio
    const protDiffRatio = Math.abs(cand.protein - origProt) / Math.max(15, origProt);
    // MealType affinity boost
    const slotBonus = cand.mealTypes.includes(origMealType) ? 0 : 0.35;

    // Combined proximity score (lower is better)
    const proximityScore = calDiffRatio * 1.2 + protDiffRatio * 0.8 + slotBonus;

    return {
      candidate: cand,
      score: proximityScore,
      calDiffRatio
    };
  });

  // Sort ascending by proximity score
  scored.sort((a, b) => a.score - b.score);

  // Check if we have close matches (within 35% calorie variance)
  const closeMatches = scored.filter((s) => s.calDiffRatio <= 0.35);

  let selected = closeMatches.slice(0, 3);
  let isDegraded = false;
  let explanation = '';

  if (selected.length === 0) {
    // FAILURE MODE / GRACEFUL DEGRADATION:
    // When no comparable-macro alternative exists (e.g. 1500 kcal feast or 30 kcal item),
    // degrade gracefully by showing the best balanced alternatives for that meal slot.
    isDegraded = true;
    selected = scored.slice(0, 3);
    explanation = `No 1:1 macro match found within ±35% of ${origCal} kcal. Here are the closest balanced whole-food options:`;
  } else {
    explanation = `Found ${selected.length} nutrient-dense whole-food alternatives with comparable macronutrients:`;
  }

  const alternatives: MealSwapOption[] = selected.map((s, idx) => {
    const c = s.candidate;
    const calDelta = c.calories - origCal;
    const protDelta = Math.round((c.protein - origProt) * 10) / 10;
    const carbsDelta = Math.round((c.carbs - (originalItem.carbs || 0)) * 10) / 10;
    const fatDelta = Math.round((c.fat - (originalItem.fat || 0)) * 10) / 10;

    let reason = c.defaultReason;
    if (originalItem.isJunk) {
      reason = `Replaces ultra-processed ingredients with clean nutrition: ${calDelta <= 0 ? `saves ${Math.abs(calDelta)} kcal` : `adds ${calDelta} kcal`} and ${protDelta >= 0 ? `adds ${protDelta}g protein` : `${Math.abs(protDelta)}g protein`}.`;
    } else if (calDelta !== 0 || protDelta !== 0) {
      const calPhrase = calDelta < 0 ? `${Math.abs(calDelta)} fewer kcal` : calDelta > 0 ? `+${calDelta} kcal` : 'equal calories';
      const protPhrase = protDelta > 0 ? `+${protDelta}g protein` : protDelta < 0 ? `${Math.abs(protDelta)}g protein` : 'equal protein';
      reason = `${c.defaultReason} (${calPhrase}, ${protPhrase})`;
    }

    return {
      id: `swap-opt-${idx}-${Date.now()}`,
      name: c.name,
      mealType: origMealType,
      calories: c.calories,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      sugar: c.sugar,
      sodium: c.sodium,
      portion: c.portion,
      healthScore: c.healthScore,
      grade: c.grade,
      isJunk: false,
      calorieDelta: calDelta,
      proteinDelta: protDelta,
      carbsDelta,
      fatDelta,
      reason,
      tag: c.tag
    };
  });

  return {
    originalItem,
    alternatives,
    isDegraded,
    explanation
  };
}
