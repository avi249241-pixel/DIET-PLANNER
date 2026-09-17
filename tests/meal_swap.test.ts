// @ts-ignore
import { describe, test, expect } from 'bun:test';
import { getMealSwapSuggestions } from '../src/lib/mealSwapEngine';
import { FoodItem } from '../src/types';

describe('Meal-Swap Matching & Degradation Engine', () => {
  test('Standard healthy meal produces 1 to 3 comparable macro alternatives', () => {
    const item: FoodItem = {
      id: 'test-item-1',
      userId: 'test-user',
      name: 'Grilled Herb Chicken Bowl',
      isJunk: false,
      calories: 550,
      protein: 45,
      carbs: 50,
      fat: 14,
      grade: 'A',
      mealType: 'Lunch',
      date: '2026-09-17',
      createdAt: Date.now()
    };

    const result = getMealSwapSuggestions(item);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    expect(result.isDegraded).toBe(false);

    // Alternatives should not have identical name
    result.alternatives.forEach((alt) => {
      expect(alt.name.toLowerCase()).not.toBe(item.name.toLowerCase());
      expect(alt.grade).toBe('A');
      expect(alt.isJunk).toBe(false);
      expect(typeof alt.calorieDelta).toBe('number');
      expect(typeof alt.proteinDelta).toBe('number');
    });
  });

  test('Junk meal generates clean, high-protein whole-food swaps with savings messaging', () => {
    const junkItem: FoodItem = {
      id: 'test-junk-1',
      userId: 'test-user',
      name: 'Double Cheeseburger',
      isJunk: true,
      calories: 540,
      protein: 30,
      carbs: 40,
      fat: 28,
      grade: 'D',
      mealType: 'Dinner',
      date: '2026-09-17',
      createdAt: Date.now()
    };

    const result = getMealSwapSuggestions(junkItem);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(result.isDegraded).toBe(false);

    const first = result.alternatives[0];
    expect(first.isJunk).toBe(false);
    expect(first.grade).toBe('A');
    expect(first.reason).toContain('Replaces ultra-processed ingredients');
  });

  test('SCENARIO: Outlier / extreme macro item degrades gracefully without error', () => {
    // 3200 kcal mega feast
    const extremeItem: FoodItem = {
      id: 'test-extreme-1',
      userId: 'test-user',
      name: 'Giant 3200 kcal Deep Dish Pizza Platter',
      isJunk: true,
      calories: 3200,
      protein: 60,
      carbs: 350,
      fat: 180,
      grade: 'F',
      mealType: 'Dinner',
      date: '2026-09-17',
      createdAt: Date.now()
    };

    const result = getMealSwapSuggestions(extremeItem);
    expect(result.isDegraded).toBe(true);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(result.explanation).toContain('No 1:1 macro match found within ±35%');
    // Degradation returns clean options gracefully
    expect(result.alternatives[0].grade).toBe('A');
  });
});
