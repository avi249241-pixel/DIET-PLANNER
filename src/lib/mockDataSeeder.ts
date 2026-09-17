import { db } from './firebase';
import { collection, writeBatch, doc, setDoc } from 'firebase/firestore';

export async function seedTestData(userId: string) {
  if (!userId) return { success: false, error: 'User ID is required' };

  try {
    const batch = writeBatch(db);

    // Calculate dates for the past 7 days up to today
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const today = dates[dates.length - 1];

    // 1. Predefined realistic meals and junk treats with accurate nutritional values
    const trainingDataset = [
      // Day -6
      {
        dateIndex: 0,
        mealType: 'Breakfast',
        name: 'Avocado Toast with 2 Poached Eggs & Chia Seeds',
        portion: '2 slices sourdough + 2 eggs',
        calories: 420,
        protein: 22,
        carbs: 38,
        fat: 19,
        sugar: 2,
        sodium: 380,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 95,
        verdict: 'Excellent balance of complex carbs, monounsaturated fats, and bioavailable protein.'
      },
      {
        dateIndex: 0,
        mealType: 'Lunch',
        name: 'Grilled Salmon Bowl with Quinoa & Steamed Asparagus',
        portion: '1 bowl (180g salmon)',
        calories: 550,
        protein: 44,
        carbs: 42,
        fat: 21,
        sugar: 3,
        sodium: 420,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 98,
        verdict: 'Rich in Omega-3 EPA/DHA fatty acids and complete essential amino acids.'
      },
      {
        dateIndex: 0,
        mealType: 'Snack',
        name: 'Salted Caramel Doughnut',
        portion: '1 glazed doughnut (85g)',
        calories: 340,
        protein: 4,
        carbs: 48,
        fat: 16,
        sugar: 28,
        sodium: 310,
        isJunk: true,
        category: 'junk',
        grade: 'F',
        healthScore: 22,
        verdict: 'High refined sugar and palm oil without dietary fiber or micronutrients.',
        swapSuggestion: 'Try a baked apple cinnamon protein muffin or Greek yogurt with honey.'
      },
      {
        dateIndex: 0,
        mealType: 'Dinner',
        name: 'Lean Beef Sirloin Steak with Roasted Sweet Potato',
        portion: '200g sirloin + 1 sweet potato',
        calories: 580,
        protein: 50,
        carbs: 45,
        fat: 20,
        sugar: 6,
        sodium: 490,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 92,
        verdict: 'High heme-iron and high-density protein for lean muscle recovery.'
      },

      // Day -5
      {
        dateIndex: 1,
        mealType: 'Breakfast',
        name: 'Greek Yogurt Parfait with Blueberries & Almonds',
        portion: '250g 0% Greek yogurt + 1/2 cup berries',
        calories: 310,
        protein: 28,
        carbs: 26,
        fat: 9,
        sugar: 14,
        sodium: 95,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 96,
        verdict: 'High prebiotic fiber and slow-digesting casein protein.'
      },
      {
        dateIndex: 1,
        mealType: 'Lunch',
        name: 'Crispy Double Bacon Cheeseburger & Medium French Fries',
        portion: '1 burger + 115g fries',
        calories: 960,
        protein: 34,
        carbs: 86,
        fat: 52,
        sugar: 12,
        sodium: 1480,
        isJunk: true,
        category: 'junk',
        grade: 'D',
        healthScore: 35,
        verdict: 'Heavy sodium load and industrial seed oils; high saturated fat density.',
        swapSuggestion: 'Opt for a grilled chicken wrap with sweet potato fries or side garden salad.'
      },
      {
        dateIndex: 1,
        mealType: 'Dinner',
        name: 'Lemon Herb Grilled Chicken Breast & Brown Rice Pilaf',
        portion: '220g chicken breast + 1 cup rice',
        calories: 490,
        protein: 52,
        carbs: 48,
        fat: 8,
        sugar: 1,
        sodium: 380,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 94,
        verdict: 'Clean high-protein meal with slow-release whole grain carbohydrates.'
      },

      // Day -4
      {
        dateIndex: 2,
        mealType: 'Breakfast',
        name: 'Protein Oatmeal with Peanut Butter & Banana',
        portion: '1 cup rolled oats + 1 scoop whey + 1 banana',
        calories: 480,
        protein: 36,
        carbs: 62,
        fat: 12,
        sugar: 15,
        sodium: 140,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 92,
        verdict: 'Beta-glucan soluble fiber with sustained pre-workout energy delivery.'
      },
      {
        dateIndex: 2,
        mealType: 'Lunch',
        name: 'Mediterranean Tuna & Chickpea Salad with Olive Oil',
        portion: '1 large bowl',
        calories: 440,
        protein: 38,
        carbs: 34,
        fat: 16,
        sugar: 4,
        sodium: 460,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 96,
        verdict: 'Heart-healthy polyphenol fats and rich legume plant fibers.'
      },
      {
        dateIndex: 2,
        mealType: 'Dinner',
        name: 'Turkey Bolognese with High-Protein Edamame Pasta',
        portion: '1 serving (350g)',
        calories: 520,
        protein: 48,
        carbs: 42,
        fat: 14,
        sugar: 7,
        sodium: 520,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 94,
        verdict: 'High-volume meal with high satiety index.'
      },

      // Day -3
      {
        dateIndex: 3,
        mealType: 'Breakfast',
        name: 'Scrambled Eggs with Spinach & Smoked Salmon',
        portion: '3 eggs + 60g smoked salmon',
        calories: 360,
        protein: 32,
        carbs: 4,
        fat: 24,
        sugar: 1,
        sodium: 580,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 93,
        verdict: 'Ketogenic/low-carb high choline breakfast supporting cognitive function.'
      },
      {
        dateIndex: 3,
        mealType: 'Lunch',
        name: 'Chicken Burrito Bowl with Black Beans, Salsa & Guacamole',
        portion: '1 bowl',
        calories: 620,
        protein: 45,
        carbs: 64,
        fat: 20,
        sugar: 5,
        sodium: 820,
        isJunk: false,
        category: 'healthy',
        grade: 'B',
        healthScore: 84,
        verdict: 'Well-balanced macronutrients, slight caution on restaurant sodium.'
      },
      {
        dateIndex: 3,
        mealType: 'Snack',
        name: 'Milk Chocolate Bar with Caramel (King Size)',
        portion: '85g bar',
        calories: 440,
        protein: 5,
        carbs: 56,
        fat: 22,
        sugar: 48,
        sodium: 180,
        isJunk: true,
        category: 'junk',
        grade: 'F',
        healthScore: 18,
        verdict: 'Heavy added sugar spike trigger causing rapid insulin surge.',
        swapSuggestion: 'Choose 85%+ dark chocolate squares with a handful of raw walnuts.'
      },
      {
        dateIndex: 3,
        mealType: 'Dinner',
        name: 'Tofu & Mixed Veggie Green Curry with Jasmine Rice',
        portion: '1 medium bowl',
        calories: 460,
        protein: 20,
        carbs: 52,
        fat: 18,
        sugar: 6,
        sodium: 610,
        isJunk: false,
        category: 'healthy',
        grade: 'B',
        healthScore: 88,
        verdict: 'Antioxidant curcumin and rich phytonutrient vegetables.'
      },

      // Day -2
      {
        dateIndex: 4,
        mealType: 'Breakfast',
        name: 'Vanilla Whey Protein Shake with Frozen Berries & Almond Butter',
        portion: '400ml smoothie',
        calories: 340,
        protein: 35,
        carbs: 24,
        fat: 10,
        sugar: 12,
        sodium: 160,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 97,
        verdict: 'Rapid leucine absorption for muscle protein synthesis.'
      },
      {
        dateIndex: 4,
        mealType: 'Lunch',
        name: 'Pepperoni & Cheese Stuffed Crust Pizza (3 Slices)',
        portion: '3 slices (320g)',
        calories: 890,
        protein: 32,
        carbs: 94,
        fat: 42,
        sugar: 9,
        sodium: 1680,
        isJunk: true,
        category: 'junk',
        grade: 'F',
        healthScore: 28,
        verdict: 'Exceeds recommended single-meal saturated fat and daily sodium limit.',
        swapSuggestion: 'Try homemade flatbread pizza with low-fat mozzarella, chicken, and arugula.'
      },
      {
        dateIndex: 4,
        mealType: 'Dinner',
        name: 'Grilled White Fish (Cod) with Steamed Broccoli & Herb Rice',
        portion: '200g cod + 150g broccoli',
        calories: 380,
        protein: 42,
        carbs: 38,
        fat: 5,
        sugar: 2,
        sodium: 320,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 99,
        verdict: 'Extremely lean protein source packed with iodine and sulforaphane.'
      },

      // Day -1 (Yesterday)
      {
        dateIndex: 5,
        mealType: 'Breakfast',
        name: 'Eggs Florentine with Whole Wheat English Muffin',
        portion: '2 eggs + 1 muffin + spinach',
        calories: 390,
        protein: 24,
        carbs: 30,
        fat: 18,
        sugar: 2,
        sodium: 440,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 91,
        verdict: 'Balanced breakfast with high lutein and zeaxanthin for vision health.'
      },
      {
        dateIndex: 5,
        mealType: 'Lunch',
        name: 'Grilled Turkey & Avocado Club Wrap with Side Salad',
        portion: '1 whole wrap',
        calories: 480,
        protein: 38,
        carbs: 40,
        fat: 18,
        sugar: 4,
        sodium: 620,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 90,
        verdict: 'Good lean-to-fat balance with dietary fiber.'
      },
      {
        dateIndex: 5,
        mealType: 'Dinner',
        name: 'Pan-Seared Ribeye Steak with Roasted Asparagus & Garlic Butter',
        portion: '220g steak + asparagus',
        calories: 640,
        protein: 48,
        carbs: 8,
        fat: 46,
        sugar: 2,
        sodium: 510,
        isJunk: false,
        category: 'healthy',
        grade: 'B',
        healthScore: 82,
        verdict: 'High-density carnivore fuel; balanced with green vegetables.'
      },

      // Day 0 (TODAY)
      {
        dateIndex: 6,
        mealType: 'Breakfast',
        name: 'Superfood Power Oats: Chia, Flax, Whey Protein & Fresh Berries',
        portion: '1 large bowl (80g oats, 30g protein)',
        calories: 450,
        protein: 35,
        carbs: 56,
        fat: 9,
        sugar: 11,
        sodium: 120,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 98,
        verdict: 'Peak fuel with sustained glycemic response and fiber.'
      },
      {
        dateIndex: 6,
        mealType: 'Lunch',
        name: 'Flame-Grilled Chicken Breast, Jasmine Rice & Steamed Broccoli',
        portion: '200g chicken, 1 cup rice, 100g broccoli',
        calories: 520,
        protein: 48,
        carbs: 54,
        fat: 8,
        sugar: 2,
        sodium: 360,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 97,
        verdict: 'Gold standard athletic fuel for lean muscle maintenance and clean energy.'
      },
      {
        dateIndex: 6,
        mealType: 'Snack',
        name: 'Iced Matcha Green Tea Latte with Oat Milk',
        portion: '1 grande (16oz)',
        calories: 140,
        protein: 3,
        carbs: 18,
        fat: 6,
        sugar: 8,
        sodium: 90,
        isJunk: false,
        category: 'healthy',
        grade: 'A',
        healthScore: 92,
        verdict: 'High L-theanine and EGCG catechins for calm sustained focus.'
      }
    ];

    // Write all food logs to Firestore
    const foodLogsCol = collection(db, 'users', userId, 'foodLogs');
    const now = Date.now();

    // Ensure user profile document exists with valid default data if missing
    const userDocRef = doc(db, 'users', userId);
    batch.set(userDocRef, {
      heightCm: 178,
      weightKg: 78,
      desiredWeightKg: 74,
      targetCalories: 2200,
      maxJunkCaloriePercent: 20,
      targetProtein: 165,
      targetCarbs: 220,
      targetFat: 65,
      waterGoal: 8,
      goal: 'Lean Muscle & Fat Loss',
      dietaryStyle: 'High-Protein Athlete',
      cuisines: ['Mediterranean', 'Mexican', 'Asian'],
      allergies: [],
      autoSuggestNextMeal: true,
      smartMacroBalancing: true,
      autoSyncGroceries: true,
      updatedAt: now
    }, { merge: true });

    for (let i = 0; i < trainingDataset.length; i++) {
      const item = trainingDataset[i];
      const itemDate = dates[item.dateIndex];
      const logDocRef = doc(foodLogsCol);
      
      const docData = {
        id: logDocRef.id,
        userId,
        name: item.name,
        portion: item.portion,
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
        sugar: Number(item.sugar) || 0,
        sodium: Number(item.sodium) || 0,
        isJunk: Boolean(item.isJunk),
        category: item.category,
        grade: item.grade,
        healthScore: Number(item.healthScore) || 90,
        mealType: item.mealType,
        date: itemDate,
        verdict: item.verdict,
        swapSuggestion: item.swapSuggestion || '',
        createdAt: now - (6 - item.dateIndex) * 86400000 + i * 3600000
      };

      batch.set(logDocRef, docData);
    }

    // 2. Populate Daily Hydration Stats for all 7 days
    const dailyWaterLevels = [7, 8, 9, 6, 8, 9, 7];
    for (let d = 0; d < dates.length; d++) {
      const statsDocRef = doc(db, 'users', userId, 'dailyStats', dates[d]);
      batch.set(statsDocRef, {
        waterGlasses: dailyWaterLevels[d],
        updatedAt: now - (6 - d) * 86400000
      });
    }

    // 3. Prepopulate Smart Recipes in RecipeBuilder
    const recipesCol = collection(db, 'users', userId, 'recipes');
    const sampleRecipes = [
      {
        name: 'High-Protein Mediterranean Power Bowl',
        servings: 2,
        caloriesPerServing: 460,
        proteinPerServing: 42,
        carbsPerServing: 38,
        fatPerServing: 14,
        healthScore: 96,
        isJunk: false,
        grade: 'A',
        instructions: '1. Grill marinated chicken breast with oregano and lemon.\n2. Layer fluffy quinoa, cucumbers, kalamata olives, cherry tomatoes, and diced chicken.\n3. Top with 1 tbsp tzatziki and extra virgin olive oil.',
        ingredients: [
          { name: 'Chicken Breast', amount: '300g', calories: 330, protein: 66, carbs: 0, fat: 6 },
          { name: 'Cooked Quinoa', amount: '1.5 cups', calories: 330, protein: 12, carbs: 60, fat: 5 },
          { name: 'Cherry Tomatoes & Cucumber', amount: '150g', calories: 40, protein: 2, carbs: 8, fat: 0 },
          { name: 'Kalamata Olives & Tzatziki', amount: '2 tbsp', calories: 90, protein: 2, carbs: 4, fat: 7 }
        ],
        createdAt: now - 3 * 86400000
      },
      {
        name: 'Clean Chocolate Peanut Butter Protein Fluff',
        servings: 1,
        caloriesPerServing: 280,
        proteinPerServing: 36,
        carbsPerServing: 18,
        fatPerServing: 6,
        healthScore: 94,
        isJunk: false,
        grade: 'A',
        instructions: '1. In a food processor, blend 1 cup frozen strawberries with chocolate whey and powdered peanut butter.\n2. Add 50ml unsweetened almond milk until thick and creamy like soft serve.',
        ingredients: [
          { name: 'Chocolate Whey Isolate', amount: '1 scoop (35g)', calories: 130, protein: 30, carbs: 2, fat: 1 },
          { name: 'PB2 Powdered Peanut Butter', amount: '2 tbsp (16g)', calories: 60, protein: 6, carbs: 5, fat: 1.5 },
          { name: 'Frozen Strawberries & Almond Milk', amount: '150g', calories: 60, protein: 1, carbs: 12, fat: 1 }
        ],
        createdAt: now - 2 * 86400000
      }
    ];

    for (const rec of sampleRecipes) {
      const recDocRef = doc(recipesCol);
      batch.set(recDocRef, { ...rec, id: recDocRef.id, userId });
    }

    // 4. Prepopulate Grocery List in SmartGroceryList
    const groceryCol = collection(db, 'users', userId, 'groceryList');
    const sampleGroceries = [
      { name: 'Organic Chicken Breasts (1kg)', category: 'Protein & Meat', checked: false, completed: false, quantity: '1 pack' },
      { name: 'Pasture-Raised Eggs (Dozen)', category: 'Dairy & Eggs', checked: true, completed: true, quantity: '1 carton' },
      { name: 'Fresh Baby Spinach & Broccoli', category: 'Produce', checked: false, completed: false, quantity: '2 bags' },
      { name: 'Organic Blueberries & Hass Avocados', category: 'Produce', checked: false, completed: false, quantity: '3 items' },
      { name: 'Rolled Oats & Organic Quinoa', category: 'Pantry Staples', checked: true, completed: true, quantity: '1 kg' },
      { name: '0% Fat Plain Greek Yogurt', category: 'Dairy & Eggs', checked: false, completed: false, quantity: '2 tubs' }
    ];

    for (const gro of sampleGroceries) {
      const groDocRef = doc(groceryCol);
      batch.set(groDocRef, { ...gro, id: groDocRef.id, userId, createdAt: now });
    }

    // Commit the entire atomic batch to Firestore
    await batch.commit();

    return {
      success: true,
      logsCount: trainingDataset.length,
      daysSpanned: 7
    };
  } catch (error: any) {
    console.error('Error seeding test training data:', error);
    return {
      success: false,
      error: error.message || 'Failed to seed training dataset'
    };
  }
}
