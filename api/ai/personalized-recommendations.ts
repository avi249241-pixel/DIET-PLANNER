import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, AuthenticatedVercelRequest } from '../_lib/auth.js';
import { getAI, callGeminiWithFailover, cleanErrorMessage } from '../_lib/gemini.js';

export default async function handler(req: AuthenticatedVercelRequest, res: VercelResponse) {
  const isAuth = await authenticateRequest(req, res);
  if (!isAuth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { profile, todayLogs, currentHour } = req.body || {};
  const hour = typeof currentHour === 'number' ? currentHour : new Date().getHours();
  let currentSlot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' = 'Lunch';
  if (hour >= 5 && hour < 11) currentSlot = 'Breakfast';
  else if (hour >= 11 && hour < 15) currentSlot = 'Lunch';
  else if (hour >= 15 && hour < 18) currentSlot = 'Snack';
  else currentSlot = 'Dinner';

  const consumedCalories = (todayLogs || []).reduce((acc: number, l: any) => acc + (l.calories || 0), 0);
  const consumedProtein = (todayLogs || []).reduce((acc: number, l: any) => acc + (l.protein || 0), 0);
  const consumedCarbs = (todayLogs || []).reduce((acc: number, l: any) => acc + (l.carbs || 0), 0);
  const consumedFat = (todayLogs || []).reduce((acc: number, l: any) => acc + (l.fat || 0), 0);

  const targetCalories = profile?.targetCalories || 2000;
  const targetProtein = profile?.targetProtein || 140;
  const targetCarbs = profile?.targetCarbs || 200;
  const targetFat = profile?.targetFat || 60;

  const remainingCalories = Math.max(150, targetCalories - consumedCalories);
  const remainingProtein = Math.max(15, targetProtein - consumedProtein);
  const remainingCarbs = Math.max(20, targetCarbs - consumedCarbs);
  const remainingFat = Math.max(5, targetFat - consumedFat);

  const buildFallbackRecommendations = () => {
    const targetPerMealCal = Math.min(remainingCalories, currentSlot === 'Snack' ? 280 : Math.round(remainingCalories * 0.65) || 500);
    const targetPerMealProtein = Math.min(remainingProtein, currentSlot === 'Snack' ? 20 : 38);
    const targetPerMealCarbs = Math.min(remainingCarbs, currentSlot === 'Snack' ? 25 : 45);
    const targetPerMealFat = Math.min(remainingFat, currentSlot === 'Snack' ? 8 : 14);

    let options = [];
    if (currentSlot === 'Breakfast') {
      options = [
        {
          name: 'High-Protein Superfood Oatmeal Bowl',
          type: 'Quick 5-Min Fuel',
          mealType: 'Breakfast',
          calories: Math.min(targetPerMealCal, 420),
          protein: Math.min(targetPerMealProtein, 32),
          carbs: Math.min(targetPerMealCarbs, 48),
          fat: 10,
          sugar: 8,
          sodium: 120,
          healthScore: 97,
          grade: 'A',
          isJunk: false,
          prepTime: '5 mins',
          ingredients: ['1 cup rolled oats', '1 scoop vanilla whey protein', '1/2 cup fresh berries', '1 tbsp chia seeds'],
          quickRecipe: 'Microwave oats in water/almond milk for 90 sec, stir in whey protein and top with berries.',
          matchReason: 'Provides sustained pre-workout energy with slow-release fiber and high bioavailable protein.'
        },
        {
          name: 'Avocado & Smoked Salmon Sourdough',
          type: "High-Protein Chef's Pick",
          mealType: 'Breakfast',
          calories: Math.min(targetPerMealCal, 460),
          protein: Math.min(targetPerMealProtein, 34),
          carbs: Math.min(targetPerMealCarbs, 38),
          fat: 16,
          sugar: 2,
          sodium: 480,
          healthScore: 95,
          grade: 'A',
          isJunk: false,
          prepTime: '8 mins',
          ingredients: ['2 slices toasted sourdough', '1/2 mashed avocado', '80g smoked salmon', '2 poached eggs'],
          quickRecipe: 'Toast sourdough, layer avocado spread, wild smoked salmon, and soft poached eggs.',
          matchReason: 'Rich in Omega-3 EPA/DHA fatty acids and high choline for sustained focus.'
        }
      ];
    } else if (currentSlot === 'Lunch' || currentSlot === 'Dinner') {
      options = [
        {
          name: 'Flame-Grilled Chicken Breast, Quinoa & Steamed Broccoli',
          type: 'Quick 5-Min Fuel',
          mealType: currentSlot,
          calories: targetPerMealCal,
          protein: targetPerMealProtein,
          carbs: targetPerMealCarbs,
          fat: targetPerMealFat,
          sugar: 3,
          sodium: 380,
          healthScore: 98,
          grade: 'A',
          isJunk: false,
          prepTime: '12 mins',
          ingredients: ['200g lean chicken breast', '1 cup cooked quinoa', '150g broccoli florets', '1 tbsp olive oil & lemon'],
          quickRecipe: 'Pan-sear seasoned chicken with lemon and garlic; serve alongside fluffy quinoa and steamed greens.',
          matchReason: 'Optimal athletic fuel targeting your remaining macro budget with clean, lean proteins.'
        },
        {
          name: 'Pan-Seared Salmon Fillet with Roasted Sweet Potato',
          type: "High-Protein Chef's Pick",
          mealType: currentSlot,
          calories: Math.round(targetPerMealCal * 1.05),
          protein: targetPerMealProtein,
          carbs: targetPerMealCarbs,
          fat: targetPerMealFat + 4,
          sugar: 5,
          sodium: 410,
          healthScore: 96,
          grade: 'A',
          isJunk: false,
          prepTime: '18 mins',
          ingredients: ['180g wild salmon fillet', '1 medium baked sweet potato', 'Asparagus spears', 'Dill & olive oil'],
          quickRecipe: 'Sear salmon skin-side down for 5 mins, flip and baste with herb olive oil. Serve with roasted sweet potato.',
          matchReason: 'Anti-inflammatory nutrient powerhouse with complex carbohydrates.'
        }
      ];
    } else {
      options = [
        {
          name: 'Chocolate Peanut Butter Whey Isolate Shake',
          type: 'Quick 5-Min Fuel',
          mealType: 'Snack',
          calories: 260,
          protein: 32,
          carbs: 14,
          fat: 6,
          sugar: 2,
          sodium: 180,
          healthScore: 96,
          grade: 'A',
          isJunk: false,
          prepTime: '2 mins',
          ingredients: ['1 scoop chocolate whey', '1 tbsp PB2 powdered peanut butter', '300ml unsweetened almond milk', 'Ice'],
          quickRecipe: 'Shake or blend vigorously for 30 seconds.',
          matchReason: 'Rapid amino acid delivery with minimal carbohydrate impact.'
        }
      ];
    }

    return {
      currentSlot,
      remainingCalories,
      remainingProtein,
      remainingCarbs,
      remainingFat,
      coachInsight: `You have ${remainingCalories} kcal and ${remainingProtein}g protein remaining today. Pacing is solid.`,
      proactiveTip: `Prioritize clean whole foods with 30g+ protein in your upcoming ${currentSlot} slot.`,
      urgencyLevel: remainingCalories < 400 ? 'action_needed' : 'optimal',
      recommendations: options
    };
  };

  try {
    const ai = getAI();
    const prompt = `You are an automated real-time nutrition intelligence engine.
Analyze the user's live daily status:
- Goal: ${profile?.goal || 'Weight Loss'}
- Dietary Style: ${profile?.dietaryStyle || 'Standard Balanced'}
- Favorite Cuisines: ${(profile?.favoriteCuisines || []).join(', ') || 'Whole foods, Mediterranean, Asian, American'}
- Food Allergies / Dislikes to strictly exclude: ${(profile?.allergiesOrDislikes || []).join(', ') || 'None'}
- Current Time Slot: ${currentSlot} (Hour ${hour}:00)
- Remaining Targets Today: ${remainingCalories} kcal, ${remainingProtein}g Protein, ${remainingCarbs}g Carbs, ${remainingFat}g Fat
- Already Logged Today: ${(todayLogs || []).map((l: any) => `${l.name} (${l.calories}kcal, ${l.protein}g P)`).join(', ') || 'Nothing logged yet today'}

Tasks:
1. Provide a direct, punchy 1-2 sentence real-time coach insight assessing their pace.
2. Provide a 1-sentence proactive micro-tip (e.g. hydration, timing, or satiety).
3. Determine urgency level: 'optimal' | 'moderate' | 'action_needed'
4. Generate 3 DISTINCT, hyper-personalized, delicious meal/snack options tailored to their remaining calorie/macro budget and favorite cuisines:
   Option 1: "Quick 5-Min Fuel" (super fast whole food)
   Option 2: "High-Protein Chef's Pick" (flavorful home-cooked recipe)
   Option 3: "Smart Dining/Takeout Option" (what to order at a clean restaurant/cafe)

Each meal option MUST have complete realistic macros, grade A, healthScore > 85, isJunk: false, ingredients list, and a 1-sentence quick prep or ordering instructions.

Return strictly valid JSON:
{
  "currentSlot": "${currentSlot}",
  "remainingCalories": ${remainingCalories},
  "remainingProtein": ${remainingProtein},
  "remainingCarbs": ${remainingCarbs},
  "remainingFat": ${remainingFat},
  "coachInsight": string,
  "proactiveTip": string,
  "urgencyLevel": "optimal" | "moderate" | "action_needed",
  "recommendations": [
    {
      "name": string,
      "type": "Quick 5-Min Fuel" | "High-Protein Chef's Pick" | "Smart Dining/Takeout Option",
      "mealType": "${currentSlot}",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sugar": number,
      "sodium": number,
      "healthScore": number,
      "grade": "A",
      "isJunk": false,
      "prepTime": string,
      "ingredients": string[],
      "quickRecipe": string,
      "matchReason": string
    }
  ]
}`;

    const response = await callGeminiWithFailover(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.warn('Personalized recommendations using resilient fallback:', cleanErrorMessage(err));
    const fallback = buildFallbackRecommendations();
    return res.json({ success: true, data: fallback, note: cleanErrorMessage(err) });
  }
}
