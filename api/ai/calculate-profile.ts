import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Type } from '@google/genai';
import { authenticateRequest, AuthenticatedVercelRequest } from '../_lib/auth';
import { getAI, callGeminiWithFailover, cleanErrorMessage } from '../_lib/gemini';

export default async function handler(req: AuthenticatedVercelRequest, res: VercelResponse) {
  const isAuth = await authenticateRequest(req, res);
  if (!isAuth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { heightCm, weightKg, desiredWeightKg, goal, age, gender, activityLevel, dietaryStyle, favoriteCuisines, allergiesOrDislikes } = req.body || {};
    if (!heightCm || !weightKg || !desiredWeightKg) {
      return res.status(400).json({ error: 'Missing required profile parameters' });
    }

    const ai = getAI();
    const prompt = `You are a world-class sports scientist, dietitian, and metabolic nutritionist.
A user has provided the following personalized attributes:
- Height: ${heightCm} cm
- Current Weight: ${weightKg} kg
- Desired Target Weight: ${desiredWeightKg} kg
- Fitness Goal: ${goal || 'Weight Loss'}
- Age: ${age || 28}
- Gender: ${gender || 'unspecified'}
- Activity Level: ${activityLevel || 'moderately_active'}
- Dietary Style: ${dietaryStyle || 'Standard Balanced'}
- Favorite Cuisines: ${(favoriteCuisines || []).join(', ') || 'Varied / Global Whole Foods'}
- Allergies / Avoided Foods: ${(allergiesOrDislikes || []).join(', ') || 'None'}

Calculate scientifically using Mifflin-St Jeor / Katch-McArdle:
1. Exact daily caloric requirement tailored for their rate of progress (deficit, surplus, or maintenance).
2. Grams of Protein (aim for 1.6-2.2g per kg for muscle retention/growth, or appropriate for dietary style).
3. Grams of Carbohydrates aligned with their dietary style.
4. Grams of Healthy Fats.
5. Recommended max % of calories from junk/processed food (e.g. 5-15% for sustainable balance).
6. Daily hydration goal in standard glasses (~250ml each).
7. A concise 2-sentence explanation of why these exact targets optimize their health and goal.

Return strictly valid JSON:
{
  "targetCalories": number,
  "maxJunkCaloriePercent": number,
  "targetProtein": number,
  "targetCarbs": number,
  "targetFat": number,
  "waterGoal": number,
  "explanation": string
}`;

    const response = await callGeminiWithFailover(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetCalories: { type: Type.NUMBER },
            maxJunkCaloriePercent: { type: Type.NUMBER },
            targetProtein: { type: Type.NUMBER },
            targetCarbs: { type: Type.NUMBER },
            targetFat: { type: Type.NUMBER },
            waterGoal: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
          },
          required: [
            'targetCalories',
            'maxJunkCaloriePercent',
            'targetProtein',
            'targetCarbs',
            'targetFat',
            'waterGoal',
            'explanation'
          ],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.warn('AI Profile calculation notice:', cleanErrorMessage(err));
    // Exact Mifflin-St Jeor formula calculation fallback
    const h = Number(req.body?.heightCm) || 175;
    const w = Number(req.body?.weightKg) || 75;
    const dw = Number(req.body?.desiredWeightKg) || 70;
    const a = Number(req.body?.age) || 28;
    const g = req.body?.gender || 'male';
    const goalStr = (req.body?.goal || 'Weight Loss').toLowerCase();

    // BMR
    const bmr = 10 * w + 6.25 * h - 5 * a + (g === 'female' ? -161 : 5);
    const tdee = bmr * 1.45; // Moderately active default

    let targetCal = Math.round(tdee);
    if (goalStr.includes('loss') || dw < w) {
      targetCal = Math.round(tdee - 450);
    } else if (goalStr.includes('muscle') || goalStr.includes('bulk') || dw > w) {
      targetCal = Math.round(tdee + 300);
    }

    const protein = Math.round(w * 2.0);
    const fat = Math.round((targetCal * 0.25) / 9);
    const carbs = Math.max(50, Math.round((targetCal - (protein * 4 + fat * 9)) / 4));

    return res.json({
      success: true,
      data: {
        targetCalories: targetCal,
        maxJunkCaloriePercent: 12,
        targetProtein: protein,
        targetCarbs: carbs,
        targetFat: fat,
        waterGoal: 8,
        explanation: 'Calculated via Mifflin-St Jeor energy expenditure formula tailored to your body weight and metabolic target.'
      }
    });
  }
}
