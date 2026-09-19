import { describe, it, expect, beforeEach } from 'bun:test';
import {
  setStoredGeminiApiKey,
  getStoredGeminiApiKey,
  hasGeminiApiKey,
  removeStoredGeminiApiKey,
} from '../src/lib/geminiClient';
import {
  analyzeFoodClient,
  matchMealMemoryClient,
  recomputeCategoryPriorsClient,
  calculateProfileClient,
} from '../src/lib/clientAiService';
import { handleClientDirectRoute } from '../src/lib/apiFetch';

describe('Client-Side Direct AI & Zero-Backend Engine Suite', () => {
  beforeEach(() => {
    removeStoredGeminiApiKey();
  });

  describe('Gemini Key Management', () => {
    it('manages API key storage, sanitization, and retrieval in localStorage', () => {
      expect(hasGeminiApiKey()).toBe(false);

      setStoredGeminiApiKey('  AIzaSyFakeKeyForTesting123 \n');
      expect(hasGeminiApiKey()).toBe(true);
      expect(getStoredGeminiApiKey()).toBe('AIzaSyFakeKeyForTesting123');

      removeStoredGeminiApiKey();
      expect(hasGeminiApiKey()).toBe(false);
    });
  });

  describe('Personal Food Memory Recall (Client-Side)', () => {
    it('returns matchFound: false for empty confirmedMeals history', () => {
      const result = matchMealMemoryClient({
        photoHash: 'hash123',
        confirmedMeals: [],
      });
      expect(result.matchFound).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('identifies exact match in confirmed meals and returns user_confirmed evidence', () => {
      const mockMeal = {
        id: 'meal_1',
        photoHash: 'photo_abc123',
        name: 'Oatmeal with Blueberries',
        components: [
          { name: 'Rolled Oats', estimatedGrams: 50, calories: 190, protein: 6, carbs: 34, fat: 3 },
          { name: 'Blueberries', estimatedGrams: 50, calories: 29, protein: 0.4, carbs: 7.2, fat: 0.2 },
        ],
        totalCalories: 219,
        totalProtein: 6.4,
        totalCarbs: 41.2,
        totalFat: 3.2,
      };

      const result = matchMealMemoryClient({
        photoHash: 'photo_abc123',
        confirmedMeals: [mockMeal],
      });

      expect(result.matchFound).toBe(true);
      expect(result.similarity).toBe(1.0);
      expect(result.matchedMeal?.name).toBe('Oatmeal with Blueberries');
    });
  });

  describe('Client Profile & TDEE Metabolic Calculation', () => {
    it('calculates Mifflin-St Jeor TDEE and calorie deficit for weight loss', () => {
      const profile = calculateProfileClient({
        heightCm: 175,
        weightKg: 80,
        desiredWeightKg: 72,
        age: 28,
        gender: 'male',
        activityLevel: 'moderate',
        goal: 'Weight Loss',
      });

      // BMR for male 175cm, 80kg, 28yo: 10*80 + 6.25*175 - 5*28 + 5 = 800 + 1093.75 - 140 + 5 = 1758.75 -> ~1759
      expect(profile.bmr).toBeGreaterThan(1700);
      expect(profile.bmr).toBeLessThan(1800);
      expect(profile.tdee).toBeGreaterThan(2500);
      expect(profile.targetCalories).toBe(profile.tdee - 500);
      expect(profile.targetProtein).toBeGreaterThan(150);
      expect(profile.targetCarbs).toBeGreaterThan(200);
      expect(profile.targetFat).toBeGreaterThan(50);
    });
  });

  describe('Natural Language USDA Fallback Analysis', () => {
    it('identifies foods from description and calculates deterministic totals without API key', async () => {
      const totals = await analyzeFoodClient({
        description: '2 large eggs and 2 slices whole wheat toast',
      });

      expect(totals.name).toBe('2 large eggs and 2 slices whole wheat toast');
      expect(totals.foods.length).toBeGreaterThanOrEqual(2);
      expect(totals.calories).toBeGreaterThan(200);
      expect(totals.protein).toBeGreaterThan(10);
      expect(totals.atwaterDiagnostic).toBeDefined();
    });

    it('rejects image analysis with actionable guidance when no Gemini key is set', async () => {
      let threw = false;
      try {
        await analyzeFoodClient({
          imageBase64: 'fakeBase64StringData',
        });
      } catch (err: any) {
        threw = true;
        expect(err.message.includes('Gemini API key')).toBe(true);
      }
      expect(threw).toBe(true);
    });
  });

  describe('Client Direct Route Dispatcher', () => {
    it('routes /api/health and /health to client-direct status', async () => {
      const res = await handleClientDirectRoute('/api/health');
      expect(res.success).toBe(true);
      expect((res.data as any).status).toBe('healthy');
      expect((res.data as any).mode).toBe('client-direct');
    });

    it('routes /api/ai/match-meal-memory cleanly through direct handler', async () => {
      const res = await handleClientDirectRoute('/api/ai/match-meal-memory', {
        body: JSON.stringify({
          photoHash: 'hash999',
          confirmedMeals: [],
        }),
      });
      expect(res.success).toBe(true);
      expect((res.data as any).matchFound).toBe(false);
    });
  });
});
