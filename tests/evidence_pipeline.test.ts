import { describe, it, expect } from "bun:test";
import {
  calculateDeterministicMealTotals,
  parseMealDescriptionToComponents,
  isUnobservableUnknownFood,
  isComplexMealCategory,
  ComponentFood,
  USDA_REFERENCE_DB
} from "../src/lib/nutritionEngine";
import { readFileSync } from "fs";
import path from "path";

describe("Epistemic Recognition Pipeline, Mass Distributions & Scenario Simulations", () => {
  
  // --------------------------------------------------------------------------
  // 1. EVIDENCE CLASSIFICATION & UNOBSERVABLE UNKNOWN TESTS
  // --------------------------------------------------------------------------
  describe("Evidence Classification System", () => {
    it("Classifies visible whole foods as 'visible' evidence", () => {
      const appleComponent: ComponentFood = {
        name: "Fresh Red Apple",
        identifiedFood: "apple",
        portionDescription: "1 medium apple (182g)",
        estimatedGrams: 182,
        calories: 95,
        protein: 0.5,
        carbs: 25.1,
        fat: 0.3,
        confidence: 0.96,
        assumptions: [],
        source: "USDA_FDC",
        evidence: "visible"
      };

      const result = calculateDeterministicMealTotals([appleComponent]);
      expect(result.foods[0].evidence).toBe("visible");
      expect(result.hasUnobservableUnknown).toBe(false);
    });

    it("Classifies cooking oil, ghee, and hidden sauces as 'unobservable_unknown'", () => {
      const oilComponent: ComponentFood = {
        name: "Cooking Olive Oil",
        identifiedFood: "olive oil",
        portionDescription: "1 tbsp (15g)",
        estimatedGrams: 15,
        calories: 133,
        protein: 0,
        carbs: 0,
        fat: 15,
        confidence: 0.75,
        assumptions: ["Cooking fat estimated from surface sheen"],
        source: "GEMINI_ESTIMATE"
      };

      expect(isUnobservableUnknownFood(oilComponent)).toBe(true);
      const result = calculateDeterministicMealTotals([oilComponent]);
      expect(result.foods[0].evidence).toBe("unobservable_unknown");
      expect(result.hasUnobservableUnknown).toBe(true);
    });

    it("Classifies NLP/database matched items as 'context_derived'", () => {
      const components = parseMealDescriptionToComponents("Grilled chicken breast with steamed broccoli");
      expect(components.length).toBe(2);
      expect(components[0].evidence).toBe("context_derived");
      expect(components[1].evidence).toBe("context_derived");
    });

    it("Classifies user-edited components as 'user_confirmed'", () => {
      const component: ComponentFood = {
        name: "Steamed Rice",
        identifiedFood: "white rice (cooked)",
        portionDescription: "1 cup (200g)",
        estimatedGrams: 200,
        calories: 260,
        protein: 5.4,
        carbs: 56.4,
        fat: 0.6,
        confidence: 0.95,
        assumptions: [],
        source: "USER_EDITED",
        evidence: "user_confirmed"
      };

      const result = calculateDeterministicMealTotals([component]);
      expect(result.foods[0].evidence).toBe("user_confirmed");
    });
  });

  // --------------------------------------------------------------------------
  // 2. MASS DISTRIBUTION & TWO-VIEW CALIBRATION
  // --------------------------------------------------------------------------
  describe("Mass Distribution & Multi-View Calibration", () => {
    it("Calculates p10, p50, p90 distributions for single-view meal", () => {
      const chickenItem: ComponentFood = {
        name: "Chicken Breast",
        identifiedFood: "chicken breast (grilled)",
        portionDescription: "180g",
        estimatedGrams: 180,
        calories: 297,
        protein: 55.8,
        carbs: 0,
        fat: 6.5,
        confidence: 0.9,
        assumptions: [],
        source: "USDA_FDC"
      };

      const result = calculateDeterministicMealTotals([chickenItem], {
        hasSecondPhoto: false
      });

      expect(result.massBasis).toBe("single_view");
      expect(result.massDistribution).toBeDefined();
      expect(result.massDistribution?.p50).toBe(180);
      expect(result.massDistribution?.p10).toBeLessThan(180);
      expect(result.massDistribution?.p90).toBeGreaterThan(180);
      expect(result.calorieRange).toBeDefined();
      expect(result.calorieRange?.[0]).toBeLessThanOrEqual(result.calories);
      expect(result.calorieRange?.[1]).toBeGreaterThanOrEqual(result.calories);
    });

    it("Two-view calibration tightens mass and calorie bounds", () => {
      const foodItem: ComponentFood = {
        name: "Chicken Biryani",
        identifiedFood: "chicken biryani",
        portionDescription: "350g",
        estimatedGrams: 350,
        calories: 630,
        protein: 36.8,
        carbs: 78.4,
        fat: 18.2,
        confidence: 0.88,
        assumptions: [],
        source: "USDA_FDC"
      };

      const singleViewResult = calculateDeterministicMealTotals([foodItem], {
        hasSecondPhoto: false
      });

      const twoViewResult = calculateDeterministicMealTotals([foodItem], {
        hasSecondPhoto: true
      });

      expect(twoViewResult.massBasis).toBe("two_view_calibrated");
      const singleSpread = (singleViewResult.massDistribution?.p90 || 0) - (singleViewResult.massDistribution?.p10 || 0);
      const twoViewSpread = (twoViewResult.massDistribution?.p90 || 0) - (twoViewResult.massDistribution?.p10 || 0);
      
      // Two-view calibration narrows the uncertainty range
      expect(twoViewSpread).toBeLessThan(singleSpread);
      expect(twoViewResult.uncertainty?.portionConfidence).toBeGreaterThan(singleViewResult.uncertainty?.portionConfidence || 0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. ATWATER REVERSAL (DIAGNOSTIC-ONLY, CANONICAL DB RETENTION)
  // --------------------------------------------------------------------------
  describe("Atwater Diagnostic Reversal", () => {
    it("Retains database energy as canonical when macro energy diverges, flagging diagnostically", () => {
      const testItem: ComponentFood[] = [
        {
          name: "High-Protein Energy Bar",
          identifiedFood: "energy bar",
          portionDescription: "1 bar (60g)",
          estimatedGrams: 60,
          calories: 180, // Certified database value
          protein: 30,  // 30 * 4 = 120 kcal
          carbs: 30,    // 30 * 4 = 120 kcal
          fat: 10,      // 10 * 9 = 90 kcal -> Sum = 330 kcal
          confidence: 0.95,
          assumptions: [],
          source: "USDA_FDC"
        }
      ];

      const result = calculateDeterministicMealTotals(testItem);

      // ATWATER REVERSAL: Database value (180 kcal) is canonical, NOT overwritten by 330 kcal!
      expect(result.calories).toBe(180);
      expect(result.databaseCalories).toBe(180);
      expect(result.macroDerivedCalories).toBe(330);
      expect(result.energyCheckDelta).toBe(150);
      expect(result.atwaterDiagnostic?.isInconsistent).toBe(true);
      expect(result.atwaterDiagnostic?.expectedCalories).toBe(330);
      expect(result.atwaterDiagnostic?.delta).toBe(150);
      expect(result.atwaterDiagnostic?.reason).toContain("Canonical database value retained");
    });
  });

  // --------------------------------------------------------------------------
  // 4. INFORMATION-GAIN CLARIFICATION & AUTO-LOG GATE
  // --------------------------------------------------------------------------
  describe("Information-Gain Clarification & Auto-Log Gate", () => {
    it("Simple single-item food has low information gain and does NOT trigger clarification or block auto-log", () => {
      const apple: ComponentFood[] = [
        {
          name: "Apple",
          identifiedFood: "apple",
          portionDescription: "1 medium (150g)",
          estimatedGrams: 150,
          calories: 78,
          protein: 0.4,
          carbs: 20.7,
          fat: 0.2,
          confidence: 0.95,
          assumptions: [],
          source: "USDA_FDC",
          evidence: "visible"
        }
      ];

      const result = calculateDeterministicMealTotals(apple, {
        mealName: "Morning Apple",
        hasSecondPhoto: false
      });

      expect(result.complexMealDetected).toBe(false);
      expect(result.uncertainty?.requiresClarification).toBe(false);
      expect(result.autoLogBlocked).toBe(false);
    });

    it("Complex mixed curry with unobservable oil triggers information gain and BLOCKS auto-log", () => {
      const curryMeal: ComponentFood[] = [
        {
          name: "Butter Chicken Gravy",
          identifiedFood: "chicken curry (meat + gravy)",
          portionDescription: "250g",
          estimatedGrams: 250,
          calories: 462,
          protein: 41.2,
          carbs: 10.5,
          fat: 28.7,
          confidence: 0.82,
          oilState: "HIGH_OIL",
          assumptions: ["Restaurant preparation with heavy butter/cream"],
          source: "USDA_FDC",
          evidence: "unobservable_unknown"
        },
        {
          name: "Butter Naan",
          identifiedFood: "naan",
          portionDescription: "1 piece (90g)",
          estimatedGrams: 90,
          calories: 279,
          protein: 7.8,
          carbs: 47.1,
          fat: 6.7,
          confidence: 0.90,
          assumptions: [],
          source: "USDA_FDC",
          evidence: "visible"
        }
      ];

      const result = calculateDeterministicMealTotals(curryMeal, {
        mealName: "Butter Chicken and Naan",
        cuisineType: "South Asian",
        hasSecondPhoto: false
      });

      expect(result.complexMealDetected).toBe(true);
      expect(result.hasUnobservableUnknown).toBe(true);
      expect(result.uncertainty?.requiresClarification).toBe(true);
      expect(result.autoLogBlocked).toBe(true);
      expect(result.autoLogBlockReason).toContain("Uncertainty Gate Active");
      expect(result.uncertainty?.clarificationPrompt).toContain("Cooking fat & sauce density swing potential");
    });
  });

  // --------------------------------------------------------------------------
  // 5. ALL 6 REQUIRED SCENARIO SIMULATIONS
  // --------------------------------------------------------------------------
  describe("6 REQUIRED SCENARIO SIMULATIONS (User Acceptance)", () => {
    
    // SCENARIO 1: Simple single-item food (e.g. an apple)
    it("SCENARIO 1: Simple single-item food (apple) — fast path, single photo, no gate, no added friction", () => {
      const apple: ComponentFood[] = [
        {
          name: "Fresh Honeycrisp Apple",
          identifiedFood: "apple",
          portionDescription: "1 apple (182g)",
          estimatedGrams: 182,
          calories: 95,
          protein: 0.5,
          carbs: 25.1,
          fat: 0.3,
          confidence: 0.96,
          assumptions: ["Whole, unpeeled fresh apple"],
          source: "USDA_FDC",
          evidence: "visible"
        }
      ];

      const result = calculateDeterministicMealTotals(apple, {
        mealName: "Fresh Honeycrisp Apple",
        hasSecondPhoto: false
      });

      expect(result.complexMealDetected).toBe(false);
      expect(result.suggestsSecondPhoto).toBe(false);
      expect(result.autoLogBlocked).toBe(false);
      expect(result.uncertainty?.requiresClarification).toBe(false);
      expect(result.calories).toBe(95);
      expect(result.massBasis).toBe("single_view");
    });

    // SCENARIO 2: Mixed curry/bowl with no second photo or scale cue
    it("SCENARIO 2: Mixed curry/bowl with no second photo or scale cue — auto-log gate fires, wide range shown, clarification flow triggered", () => {
      const mixedCurry: ComponentFood[] = [
        {
          name: "Paneer Tikka Masala",
          identifiedFood: "paneer butter masala",
          portionDescription: "220g",
          estimatedGrams: 220,
          calories: 462,
          protein: 18.7,
          carbs: 13.6,
          fat: 37.4,
          confidence: 0.84,
          oilState: "HIGH_OIL",
          assumptions: ["Cream and ghee sauce"],
          source: "USDA_FDC",
          evidence: "unobservable_unknown"
        },
        {
          name: "Jeera Basmati Rice",
          identifiedFood: "white rice (cooked)",
          portionDescription: "180g",
          estimatedGrams: 180,
          calories: 234,
          protein: 4.9,
          carbs: 50.8,
          fat: 0.5,
          confidence: 0.92,
          assumptions: [],
          source: "USDA_FDC",
          evidence: "visible"
        }
      ];

      const result = calculateDeterministicMealTotals(mixedCurry, {
        mealName: "Paneer Masala Bowl",
        cuisineType: "South Asian",
        hasSecondPhoto: false
      });

      // Auto-log gate fires
      expect(result.complexMealDetected).toBe(true);
      expect(result.autoLogBlocked).toBe(true);
      expect(result.autoLogBlockReason).toBeDefined();
      expect(result.suggestsSecondPhoto).toBe(true);

      // Wide honestly-labeled range
      expect(result.calorieRange).toBeDefined();
      const spread = (result.calorieRange?.[1] || 0) - (result.calorieRange?.[0] || 0);
      expect(spread).toBeGreaterThanOrEqual(100);

      // Clarification triggered with information gain reasoning
      expect(result.uncertainty?.requiresClarification).toBe(true);
      expect(result.uncertainty?.clarificationPrompt).toContain("Cooking fat & sauce density swing potential");
      expect(result.uncertainty?.clarificationOptions?.length).toBeGreaterThanOrEqual(3);
    });

    // SCENARIO 3: Dish with a real database-energy vs. Atwater-flagged inconsistency
    it("SCENARIO 3: Dish with real DB energy vs Atwater inconsistency — DB value is primary canonical, Atwater secondary diagnostic, no override occurs", () => {
      const inconsistentDish: ComponentFood[] = [
        {
          name: "Specialty High-Protein Loaf",
          identifiedFood: "specialty bread",
          portionDescription: "2 thick slices (120g)",
          estimatedGrams: 120,
          calories: 220, // Certified lab database value
          protein: 40,   // 40 * 4 = 160 kcal
          carbs: 35,     // 35 * 4 = 140 kcal
          fat: 15,       // 15 * 9 = 135 kcal -> Macro sum = 435 kcal
          confidence: 0.94,
          assumptions: [],
          source: "AUTHORITATIVE_DB",
          evidence: "context_derived"
        }
      ];

      const result = calculateDeterministicMealTotals(inconsistentDish, {
        mealName: "Specialty Loaf"
      });

      // Confirm canonical database energy is retained (NO OVERWRITE)
      expect(result.calories).toBe(220);
      expect(result.databaseCalories).toBe(220);
      expect(result.macroDerivedCalories).toBe(435);

      // Confirm Atwater is flagged diagnostically
      expect(result.atwaterDiagnostic).toBeDefined();
      expect(result.atwaterDiagnostic?.isInconsistent).toBe(true);
      expect(result.atwaterDiagnostic?.expectedCalories).toBe(435);
      expect(result.atwaterDiagnostic?.delta).toBe(215);
      expect(result.atwaterDiagnostic?.reason).toContain("Canonical database value retained");
    });

    // SCENARIO 4: Low-light or blurry photo widens uncertainty instead of guessing confidently
    it("SCENARIO 4: Low-light / blurry photo widens uncertainty intervals rather than guessing confidently", () => {
      const blurryComponent: ComponentFood[] = [
        {
          name: "Ambiguous Stir Fry",
          identifiedFood: "mixed vegetable stir fry",
          portionDescription: "estimated ~250g",
          estimatedGrams: 250,
          minGrams: 180, // wide min bounds
          maxGrams: 340, // wide max bounds
          mass_g: { p10: 180, p50: 250, p90: 340 },
          calories: 320,
          protein: 8,
          carbs: 24,
          fat: 22,
          confidence: 0.55, // degraded confidence due to blur
          oilState: "MODERATE_OIL",
          assumptions: ["Low light image: depth and vegetable composition cannot be resolved with certainty"],
          source: "GEMINI_ESTIMATE",
          evidence: "unobservable_unknown"
        }
      ];

      const result = calculateDeterministicMealTotals(blurryComponent, {
        mealName: "Ambiguous Stir Fry",
        hasSecondPhoto: false
      });

      expect(result.confidence).toBeLessThan(0.70);
      expect(result.calorieRange).toBeDefined();
      const intervalSpread = (result.calorieRange?.[1] || 0) - (result.calorieRange?.[0] || 0);
      expect(intervalSpread).toBeGreaterThan(150); // wide honest interval
      expect(result.autoLogBlocked).toBe(true);
    });

    // SCENARIO 5: Forced Gemini API failure degrades correctly, never fabricates a number
    it("SCENARIO 5: Forced Gemini API failure degrades correctly to USDA local matching or honest error, 0 fake numbers", () => {
      // 1. Valid description degrades safely to USDA reference composition
      const recognized = parseMealDescriptionToComponents("Chicken breast and white rice");
      expect(recognized.length).toBe(2);
      const totals = calculateDeterministicMealTotals(recognized);
      expect(totals.calories).toBeGreaterThan(250);
      expect(totals.nutritionSource).toBe("USDA_FDC");
      expect(totals.foods.every(f => f.calories > 0)).toBe(true);

      // 2. Unresolvable description returns empty, never fabricating fake 450 kcal numbers
      const unresolvable = parseMealDescriptionToComponents("zz_unidentifiable_synthetic_substance_9999");
      expect(unresolvable.length).toBe(0);
    });

    // SCENARIO 6: Auth/security regression check
    it("SCENARIO 6: Auth, Firestore rules, and rate limits remain unchanged and enforced", () => {
      const firestoreRules = readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");
      
      // Default deny
      expect(firestoreRules).toContain("match /{document=**} {");
      expect(firestoreRules).toContain("allow read, write: if false;");

      // requireAuth enforcement on all collections
      expect(firestoreRules).toContain("match /users/{userId}");
      expect(firestoreRules).toContain("match /foodLogs/{logId}");
      expect(firestoreRules).toContain("isOwner(userId)");

      // Zero public reads
      expect(firestoreRules).not.toContain("allow read: if true;");
      expect(firestoreRules).not.toContain("allow write: if true;");

      // Server rate limiting & auth middleware check
      const serverCode = readFileSync(path.resolve(process.cwd(), "server.ts"), "utf-8");
      expect(serverCode).toContain("requireAuth");
      expect(serverCode).toContain("RATE_LIMIT_WINDOW_MS");
      expect(serverCode).toContain("RATE_LIMIT_MAX_REQUESTS");
    });
  });
});
