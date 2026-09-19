import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Type } from '@google/genai';
import { authenticateRequest, AuthenticatedVercelRequest } from '../_lib/auth.js';
import { getAI, callGeminiWithFailover, cleanErrorMessage } from '../_lib/gemini.js';

export default async function handler(req: AuthenticatedVercelRequest, res: VercelResponse) {
  const isAuth = await authenticateRequest(req, res);
  if (!isAuth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { logs, dailyStats } = req.body || {};
    const ai = getAI();

    const logSummary = (logs || [])
      .map((l: any) => `${l.name} (${l.mealType}, ${l.calories}kcal${l.isJunk ? ', JUNK' : ', HEALTHY'})`)
      .join('; ');
    const water = dailyStats?.waterGlasses || 0;

    const prompt = `You are an expert sports nutritionist and AI coach.
A user has logged the following food today: ${logSummary || 'No food logged yet'}
They have also drank ${water} glasses of water today.

Analyze their eating and hydration habits for today. Provide a short, actionable, and encouraging insight (max 2 sentences).
Also determine if this is a warning (e.g. too much junk, missing meals, or very low water).

Return ONLY a valid JSON object with:
- "text": (string) The insight message
- "isWarning": (boolean) Whether it's a warning`;

    const response = await callGeminiWithFailover(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            isWarning: { type: Type.BOOLEAN },
          },
          required: ['text', 'isWarning'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.warn('AI Habit Analysis notice:', cleanErrorMessage(err));
    const water = req.body?.dailyStats?.waterGlasses || 0;
    const logs = req.body?.logs || [];
    const junk = logs.filter((l: any) => l.isJunk).length;

    let msg = 'Great consistency logging your nutrition today! Keep hydration on pace.';
    let isWarn = false;

    if (water < 4) {
      msg = 'You are currently below your daily hydration target. Drink a large glass of water now.';
      isWarn = true;
    } else if (junk >= 2) {
      msg = "You've reached your treat allowance for today. Focus on clean protein and greens for your next meal.";
      isWarn = true;
    }

    return res.json({ success: true, data: { text: msg, isWarning: isWarn } });
  }
}
