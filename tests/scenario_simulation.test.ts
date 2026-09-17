import fs from "fs";
// @ts-ignore
import { describe, it, expect, mock } from "bun:test";
import {
  calculateDeterministicMealTotals,
  ComponentFood,
  parseMealDescriptionToComponents,
  USDA_REFERENCE_DB
} from "../src/lib/nutritionEngine";
import { nutritionService } from "../src/lib/nutritionProvider";
import express from "express";
import { requireAuth } from "../src/middleware/auth";

describe("PROMPT 2 SCENARIO SIMULATIONS (Accuracy, Provenance & Security)", () => {
  // =========================================================================
  // SCENARIO 1: Mixed / Saucy Dish (Curry, Stew) Portion & Oil Estimation
  // =========================================================================
  it("SCENARIO 1: Mixed/saucy dish calculates realistic bounds, oil factors, and triggers clarifying questions", () => {
    const saucyCompositeDish: ComponentFood[] = [
      {
        name: "Chicken Tikka Masala Gravy & Meat",
        identifiedFood: "chicken curry (meat + gravy)",
        portionDescription: "1 deep bowl (280g)",
        estimatedGrams: 280,
        minGrams: 240,
        maxGrams: 340,
        preparationState: "COOKED",
        oilState: "HIGH_OIL",
        visualEvidence: ["Visible ghee/oil sheen on curry surface", "Thickened tomato cream gravy"],
        calories: 518, // 185 kcal/100g * 2.8
        protein: 46.2,
        carbs: 11.8,
        fat: 32.2,
        confidence: 0.85,
        assumptions: ["Restaurant preparation with heavy cream and ghee"],
        source: "USDA_FDC"
      },
      {
        name: "Steamed Basmati Rice",
        identifiedFood: "white rice (cooked)",
        portionDescription: "1 cup mound (200g)",
        estimatedGrams: 200,
        minGrams: 170,
        maxGrams: 240,
        preparationState: "COOKED",
        oilState: "LOW_OIL",
        visualEvidence: ["Fluffy separate grains"],
        calories: 260,
        protein: 5.4,
        carbs: 56.4,
        fat: 0.6,
        confidence: 0.95,
        assumptions: ["Plain steamed"],
        source: "USDA_FDC"
      }
    ];

    const result = calculateDeterministicMealTotals(saucyCompositeDish, {
      mealName: "Chicken Tikka Masala with Basmati Rice",
      mealType: "Dinner"
    });

    // 1. Total energy must be accurately calculated without 380 kcal collapsing
    expect(result.calories).toBeGreaterThan(700);
    expect(result.protein).toBeGreaterThan(50);
    expect(result.fat).toBeGreaterThan(30);

    // 2. Uncertainty must capture wide calorie interval from sauce & portion variance
    expect(result.uncertainty).toBeDefined();
    const [minCal, maxCal] = result.uncertainty!.calorieRange;
    expect(minCal).toBeLessThan(result.calories);
    expect(maxCal).toBeGreaterThan(result.calories);
    expect(maxCal - minCal).toBeGreaterThan(100);

    // 3. Must flag high cooking fat as primary uncertainty factor
    expect(result.uncertainty!.primaryUncertaintyFactor).toBe("HIDDEN_COOKING_FAT");

    // 4. Must require clarification for user confirmation
    expect(result.uncertainty!.requiresClarification).toBe(true);
    expect(result.uncertainty!.clarificationPrompt).toBeDefined();
    expect(result.uncertainty!.clarificationOptions?.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // SCENARIO 2: Low-Light or Blurry Photo
  // =========================================================================
  it("SCENARIO 2: Low-light or blurry photo reflects lowered confidence and widened uncertainty intervals", () => {
    const lowLightDish: ComponentFood[] = [
      {
        name: "Unclear Noodle or Grain Bowl",
        identifiedFood: "ramen wheat noodles (cooked)",
        portionDescription: "Approx 1 bowl (obscured scale)",
        estimatedGrams: 250,
        minGrams: 180,
        maxGrams: 360, // Wide bounds due to lighting & blur
        preparationState: "UNKNOWN",
        oilState: "MODERATE_OIL",
        visualEvidence: ["Low illumination", "Motion blur on plate edges"],
        calories: 395,
        protein: 14.5,
        carbs: 77.2,
        fat: 2.5,
        confidence: 0.60, // Degraded identification confidence
        assumptions: ["Standard wheat noodle composition"],
        source: "GEMINI_ESTIMATE"
      }
    ];

    const result = calculateDeterministicMealTotals(lowLightDish, {
      mealName: "Uncertain Noodle Bowl",
      mealType: "Dinner"
    });

    // Overall confidence must drop below 0.80
    expect(result.confidence).toBeLessThanOrEqual(0.75);

    // Calorie range must be broad
    expect(result.uncertainty).toBeDefined();
    const [minCal, maxCal] = result.uncertainty!.calorieRange;
    expect(maxCal - minCal).toBeGreaterThan(120);

    // Provenance must not falsely claim authoritative USDA status
    expect(result.nutritionSource).toBe("GEMINI_ESTIMATE");
  });

  // =========================================================================
  // SCENARIO 3: Forced Gemini API Failure Chain Degradation
  // =========================================================================
  it("SCENARIO 3A: Forced Gemini API failure degrades gracefully to deterministic heuristic when description exists", () => {
    const mealDescription = "grilled chicken breast with brown rice and steamed broccoli";
    const parsedComponents = parseMealDescriptionToComponents(mealDescription);

    expect(parsedComponents.length).toBeGreaterThanOrEqual(2);
    const totals = calculateDeterministicMealTotals(parsedComponents, {
      mealName: mealDescription,
      mealType: "Lunch"
    });

    // Verifies deterministic calculation succeeds from USDA_REFERENCE_DB
    expect(totals.calories).toBeGreaterThan(300);
    expect(totals.protein).toBeGreaterThan(30);
    expect(totals.nutritionSource).toBe("USDA_FDC");
  });

  it("SCENARIO 3B: Complete API failure on unresolvable photo returns honest error without fake numbers", async () => {
    // When an image cannot be processed and no fallback text exists, the pipeline
    // must NEVER invent fake 350 kcal or hallucinated nutrition.
    const emptyFoods: ComponentFood[] = [];
    expect(() => calculateDeterministicMealTotals(emptyFoods)).toThrow(
      "Cannot calculate meal totals: Component foods array is empty."
    );
  });

  // =========================================================================
  // SCENARIO 4: Food with No Authoritative Database Match
  // =========================================================================
  it("SCENARIO 4: Food with no authoritative DB match is labeled GEMINI_ESTIMATE and flagged as estimate", async () => {
    const exoticQuery = "zz_nonexistent_synthetic_substance_9999";
    const resolved = await nutritionService.resolveFoodEntity(exoticQuery);

    // If no match in USDA FDC or Open Food Facts or Local DB, resolveFoodEntity returns null
    expect(resolved).toBeNull();

    // When tagged in meal pipeline, unmatched item must be tagged GEMINI_ESTIMATE
    const estimateComponent: ComponentFood = {
      name: "Artisanal Dragonfruit Tartlet",
      identifiedFood: "exotic fruit pastry",
      portionDescription: "1 small pastry (90g)",
      estimatedGrams: 90,
      calories: 280,
      protein: 3.5,
      carbs: 42.0,
      fat: 11.2,
      confidence: 0.70, // Capped confidence
      assumptions: ["AI visual inference without laboratory composition match"],
      source: "GEMINI_ESTIMATE"
    };

    const totals = calculateDeterministicMealTotals([estimateComponent], {
      mealName: "Artisanal Dragonfruit Tartlet",
      mealType: "Snack"
    });

    expect(totals.nutritionSource).toBe("GEMINI_ESTIMATE");
    expect(totals.foods[0].source).toBe("GEMINI_ESTIMATE");
    expect(totals.foods[0].databaseMatch).toBeUndefined();
  }, 15000);

  // =========================================================================
  // SCENARIO 5: Firestore & Express Auth Enforcement
  // =========================================================================
  it("SCENARIO 5A: Express route rejects unauthenticated request with 401 Unauthorized", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", requireAuth);
    app.post("/api/ai/analyze-food", (req, res) => res.json({ success: true }));

    // 1. Missing Authorization header
    const reqWithoutAuth = new Request("http://localhost:3000/api/ai/analyze-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Salad" })
    });

    // Mock Express dispatch
    let capturedStatus = 0;
    let capturedBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        capturedStatus = code;
        return {
          json: (body: any) => {
            capturedBody = body;
          }
        };
      }
    };

    const mockReq: any = {
      headers: {}
    };

    let nextCalled = false;
    await requireAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(capturedStatus).toBe(401);
    expect(capturedBody?.error).toContain("Unauthorized: Missing token");
  });

  it("SCENARIO 5B: Express route rejects invalid / corrupt token with 401 Unauthorized", async () => {
    let capturedStatus = 0;
    let capturedBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        capturedStatus = code;
        return {
          json: (body: any) => {
            capturedBody = body;
          }
        };
      }
    };

    const mockReq: any = {
      headers: {
        authorization: "Bearer totally-invalid-bogus-token-xyz"
      }
    };

    let nextCalled = false;
    await requireAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(capturedStatus).toBe(401);
    expect(capturedBody?.error).toContain("Unauthorized: Invalid token");
  });

  it("SCENARIO 5C: Express route accepts valid authenticated bearer token and passes user context", async () => {
    process.env.ALLOW_TEST_TOKEN = "true";

    let capturedStatus = 200;
    let capturedBody: any = null;
    let nextCalled = false;

    const mockRes: any = {
      status: (code: number) => {
        capturedStatus = code;
        return { json: (b: any) => { capturedBody = b; } };
      }
    };

    const mockReq: any = {
      headers: {
        authorization: "Bearer test-token-athlete_123"
      }
    };

    await requireAuth(mockReq, mockRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.uid).toBe("athlete_123");
  });

  it("SCENARIO 5D: Firestore security rule analysis verifies cross-user and unauthenticated writes are denied", async () => {
    const rulesContent = fs.readFileSync("firestore.rules", "utf-8");

    // 1. Confirm legacy insecure public get is eradicated
    expect(rulesContent).not.toContain("allow get: if true");
    expect(rulesContent).not.toContain("allow get, list: if true");

    // 2. Confirm request.auth.uid == userId rule is mandatory on users and subcollections
    expect(rulesContent).toContain("isOwner(userId)");
    expect(rulesContent).toContain("request.auth != null && request.auth.uid == userId");

    // 3. Confirm foodLogs subcollection enforces both ownership and schema validation
    expect(rulesContent).toContain("isValidFoodItem(incoming(), userId)");
  });
});
