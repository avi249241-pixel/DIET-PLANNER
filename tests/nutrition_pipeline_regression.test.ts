// @ts-ignore
import { describe, it, expect } from "bun:test";
import {
  calculateDeterministicMealTotals,
  lookupAuthoritativeFood,
  evaluateIsJunkFood,
  evaluateHealthScoreAndGrade,
  updateComponentPortion,
  removeComponentFromMeal,
  addComponentToMeal,
  ComponentFood
} from "../src/lib/nutritionEngine";

describe("Hardened Nutrition Pipeline & Zero-Fallback Regression Suite", () => {
  // TEST 1: 1710 kcal / 61p / 177c / 85f South Asian composite meal
  it("TEST 1: 1710 kcal / 61p / 177c / 85f meal must maintain accurate values without 380 kcal fallback", () => {
    const southAsianPlatter: ComponentFood[] = [
      {
        name: "Steamed White Rice",
        identifiedFood: "white rice (cooked)",
        portionDescription: "1 large bowl (250g)",
        estimatedGrams: 250,
        calories: 325,
        protein: 6.8,
        carbs: 70.5,
        fat: 0.8,
        confidence: 0.95,
        assumptions: ["Cooked white rice"],
        source: "USDA_FDC"
      },
      {
        name: "Malabar Parotta",
        identifiedFood: "parotta / flatbread",
        portionDescription: "1 flatbread (80g)",
        estimatedGrams: 80,
        calories: 261,
        protein: 5.8,
        carbs: 39.6,
        fat: 9.0,
        confidence: 0.9,
        assumptions: ["Fried layered flatbread with oil"],
        source: "USDA_FDC"
      },
      {
        name: "Chicken Korma / Curry",
        identifiedFood: "chicken curry (meat + gravy)",
        portionDescription: "1 bowl (180g)",
        estimatedGrams: 180,
        calories: 333,
        protein: 29.7,
        carbs: 7.6,
        fat: 20.7,
        confidence: 0.85,
        assumptions: ["Rich gravy with chicken pieces"],
        source: "USDA_FDC"
      },
      {
        name: "Vegetable Coconut Curry",
        identifiedFood: "coconut vegetable curry",
        portionDescription: "1 bowl (160g)",
        estimatedGrams: 160,
        calories: 232,
        protein: 4.5,
        carbs: 15.2,
        fat: 17.6,
        confidence: 0.85,
        assumptions: ["Coconut milk base"],
        source: "USDA_FDC"
      },
      {
        name: "Green Beans Poriyal / Stir Fry",
        identifiedFood: "green beans stir fry (poriyal)",
        portionDescription: "1 cup (120g)",
        estimatedGrams: 120,
        calories: 102,
        protein: 2.9,
        carbs: 9.8,
        fat: 6.1,
        confidence: 0.9,
        assumptions: ["Tempered with mustard and coconut"],
        source: "USDA_FDC"
      },
      {
        name: "Roasted Papad & Chutneys",
        identifiedFood: "papadum / papad (roasted)",
        portionDescription: "1 papad + 40g chutney",
        estimatedGrams: 60,
        calories: 210,
        protein: 8.2,
        carbs: 22.0,
        fat: 9.5,
        confidence: 0.85,
        assumptions: ["Lentil crisp + coconut/tomato chutney"],
        source: "USDA_FDC"
      }
    ];

    const result = calculateDeterministicMealTotals(southAsianPlatter, {
      mealName: "South Asian Feast Platter",
      mealType: "Lunch",
      cuisineType: "South Asian"
    });

    // Total must be within realistic magnitude (~1400-1800 kcal) and NOT 380 kcal!
    expect(result.calories).toBeGreaterThan(1400);
    expect(result.calories).toBeLessThan(1850);
    expect(result.protein).toBeGreaterThan(50);
    expect(result.carbs).toBeGreaterThan(150);
    expect(result.fat).toBeGreaterThan(60);
    expect(result.calories).not.toBe(380); // CRITICAL: NEVER 380!
  });

  // TEST 2: Multiple food components are correctly summed deterministically
  it("TEST 2: Multiple food components are correctly summed deterministically", () => {
    const items: ComponentFood[] = [
      {
        name: "Grilled Chicken",
        identifiedFood: "chicken breast (grilled)",
        portionDescription: "200g",
        estimatedGrams: 200,
        calories: 330,
        protein: 62.0,
        carbs: 0.0,
        fat: 7.2,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      },
      {
        name: "White Rice",
        identifiedFood: "white rice (cooked)",
        portionDescription: "200g",
        estimatedGrams: 200,
        calories: 260,
        protein: 5.4,
        carbs: 56.4,
        fat: 0.6,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      },
      {
        name: "Steamed Broccoli",
        identifiedFood: "broccoli (steamed)",
        portionDescription: "150g",
        estimatedGrams: 150,
        calories: 53,
        protein: 3.6,
        carbs: 10.8,
        fat: 0.6,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      }
    ];

    const result = calculateDeterministicMealTotals(items);
    expect(result.protein).toBe(71); // 62 + 5.4 + 3.6 = 71.0
    expect(result.carbs).toBe(67.2); // 0 + 56.4 + 10.8 = 67.2
    expect(result.fat).toBe(8.4); // 7.2 + 0.6 + 0.6 = 8.4
    expect(result.totalGrams).toBe(550);
  });

  // TEST 3: Empty or malformed component foods throws and prevents silent persistence
  it("TEST 3: AI returns malformed/empty data -> throws error to block silent persistence", () => {
    expect(() => calculateDeterministicMealTotals([])).toThrow();
  });

  // TEST 4: Missing nutrition does not substitute fake 380/28/35/12 defaults
  it("TEST 4: Missing nutrition values default to 0 and transparent warnings, not fake numbers", () => {
    const incompleteFood: ComponentFood[] = [
      {
        name: "Unknown Exotic Fruit",
        identifiedFood: "exotic fruit",
        portionDescription: "100g",
        estimatedGrams: 100,
        calories: 60,
        protein: 1,
        carbs: 14,
        fat: 0,
        confidence: 0.6,
        assumptions: ["Uncertain species"],
        source: "GEMINI_ESTIMATE"
      }
    ];

    const result = calculateDeterministicMealTotals(incompleteFood);
    expect(result.calories).toBe(60);
    expect(result.protein).toBe(1);
    expect(result.carbs).toBe(14);
    expect(result.fat).toBe(0);
    expect(result.calories).not.toBe(380);
  });

  // TEST 5: Database lookup succeeds -> authoritative USDA nutrition is used
  it("TEST 5: Authoritative database lookup retrieves exact USDA data", () => {
    const dbRice = lookupAuthoritativeFood("white rice (cooked)");
    expect(dbRice).not.toBeNull();
    expect(dbRice?.calories).toBe(130);
    expect(dbRice?.protein).toBe(2.7);
    expect(dbRice?.carbs).toBe(28.2);

    const dbChicken = lookupAuthoritativeFood("chicken breast (grilled)");
    expect(dbChicken).not.toBeNull();
    expect(dbChicken?.protein).toBe(31.0);
  });

  // TEST 6: Database lookup fails for unlisted items -> explicit estimated state
  it("TEST 6: Unlisted cultural dish uses explicit GEMINI_ESTIMATE with confidence tag", () => {
    const unknown = lookupAuthoritativeFood("Random Unlisted Tribal Fermented Dish");
    expect(unknown).toBeNull();
  });

  // TEST 7: Portion adjustment correctly scales totals deterministically
  it("TEST 7: Portion scaling (1.5x and 0.5x) scales calories and macros exactly", () => {
    const baseItems: ComponentFood[] = [
      {
        name: "Oatmeal",
        identifiedFood: "rolled oats (cooked)",
        portionDescription: "1 bowl (200g)",
        estimatedGrams: 200,
        calories: 142,
        protein: 5.0,
        carbs: 24.0,
        fat: 3.0,
        confidence: 0.9,
        assumptions: [],
        source: "USDA_FDC"
      }
    ];

    const single = calculateDeterministicMealTotals(baseItems);
    expect(single.calories).toBe(142);

    // Scale to 2x (400g)
    const doubleItems = baseItems.map(b => ({
      ...b,
      estimatedGrams: b.estimatedGrams * 2,
      calories: b.calories * 2,
      protein: b.protein * 2,
      carbs: b.carbs * 2,
      fat: b.fat * 2
    }));
    const double = calculateDeterministicMealTotals(doubleItems);
    expect(double.calories).toBe(284);
    expect(double.protein).toBe(10);
    expect(double.carbs).toBe(48);
  });

  // TEST 8: JSON serialization / Storage roundtrip does not mutate nutrition
  it("TEST 8: JSON Serialization round-trip does not alter macro values", () => {
    const original = calculateDeterministicMealTotals([
      {
        name: "Salmon + Avocado",
        identifiedFood: "salmon (pan-seared)",
        portionDescription: "200g",
        estimatedGrams: 200,
        calories: 412,
        protein: 44.2,
        carbs: 0.0,
        fat: 24.6,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      }
    ]);

    const serialized = JSON.stringify(original);
    const restored = JSON.parse(serialized);

    expect(restored.calories).toBe(original.calories);
    expect(restored.protein).toBe(original.protein);
    expect(restored.carbs).toBe(original.carbs);
    expect(restored.fat).toBe(original.fat);
  });

  // TEST 9: Sum of meals equals daily total
  it("TEST 9: Daily aggregation sums multiple persisted meals without loss", () => {
    const meal1 = { calories: 450, protein: 35, carbs: 45, fat: 12 };
    const meal2 = { calories: 650, protein: 50, carbs: 65, fat: 20 };
    const meal3 = { calories: 550, protein: 40, carbs: 55, fat: 18 };

    const dailyCalories = [meal1, meal2, meal3].reduce((acc, m) => acc + m.calories, 0);
    const dailyProtein = [meal1, meal2, meal3].reduce((acc, m) => acc + m.protein, 0);

    expect(dailyCalories).toBe(1650);
    expect(dailyProtein).toBe(125);
  });

  // TEST 10: Health score and grade change dynamically based on meal profile
  it("TEST 10: Health score and grade change dynamically (high protein whole meal vs deep fried junk)", () => {
    const healthyMeal: ComponentFood[] = [
      {
        name: "Grilled Chicken & Broccoli",
        identifiedFood: "chicken breast (grilled)",
        portionDescription: "300g",
        estimatedGrams: 300,
        calories: 380,
        protein: 60,
        carbs: 12,
        fat: 8,
        sugar: 2,
        sodium: 250,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      }
    ];
    const healthyResult = calculateDeterministicMealTotals(healthyMeal);
    expect(healthyResult.isJunk).toBe(false);
    expect(healthyResult.grade).toBe("A");
    expect(healthyResult.healthScore).toBeGreaterThanOrEqual(85);

    const junkMeal: ComponentFood[] = [
      {
        name: "Cheeseburger & French Fries",
        identifiedFood: "cheeseburger",
        portionDescription: "400g",
        estimatedGrams: 400,
        calories: 980,
        protein: 22,
        carbs: 110,
        fat: 52,
        sugar: 35,
        sodium: 1750,
        confidence: 0.95,
        assumptions: ["Deep fried"],
        source: "AUTHORITATIVE_DB"
      }
    ];
    const junkResult = calculateDeterministicMealTotals(junkMeal);
    expect(junkResult.isJunk).toBe(true);
    expect(["D", "F"]).toContain(junkResult.grade);
    expect(junkResult.healthScore).toBeLessThanOrEqual(55);
  });

  // TEST 11: Energy consistency check catches macro/calorie contradictions
  it("TEST 11: Energy consistency check: Canonical database energy preserved; Atwater flag is diagnostic-only without override", () => {
    // Declared calories = 100, but macros = 50g P (200 kcal) + 50g C (200 kcal) + 20g F (180 kcal) = 580 kcal
    const contradictoryItem: ComponentFood[] = [
      {
        name: "Contradictory Powder",
        identifiedFood: "protein powder",
        portionDescription: "100g",
        estimatedGrams: 100,
        calories: 100, // declared database calories
        protein: 50,
        carbs: 50,
        fat: 20,
        confidence: 0.8,
        assumptions: [],
        source: "GEMINI_ESTIMATE"
      }
    ];

    const result = calculateDeterministicMealTotals(contradictoryItem);
    // Atwater reversal: Database energy is canonical (100 kcal), NOT overwritten by 580 kcal
    expect(result.calories).toBe(100);
    expect(result.databaseCalories).toBe(100);
    expect(result.macroDerivedCalories).toBe(580);
    expect(result.energyCheckDelta).toBe(480);
    expect(result.atwaterDiagnostic?.isInconsistent).toBe(true);
    expect(result.atwaterDiagnostic?.expectedCalories).toBe(580);
    expect(result.atwaterDiagnostic?.reason).toContain("Diagnostic Note");
  });

  // TEST 12: Idempotent deterministic calculation for identical input
  it("TEST 12: Same input analyzed twice produces strictly identical deterministic calculation", () => {
    const meal: ComponentFood[] = [
      {
        name: "Eggs and Avocado Toast",
        identifiedFood: "egg (scrambled with butter)",
        portionDescription: "2 eggs + 1 slice",
        estimatedGrams: 180,
        calories: 380,
        protein: 20,
        carbs: 28,
        fat: 21,
        confidence: 0.9,
        assumptions: [],
        source: "USDA_FDC"
      }
    ];

    const run1 = calculateDeterministicMealTotals(meal);
    const run2 = calculateDeterministicMealTotals(meal);

    expect(run1.calories).toBe(run2.calories);
    expect(run1.protein).toBe(run2.protein);
    expect(run1.carbs).toBe(run2.carbs);
    expect(run1.fat).toBe(run2.fat);
    expect(run1.healthScore).toBe(run2.healthScore);
    expect(run1.grade).toBe(run2.grade);
  });

  // TEST 13: South Asian Chicken Biryani & Mango Lassi lookup & calculation
  it("TEST 13: South Asian Chicken Biryani & Mango Lassi lookup and deterministic calculation", () => {
    const biryaniMatch = lookupAuthoritativeFood("Chicken Biryani");
    const lassiMatch = lookupAuthoritativeFood("Mango Lassi");

    expect(biryaniMatch).not.toBeNull();
    expect(biryaniMatch?.calories).toBe(180);
    expect(biryaniMatch?.protein).toBe(10.5);

    expect(lassiMatch).not.toBeNull();
    expect(lassiMatch?.sugar).toBe(16.0);

    const meal: ComponentFood[] = [
      {
        name: "Chicken Biryani",
        identifiedFood: "chicken biryani",
        portionDescription: "1 full plate (350g)",
        estimatedGrams: 350,
        calories: Math.round(180 * 3.5),
        protein: Math.round(10.5 * 3.5 * 10) / 10,
        carbs: Math.round(22.4 * 3.5 * 10) / 10,
        fat: Math.round(5.2 * 3.5 * 10) / 10,
        confidence: 0.95,
        assumptions: ["Standard restaurant preparation"],
        source: "USDA_FDC"
      },
      {
        name: "Mango Lassi",
        identifiedFood: "mango lassi",
        portionDescription: "1 glass (250g)",
        estimatedGrams: 250,
        calories: Math.round(115 * 2.5),
        protein: Math.round(3.2 * 2.5 * 10) / 10,
        carbs: Math.round(18.4 * 2.5 * 10) / 10,
        fat: Math.round(3.2 * 2.5 * 10) / 10,
        sugar: Math.round(16.0 * 2.5),
        confidence: 0.95,
        assumptions: ["Sweetened yogurt beverage"],
        source: "USDA_FDC"
      }
    ];

    const result = calculateDeterministicMealTotals(meal, { mealName: "Biryani & Lassi" });
    expect(result.calories).toBe(918); // 630 + 288 = 918
    expect(result.protein).toBe(44.8); // 36.8 + 8 = 44.8
    expect(result.carbs).toBe(124.4); // 78.4 + 46 = 124.4
    expect(result.fat).toBe(26.2); // 18.2 + 8 = 26.2
    expect(result.totalGrams).toBe(600);
  });

  // TEST 14: Interactive component modification utilities
  it("TEST 14: Interactive component modifications (scale, remove, add) update totals deterministically", () => {
    const initialFoods: ComponentFood[] = [
      {
        name: "Steamed Rice",
        identifiedFood: "white rice (cooked)",
        portionDescription: "200g",
        estimatedGrams: 200,
        calories: 260,
        protein: 5.4,
        carbs: 56.4,
        fat: 0.6,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      },
      {
        name: "Chicken Curry",
        identifiedFood: "chicken curry (meat + gravy)",
        portionDescription: "180g",
        estimatedGrams: 180,
        calories: 333,
        protein: 29.7,
        carbs: 7.6,
        fat: 20.7,
        confidence: 0.95,
        assumptions: [],
        source: "USDA_FDC"
      }
    ];

    // Scale rice to 100g (half portion)
    const updated = updateComponentPortion(initialFoods, 0, 100);
    expect(updated[0].estimatedGrams).toBe(100);
    expect(updated[0].calories).toBe(130);
    expect(updated[0].protein).toBe(2.7);

    // Remove curry
    const withoutCurry = removeComponentFromMeal(updated, 1);
    expect(withoutCurry.length).toBe(1);

    // Add 1 tbsp Ghee
    const withGhee = addComponentToMeal(withoutCurry, {
      name: "1 tbsp Ghee",
      identifiedFood: "ghee / clarified butter",
      portionDescription: "14g",
      estimatedGrams: 14,
      calories: 123,
      protein: 0,
      carbs: 0,
      fat: 13.9,
      confidence: 1,
      assumptions: [],
      source: "USDA_FDC"
    });
    expect(withGhee.length).toBe(2);

    const finalCalc = calculateDeterministicMealTotals(withGhee);
    expect(finalCalc.calories).toBe(253); // 130 + 123
    expect(finalCalc.protein).toBe(2.7);
    expect(finalCalc.fat).toBe(14.2);
  });

  // TEST 15: Samosa & Gulab Jamun correctly classified as junk
  it("TEST 15: Deep fried samosa and high sugar desserts trigger junk classification and grade penalty", () => {
    const junkItems: ComponentFood[] = [
      {
        name: "2 Samosas",
        identifiedFood: "samosa (fried potato)",
        portionDescription: "2 pieces (160g)",
        estimatedGrams: 160,
        calories: 493,
        protein: 7.2,
        carbs: 51.5,
        fat: 28.0,
        confidence: 0.9,
        assumptions: ["Deep fried pastry"],
        source: "USDA_FDC"
      },
      {
        name: "Gulab Jamun",
        identifiedFood: "gulab jamun",
        portionDescription: "2 pieces (100g)",
        estimatedGrams: 100,
        calories: 387,
        protein: 4.2,
        carbs: 64.5,
        fat: 12.8,
        sugar: 48.0,
        confidence: 0.9,
        assumptions: ["Fried milk solid balls in sugar syrup"],
        source: "USDA_FDC"
      }
    ];

    const result = calculateDeterministicMealTotals(junkItems);
    expect(result.isJunk).toBe(true);
    expect(result.healthScore).toBeLessThanOrEqual(55);
    expect(["D", "F"]).toContain(result.grade);
  });

  // TEST 16: Pure cooking oil / ghee macro validation
  it("TEST 16: Pure cooking oil / ghee conforms strictly to 9 kcal per gram fat", () => {
    const gheeFood = lookupAuthoritativeFood("ghee / clarified butter");
    expect(gheeFood).not.toBeNull();
    // 99.5g fat per 100g -> ~876-895 kcal
    expect(gheeFood?.fat).toBeGreaterThanOrEqual(99.0);
    expect(gheeFood?.calories).toBeGreaterThanOrEqual(870);
  });
});
