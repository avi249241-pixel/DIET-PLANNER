// @ts-ignore
import { describe, test, expect } from 'bun:test';
import { calculateAdaptiveRecalibration } from '../src/lib/adaptiveRecalibration';
import { UserProfile, FoodItem } from '../src/types';

describe('Adaptive Target Recalibration Engine', () => {
  const baseProfile: UserProfile = {
    heightCm: 178,
    weightKg: 80,
    desiredWeightKg: 75,
    age: 30,
    gender: 'male',
    activityLevel: 'moderately_active',
    goal: 'Weight Loss',
    dietaryStyle: 'Standard Balanced',
    targetCalories: 2200,
    targetProtein: 160,
    targetCarbs: 230,
    targetFat: 70,
    maxJunkCaloriePercent: 15,
    updatedAt: Date.now()
  };

  const generateMockLogs = (daysCount: number, dailyCalories = 2000, dailyProtein = 150): FoodItem[] => {
    const items: FoodItem[] = [];
    const baseDate = new Date('2026-09-01T12:00:00Z');

    for (let d = 0; d < daysCount; d++) {
      const dateObj = new Date(baseDate);
      dateObj.setDate(baseDate.getDate() + d);
      const dateStr = dateObj.toISOString().split('T')[0];

      items.push({
        id: `mock-recal-${d}-1`,
        userId: 'test-user',
        name: `Meal 1 Day ${d}`,
        isJunk: false,
        calories: Math.round(dailyCalories * 0.4),
        protein: Math.round(dailyProtein * 0.4),
        carbs: 80,
        fat: 20,
        grade: 'A',
        mealType: 'Lunch',
        date: dateStr,
        createdAt: dateObj.getTime()
      });

      items.push({
        id: `mock-recal-${d}-2`,
        userId: 'test-user',
        name: `Meal 2 Day ${d}`,
        isJunk: false,
        calories: Math.round(dailyCalories * 0.6),
        protein: Math.round(dailyProtein * 0.6),
        carbs: 120,
        fat: 30,
        grade: 'A',
        mealType: 'Dinner',
        date: dateStr,
        createdAt: dateObj.getTime() + 1000 * 60 * 60 * 4
      });
    }

    return items;
  };

  test('SCENARIO: Exactly 13 days of data must NOT fire recalibration', () => {
    const logs13 = generateMockLogs(13);
    const result = calculateAdaptiveRecalibration(baseProfile, logs13, 14);

    expect(result.canRecalibrate).toBe(false);
    expect(result.daysLogged).toBe(13);
    expect(result.minDaysRequired).toBe(14);
    expect(result.progressPercent).toBe(Math.round((13 / 14) * 100));
    expect(result.suggestedTargets).toBeUndefined();
    expect(result.message).toContain('Not enough data yet (13/14 days logged)');
  });

  test('SCENARIO: Exactly 14 days of data MUST fire recalibration', () => {
    const logs14 = generateMockLogs(14, 2100, 155);
    const result = calculateAdaptiveRecalibration(baseProfile, logs14, 14);

    expect(result.canRecalibrate).toBe(true);
    expect(result.daysLogged).toBe(14);
    expect(result.minDaysRequired).toBe(14);
    expect(result.progressPercent).toBe(100);
    expect(result.suggestedTargets).toBeDefined();
    expect(result.suggestedTargets?.calories).toBeGreaterThan(1200);
    expect(result.suggestedTargets?.protein).toBeGreaterThan(100);
    expect(result.suggestedTargets?.carbs).toBeGreaterThan(0);
    expect(result.suggestedTargets?.fat).toBeGreaterThan(0);
    expect(result.rationale).toContain('Target calibrated from 2200 to');
  });

  test('Recalibration integrates weight trend over 14 days', () => {
    const logs14 = generateMockLogs(14, 1900, 150);
    // User lost 1.0 kg over 14 days (eating 1900 kcal/day)
    // 1kg / 14 days = ~550 kcal/day deficit -> Realized TDEE ~ 2450 kcal
    const weightHistory = [
      { date: '2026-09-01', weightKg: 80.0 },
      { date: '2026-09-14', weightKg: 79.0 }
    ];

    const result = calculateAdaptiveRecalibration(baseProfile, logs14, 14, weightHistory);
    expect(result.canRecalibrate).toBe(true);
    expect(result.weightDeltaKg).toBe(-1.0);
    expect(result.realizedTdee).toBeGreaterThanOrEqual(2300);
    expect(result.suggestedTargets?.calories).toBeDefined();
    expect(result.rationale).toContain('lost 1 kg');
  });

  test('Calorie floor protection guarantees minimum 1200 kcal', () => {
    // Extreme low calorie intake test
    const logs14 = generateMockLogs(14, 800, 50);
    const result = calculateAdaptiveRecalibration(baseProfile, logs14, 14);

    expect(result.canRecalibrate).toBe(true);
    expect(result.suggestedTargets?.calories).toBeGreaterThanOrEqual(1200);
  });
});
