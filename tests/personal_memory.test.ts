// @ts-ignore
import { describe, test, expect } from 'bun:test';
import {
  computeFallbackHash,
  calculateHammingDistance,
  calculateHashSimilarity,
  findBestMealMatch,
  detectFoodCategory,
  computeCorrectionDeltas,
  deriveCategoryPrior,
  HIGH_SIMILARITY_THRESHOLD
} from '../src/lib/personalMemory';
import { calculateDeterministicMealTotals } from '../src/lib/nutritionEngine';
import { ConfirmedMealRecord, CategoryPrior, CorrectionLogEntry } from '../src/types';

describe('Personal Food Memory & Continuous Calibration Engine', () => {
  const sampleHashA = '0123456789abcdef';
  const sampleHashB = '0123456789abcdee'; // 1 bit different in last hex digit ('f' is 1111, 'e' is 1110)
  const sampleHashFar = 'fedcba9876543210'; // completely different

  test('Hash distance and similarity computation', () => {
    const distZero = calculateHammingDistance(sampleHashA, sampleHashA);
    expect(distZero).toBe(0);
    expect(calculateHashSimilarity(sampleHashA, sampleHashA)).toBe(1.0);

    const distOneBit = calculateHammingDistance(sampleHashA, sampleHashB);
    expect(distOneBit).toBe(1);
    const simOneBit = calculateHashSimilarity(sampleHashA, sampleHashB);
    expect(simOneBit).toBeGreaterThan(0.98);

    const distFar = calculateHammingDistance(sampleHashA, sampleHashFar);
    expect(distFar).toBeGreaterThan(20);
    expect(calculateHashSimilarity(sampleHashA, sampleHashFar)).toBeLessThan(0.7);
  });

  test('Fallback hash generates 16-hex character deterministic string', () => {
    const rawData = 'VGhpcyBpcyBhIHNhbXBsZSBiYXNlNjQgc3RyaW5nIGZvciBmb29kIGltYWdlIGRhdGE=';
    const hash1 = computeFallbackHash(rawData);
    const hash2 = computeFallbackHash(rawData);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
    expect(/^[0-9a-fA-F]{16}$/.test(hash1)).toBe(true);
  });

  test('findBestMealMatch accurately triggers one-tap confirmation when above threshold', () => {
    const confirmedMeals: ConfirmedMealRecord[] = [
      {
        id: 'meal-1',
        userId: 'user-1',
        mealName: 'Morning Oatmeal & Berries',
        photoHash: sampleHashA,
        composition: [],
        totalCalories: 380,
        protein: 15,
        carbs: 65,
        fat: 7,
        mealType: 'Breakfast',
        date: '2026-09-17',
        timestamp: Date.now() - 86400000
      }
    ];

    // Near-identical photo
    const match = findBestMealMatch(sampleHashB, confirmedMeals, HIGH_SIMILARITY_THRESHOLD);
    expect(match.matchFound).toBe(true);
    expect(match.matchedMeal?.id).toBe('meal-1');
    expect(match.similarity).toBeGreaterThan(HIGH_SIMILARITY_THRESHOLD);

    // Completely different meal
    const miss = findBestMealMatch(sampleHashFar, confirmedMeals, HIGH_SIMILARITY_THRESHOLD);
    expect(miss.matchFound).toBe(false);
    expect(miss.matchedMeal).toBeUndefined();
  });

  test('detectFoodCategory identifies culinary category accurately', () => {
    expect(detectFoodCategory('Chicken Tikka Masala', 'Dinner')).toBe('curry');
    expect(detectFoodCategory('Paneer Butter Gravy')).toBe('curry');
    expect(detectFoodCategory('Greek Salad with Feta')).toBe('salad');
    expect(detectFoodCategory('Hyderabadi Chicken Biryani')).toBe('rice');
    expect(detectFoodCategory('Garlic Naan Bread')).toBe('bread');
    expect(detectFoodCategory('Grilled Salmon Fillet')).toBe('protein');
    expect(detectFoodCategory('Crispy French Fries & Samosa')).toBe('fast_food');
    expect(detectFoodCategory('Hot Miso Ramen Broth')).toBe('soup');
    expect(detectFoodCategory('Spaghetti Bolognese Pasta')).toBe('bowl');
  });

  test('computeCorrectionDeltas derives traceable discrepancies per macro field', () => {
    const deltas = computeCorrectionDeltas({
      userId: 'test-user',
      mealName: 'Paneer Curry',
      mealId: 'curry-101',
      foodCategory: 'curry',
      predicted: {
        calories: 450,
        protein: 18,
        carbs: 25,
        fat: 20
      },
      confirmed: {
        calories: 520,
        protein: 20,
        carbs: 25,
        fat: 30
      }
    });

    expect(deltas.length).toBeGreaterThanOrEqual(2);
    const calDelta = deltas.find(d => d.fieldName === 'calories');
    expect(calDelta).toBeDefined();
    expect(calDelta?.delta).toBe(70); // 520 - 450

    const oilDelta = deltas.find(d => d.fieldName === 'oil_grams');
    expect(oilDelta).toBeDefined();
    expect(oilDelta?.delta).toBe(10); // 30 - 20
  });

  test('deriveCategoryPrior updates adjustment factors from feedback entries', () => {
    const corrections: CorrectionLogEntry[] = [
      {
        id: 'c1',
        userId: 'test-user',
        foodCategory: 'curry',
        fieldName: 'oil_grams',
        predictedValue: 20,
        confirmedValue: 26,
        delta: 6,
        evidenceClass: 'DIRECT_VISUAL',
        timestamp: Date.now() - 10000
      },
      {
        id: 'c2',
        userId: 'test-user',
        foodCategory: 'curry',
        fieldName: 'calories',
        predictedValue: 400,
        confirmedValue: 460,
        delta: 60,
        evidenceClass: 'DIRECT_VISUAL',
        timestamp: Date.now() - 5000
      }
    ];

    const prior = deriveCategoryPrior({
      userId: 'test-user',
      category: 'curry',
      corrections
    });

    expect(prior.category).toBe('curry');
    expect(prior.sampleCount).toBe(2);
    expect(prior.oilMassAdjustmentFactor).toBeGreaterThan(1.0); // User routinely uses more oil/fat than predicted
    expect(prior.traceableCorrectionIds).toContain('c1');
    expect(prior.traceableCorrectionIds).toContain('c2');
  });

  test('calculateDeterministicMealTotals applies user category prior when present', () => {
    const prior: CategoryPrior = {
      id: 'curry',
      userId: 'test-user',
      category: 'curry',
      version: 1,
      oilMassAdjustmentFactor: 1.25,
      portionAdjustmentFactor: 1.0,
      calorieAdjustmentOffset: 50,
      confidenceOffset: -0.05,
      sampleCount: 5,
      traceableCorrectionIds: ['c1'],
      reasoning: 'User prefers +25% rich oil in curries based on 5 logged corrections.',
      updatedAt: Date.now()
    };

    const result = calculateDeterministicMealTotals(
      [
        {
          name: 'Paneer Makhani Gravy',
          identifiedFood: 'Paneer Makhani Gravy',
          portionDescription: '1 cup',
          estimatedGrams: 200,
          evidence: 'GRAVY_CONTAINED'
        }
      ],
      {
        mealName: 'Paneer Butter Masala Curry',
        categoryPriors: [prior]
      }
    );

    expect(result.appliedPrior).toBeDefined();
    expect(result.appliedPrior?.category).toBe('curry');
    expect(result.estimationNotes.some(n => n.includes('Personal Prior'))).toBe(true);
  });
});
