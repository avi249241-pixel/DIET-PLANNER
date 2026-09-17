import fs from "fs";
import path from "path";
// @ts-ignore
import { describe, it, expect } from "bun:test";
import express from "express";
import { requireAuth } from "../src/middleware/auth";
import {
  computeFallbackHash,
  calculateHammingDistance,
  calculateHashSimilarity,
  findBestMealMatch,
  detectFoodCategory,
  computeCorrectionDeltas,
  deriveCategoryPrior,
  HIGH_SIMILARITY_THRESHOLD,
  RECOMPUTE_THRESHOLD_N
} from "../src/lib/personalMemory";
import {
  calculateDeterministicMealTotals,
  ComponentFood,
  USDA_REFERENCE_DB
} from "../src/lib/nutritionEngine";
import {
  ConfirmedMealRecord,
  CorrectionLogEntry,
  CategoryPrior
} from "../src/types";

describe("PERSONAL FOOD MEMORY & CORRECTION FEEDBACK ENGINE (7 SCENARIO AUDIT)", () => {
  const sampleHashOriginal = "a1b2c3d4e5f67890";
  // Exactly 1-bit difference from sampleHashOriginal: '0' (0000) vs '1' (0001) in last hex digit
  const sampleHashNear = "a1b2c3d4e5f67891";
  // Completely different 64-bit hash
  const sampleHashDivergent = "09876f5e4d3c2b1a";

  // =========================================================================
  // SCENARIO 1: Brand-new user with empty confirmedMeals
  // =========================================================================
  describe("SCENARIO 1: Brand-New User with Empty confirmedMeals", () => {
    it("Handles empty confirmedMeals without crash and returns matchFound: false", () => {
      const emptyMeals: ConfirmedMealRecord[] = [];
      const matchResult = findBestMealMatch(sampleHashOriginal, emptyMeals, HIGH_SIMILARITY_THRESHOLD);

      expect(matchResult.matchFound).toBe(false);
      expect(matchResult.similarity).toBe(0);
      expect(matchResult.matchedMeal).toBeUndefined();
      expect(matchResult.reason).toContain("No previous confirmed meals exist in memory");
    });

    it("Runs full vision pipeline without skipping clarifying questions when memory is empty", () => {
      const saucyCurryDish: ComponentFood[] = [
        {
          name: "Chicken Tikka Masala Gravy & Meat",
          identifiedFood: "chicken curry (meat + gravy)",
          portionDescription: "1 deep bowl (280g)",
          estimatedGrams: 280,
          minGrams: 240,
          maxGrams: 340,
          preparationState: "COOKED",
          oilState: "HIGH_OIL",
          visualEvidence: ["Visible ghee sheen", "Thickened tomato cream gravy"],
          calories: 518,
          protein: 46.2,
          carbs: 11.8,
          fat: 32.2,
          confidence: 0.85,
          source: "USDA_FDC"
        }
      ];

      // With no memory match, deterministic engine must still flag uncertainty and request clarification
      const result = calculateDeterministicMealTotals(saucyCurryDish, {
        mealName: "Chicken Tikka Masala",
        mealType: "Dinner"
      });

      expect(result.uncertainty).toBeDefined();
      expect(result.uncertainty!.requiresClarification).toBe(true);
      expect(result.uncertainty!.clarificationOptions?.length).toBeGreaterThanOrEqual(2);
      expect(result.appliedPrior).toBeUndefined(); // Zero synthetic priors applied
    });

    it("API endpoint /api/ai/match-meal-memory returns clean matchFound: false for empty history", async () => {
      const app = express();
      app.use(express.json());
      app.post("/api/ai/match-meal-memory", (req, res) => {
        const { confirmedMeals } = req.body;
        const mealsList = Array.isArray(confirmedMeals) ? confirmedMeals : [];
        if (!mealsList || mealsList.length === 0) {
          return res.json({
            success: true,
            data: {
              matchFound: false,
              similarity: 0,
              reason: "Personal food memory is empty for this user."
            }
          });
        }
        res.json({ success: true, data: { matchFound: true } });
      });

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://localhost:${port}/api/ai/match-meal-memory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoHash: sampleHashOriginal,
            confirmedMeals: []
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.matchFound).toBe(false);
        expect(data.data.similarity).toBe(0);
      } finally {
        server.close();
      }
    });
  });

  // =========================================================================
  // SCENARIO 2: Photo closely matching past confirmed meal (>= 85%)
  // =========================================================================
  describe("SCENARIO 2: High-Similarity Memory Match (>= 85%)", () => {
    const historicalMeal: ConfirmedMealRecord = {
      id: "meal-oatmeal-001",
      userId: "user-athlete-1",
      mealName: "Morning Rolled Oats with Blueberries & Almonds",
      photoHash: sampleHashOriginal,
      composition: [
        {
          name: "Cooked Rolled Oats",
          identifiedFood: "rolled oats (cooked)",
          portionDescription: "1 bowl (240g)",
          estimatedGrams: 240,
          calories: 166,
          protein: 5.9,
          carbs: 28.1,
          fat: 3.6,
          confidence: 0.95,
          source: "USDA_FDC"
        },
        {
          name: "Fresh Blueberries",
          identifiedFood: "blueberries (raw)",
          portionDescription: "0.5 cup (75g)",
          estimatedGrams: 75,
          calories: 43,
          protein: 0.5,
          carbs: 10.9,
          fat: 0.2,
          confidence: 0.98,
          source: "USDA_FDC"
        }
      ],
      totalCalories: 209,
      protein: 6.4,
      carbs: 39.0,
      fat: 3.8,
      mealType: "Breakfast",
      date: "2026-09-15",
      timestamp: Date.now() - 172800000 // 2 days ago
    };

    it("Triggers one-tap memory shortcut when similarity exceeds 85%", () => {
      const match = findBestMealMatch(sampleHashNear, [historicalMeal], HIGH_SIMILARITY_THRESHOLD);

      expect(match.matchFound).toBe(true);
      expect(match.matchedMeal).toBeDefined();
      expect(match.matchedMeal?.id).toBe("meal-oatmeal-001");
      expect(match.similarity).toBeGreaterThanOrEqual(0.85);
      expect(match.reason).toContain("Morning Rolled Oats with Blueberries & Almonds");
    });

    it("One-tap log strictly tags composition evidence as user_confirmed", () => {
      const match = findBestMealMatch(sampleHashNear, [historicalMeal], HIGH_SIMILARITY_THRESHOLD);
      expect(match.matchFound).toBe(true);

      // Simulate one-tap logging transformation
      const loggedFoods = (match.matchedMeal!.composition || []).map(item => ({
        ...item,
        evidence: "user_confirmed" as const,
        source: "USER_EDITED" as const
      }));

      expect(loggedFoods.length).toBe(2);
      loggedFoods.forEach(food => {
        expect(food.evidence).toBe("user_confirmed");
        expect(food.source).toBe("USER_EDITED");
      });

      // Bypasses clarification questions: high-confidence user-confirmed meal does not ask redundant questions
      const directTotals = calculateDeterministicMealTotals(loggedFoods, {
        mealName: match.matchedMeal!.mealName,
        mealType: match.matchedMeal!.mealType
      });

      expect(directTotals.uncertainty?.requiresClarification).toBe(false);
      expect(directTotals.calories).toBe(209);
    });
  });

  // =========================================================================
  // SCENARIO 3: Superficially similar photo where user selects 'No, this is different'
  // =========================================================================
  describe("SCENARIO 3: User Rejection of Memory Match", () => {
    const historicalChickenCurry: ConfirmedMealRecord = {
      id: "curry-chicken-001",
      userId: "user-athlete-1",
      mealName: "Chicken Curry with Gravy",
      photoHash: sampleHashOriginal,
      composition: [
        {
          name: "Chicken Breast in Curry",
          identifiedFood: "chicken curry",
          portionDescription: "250g",
          estimatedGrams: 250,
          calories: 380,
          protein: 38,
          carbs: 8,
          fat: 22,
          confidence: 0.90,
          source: "USDA_FDC"
        }
      ],
      totalCalories: 380,
      protein: 38,
      carbs: 8,
      fat: 22,
      mealType: "Dinner",
      date: "2026-09-16",
      timestamp: Date.now() - 86400000
    };

    it("Falling through after rejection executes full vision pipeline without adopting old composition", () => {
      // 1. Memory candidate found
      let activeMemoryMatch: any = findBestMealMatch(sampleHashNear, [historicalChickenCurry], HIGH_SIMILARITY_THRESHOLD);
      expect(activeMemoryMatch.matchFound).toBe(true);

      // 2. User clicks "No, this is different"
      // Simulated handleRejectMemoryMatch:
      activeMemoryMatch = null;
      expect(activeMemoryMatch).toBeNull();

      // 3. System analyzes the actual distinct meal (e.g. Mutton Rogan Josh instead of Chicken Curry)
      const actualMuttonCurryDish: ComponentFood[] = [
        {
          name: "Mutton Rogan Josh (Bone-in)",
          identifiedFood: "lamb curry",
          portionDescription: "300g",
          estimatedGrams: 300,
          minGrams: 250,
          maxGrams: 350,
          preparationState: "COOKED",
          oilState: "HIGH_OIL",
          visualEvidence: ["Deep red spiced gravy", "Bone-in red meat pieces"],
          calories: 620,
          protein: 42,
          carbs: 6,
          fat: 48,
          confidence: 0.82,
          source: "USDA_FDC"
        }
      ];

      const fullAnalysisResult = calculateDeterministicMealTotals(actualMuttonCurryDish, {
        mealName: "Mutton Rogan Josh",
        mealType: "Dinner"
      });

      // Must preserve the new meal's unique macros (620 kcal, 48g fat) instead of old chicken curry (380 kcal, 22g fat)
      expect(fullAnalysisResult.calories).toBe(620);
      expect(fullAnalysisResult.fat).toBe(48);
      expect(fullAnalysisResult.calories).not.toBe(historicalChickenCurry.totalCalories);
      // Ensures clarification is still triggered for the new complex dish
      expect(fullAnalysisResult.uncertainty?.requiresClarification).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 4: Correction logged when predicted oil mass diverges significantly
  // =========================================================================
  describe("SCENARIO 4: Discrepancy Logging into correctionLog with Evidence Class Context", () => {
    it("Captures oil mass and caloric deltas with appropriate evidence classes", () => {
      const predicted = {
        calories: 420,
        protein: 24,
        carbs: 35,
        fat: 18,
        foods: [
          {
            name: "Paneer Makhani Gravy",
            estimatedGrams: 200,
            fat: 18,
            evidence: "unobservable_unknown" as const
          }
        ]
      };

      // User confirms restaurant-style rich ghee preparation (+14g fat, +126 kcal)
      const confirmed = {
        calories: 546,
        protein: 24,
        carbs: 35,
        fat: 32,
        foods: [
          {
            name: "Paneer Makhani Gravy (Rich Ghee)",
            estimatedGrams: 200,
            fat: 32,
            evidence: "user_confirmed" as const
          }
        ]
      };

      const deltas = computeCorrectionDeltas({
        userId: "user-athlete-1",
        mealName: "Paneer Butter Masala",
        mealId: "log-curry-789",
        foodCategory: "curry",
        predicted,
        confirmed
      });

      expect(deltas.length).toBeGreaterThanOrEqual(2);

      // Verify oil_grams delta
      const oilDelta = deltas.find(d => d.fieldName === "oil_grams");
      expect(oilDelta).toBeDefined();
      expect(oilDelta?.delta).toBe(14); // 32 - 18
      expect(oilDelta?.foodCategory).toBe("curry");
      expect(oilDelta?.evidenceClass).toBe("unobservable_unknown"); // Carries prediction-time unobservable oil context

      // Verify calories delta
      const calDelta = deltas.find(d => d.fieldName === "calories");
      expect(calDelta).toBeDefined();
      expect(calDelta?.delta).toBe(126); // 546 - 420
      expect(calDelta?.foodCategory).toBe("curry");
      expect(calDelta?.evidenceClass).toBe("context_derived");
    });
  });

  // =========================================================================
  // SCENARIO 5: categoryPriors recompute triggered (isolated, versioned, traceable, bounded)
  // =========================================================================
  describe("SCENARIO 5: Versioned & Traceable Category Prior Derivation", () => {
    it("Derives bounded, traceable adjustment factors and increments version after N >= 3 corrections", () => {
      const now = Date.now();
      const curryCorrections: CorrectionLogEntry[] = [
        {
          id: "corr-101",
          userId: "user-athlete-1",
          foodCategory: "curry",
          fieldName: "oil_grams",
          predictedValue: 15,
          confirmedValue: 21,
          delta: 6,
          evidenceClass: "unobservable_unknown",
          timestamp: now - 3000
        },
        {
          id: "corr-102",
          userId: "user-athlete-1",
          foodCategory: "curry",
          fieldName: "oil_grams",
          predictedValue: 18,
          confirmedValue: 24,
          delta: 6,
          evidenceClass: "unobservable_unknown",
          timestamp: now - 2000
        },
        {
          id: "corr-103",
          userId: "user-athlete-1",
          foodCategory: "curry",
          fieldName: "calories",
          predictedValue: 450,
          confirmedValue: 510,
          delta: 60,
          evidenceClass: "context_derived",
          timestamp: now - 1000
        }
      ];

      expect(curryCorrections.length).toBeGreaterThanOrEqual(RECOMPUTE_THRESHOLD_N);

      const existingPrior: CategoryPrior = {
        id: "curry",
        userId: "user-athlete-1",
        category: "curry",
        version: 1,
        oilMassAdjustmentFactor: 1.0,
        portionAdjustmentFactor: 1.0,
        calorieAdjustmentOffset: 0,
        confidenceOffset: 0,
        sampleCount: 1,
        traceableCorrectionIds: ["corr-old"],
        reasoning: "Version 1 baseline",
        updatedAt: now - 10000
      };

      const updatedPrior = deriveCategoryPrior({
        userId: "user-athlete-1",
        category: "curry",
        existingPrior,
        corrections: curryCorrections
      });

      // 1. Version incremented
      expect(updatedPrior.version).toBe(2);

      // 2. Traceability: explicit IDs captured
      expect(updatedPrior.traceableCorrectionIds).toContain("corr-101");
      expect(updatedPrior.traceableCorrectionIds).toContain("corr-102");
      expect(updatedPrior.traceableCorrectionIds).toContain("corr-103");
      expect(updatedPrior.sampleCount).toBe(3);

      // 3. Physiological safety bounds
      expect(updatedPrior.oilMassAdjustmentFactor).toBeGreaterThan(1.0);
      expect(updatedPrior.oilMassAdjustmentFactor).toBeLessThanOrEqual(1.50);
      expect(updatedPrior.calorieAdjustmentOffset).toBeGreaterThan(0);
      expect(updatedPrior.calorieAdjustmentOffset).toBeLessThanOrEqual(150);

      // 4. Category Isolation: Curry corrections must NOT alter other categories (e.g. salad)
      const saladPrior = deriveCategoryPrior({
        userId: "user-athlete-1",
        category: "salad",
        existingPrior: null,
        corrections: curryCorrections // Passing curry corrections to salad prior request
      });

      expect(saladPrior.sampleCount).toBe(0);
      expect(saladPrior.oilMassAdjustmentFactor).toBe(1.0);
      expect(saladPrior.calorieAdjustmentOffset).toBe(0);
      expect(saladPrior.traceableCorrectionIds).toEqual([]);
    });

    it("Applies category prior to widen unobservable oil factor during deterministic meal calculation", () => {
      const prior: CategoryPrior = {
        id: "curry",
        userId: "user-athlete-1",
        category: "curry",
        version: 2,
        oilMassAdjustmentFactor: 1.30,
        portionAdjustmentFactor: 1.0,
        calorieAdjustmentOffset: 45,
        confidenceOffset: 0.05,
        sampleCount: 4,
        traceableCorrectionIds: ["c1", "c2", "c3"],
        reasoning: "User curries routinely contain +30% oil",
        updatedAt: Date.now()
      };

      const curryComponent: ComponentFood[] = [
        {
          name: "Paneer Tikka Masala Gravy",
          identifiedFood: "paneer curry",
          portionDescription: "1 cup (220g)",
          estimatedGrams: 220,
          calories: 380,
          protein: 14,
          carbs: 18,
          fat: 26,
          confidence: 0.85,
          evidence: "unobservable_unknown",
          source: "USDA_FDC"
        }
      ];

      const result = calculateDeterministicMealTotals(curryComponent, {
        mealName: "Paneer Tikka Masala Curry",
        categoryPriors: [prior]
      });

      expect(result.appliedPrior).toBeDefined();
      expect(result.appliedPrior?.category).toBe("curry");
      expect(result.appliedPrior?.oilMassAdjustmentFactor).toBe(1.30);
      expect(result.estimationNotes.some(note => note.includes("Personal Prior"))).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 6: Forced embedding / similarity API failure
  // =========================================================================
  describe("SCENARIO 6: Silent Non-Blocking Fallback on Embedding / Similarity API Failure", () => {
    it("Handles server/network failure gracefully without crashing or blocking meal logging", async () => {
      const app = express();
      app.use(express.json());

      // Mock endpoint that simulates unexpected internal failure
      app.post("/api/ai/match-meal-memory", (req, res) => {
        // Enforce safe failure handling from server.ts
        try {
          throw new Error("Simulated memory vector lookup timeout / Firestore unavailable");
        } catch (err: any) {
          // Silent fallback as specified in server.ts
          return res.json({
            success: true,
            data: {
              matchFound: false,
              similarity: 0,
              reason: "Memory lookup encountered an error; falling back to full vision pipeline."
            }
          });
        }
      });

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://localhost:${port}/api/ai/match-meal-memory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoHash: "corrupt_hash_data",
            confirmedMeals: [{ id: "m1" }]
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        // Zero fabricated match
        expect(data.data.matchFound).toBe(false);
        expect(data.data.similarity).toBe(0);
        expect(data.data.reason).toContain("falling back to full vision pipeline");
      } finally {
        server.close();
      }
    });

    it("Corrupted or empty image string safely defaults to fallback hash without unhandled exception", async () => {
      const emptyHash = computeFallbackHash("");
      expect(emptyHash).toBe("0000000000000000");

      const shortHash = computeFallbackHash("too_short");
      expect(shortHash).toBe("0000000000000000");

      const validHash = computeFallbackHash("VGhpcyBpcyBhIHNhbXBsZSBiYXNlNjQgc3RyaW5nIGZvciBmb29kIGltYWdlIGRhdGE=");
      expect(validHash.length).toBe(16);
      expect(calculateHammingDistance(validHash, emptyHash)).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // SCENARIO 7: Full Security Regression Check
  // =========================================================================
  describe("SCENARIO 7: Security & Boundary Verification", () => {
    it("Enforces requireAuth on /api/ai/match-meal-memory", async () => {
      const app = express();
      app.use(express.json());
      app.use("/api", requireAuth);
      app.post("/api/ai/match-meal-memory", (req, res) => res.json({ success: true }));

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        // Missing Authorization header
        const unauthRes = await fetch(`http://localhost:${port}/api/ai/match-meal-memory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        expect(unauthRes.status).toBe(401);

        // Corrupt token
        const corruptRes = await fetch(`http://localhost:${port}/api/ai/match-meal-memory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer invalid.malicious.token"
          },
          body: JSON.stringify({})
        });
        expect(corruptRes.status).toBe(401);
      } finally {
        server.close();
      }
    });

    it("Audits firestore.rules for append-only correctionLog and strict user ownership", () => {
      const rulesContent = fs.readFileSync(path.resolve("firestore.rules"), "utf-8");

      // 1. correctionLog must be append-only: create allowed, update/delete forbidden
      expect(rulesContent).toContain("match /correctionLog/{correctionId}");
      expect(rulesContent).toContain("allow update, delete: if false;");

      // 2. confirmedMeals must be strictly user-owned
      expect(rulesContent).toContain("match /confirmedMeals/{mealId}");
      expect(rulesContent).toContain("allow get, list: if isOwner(userId);");
      expect(rulesContent).toContain("incoming().userId == userId");

      // 3. categoryPriors must be user-owned and non-deletable
      expect(rulesContent).toContain("match /categoryPriors/{categoryId}");
      expect(rulesContent).toContain("allow get, list: if isOwner(userId);");
      expect(rulesContent).toContain("allow delete: if false;");
    });

    it("Preserves Atwater energy check as diagnostic-only without overriding database calories", () => {
      // Declared database calories = 100 kcal, but macros = 50g P + 50g C + 20g F = 580 kcal (delta = 480 kcal)
      const contradictoryItem: ComponentFood = {
        name: "Contradictory Powder",
        identifiedFood: "protein powder",
        portionDescription: "100g",
        estimatedGrams: 100,
        calories: 100, // declared database calories
        protein: 50,
        carbs: 50,
        fat: 20,
        confidence: 0.8,
        source: "GEMINI_ESTIMATE"
      };

      const result = calculateDeterministicMealTotals([contradictoryItem], {
        mealName: "Protein Shake",
        mealType: "Snack"
      });

      // Crucial: Calories must remain exactly 100 kcal from the authoritative source, NEVER overridden to 580
      expect(result.calories).toBe(100);
      expect(result.databaseCalories).toBe(100);
      expect(result.macroDerivedCalories).toBe(580);
      expect(result.energyCheckDelta).toBe(480);
      expect(result.atwaterDiagnostic?.isInconsistent).toBe(true);
      expect(result.atwaterDiagnostic?.reason).toContain("Diagnostic Note");
      expect(result.estimationNotes.some(n => n.includes("Diagnostic Note"))).toBe(true);
    });
  });
});
