import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, AuthenticatedVercelRequest } from '../../_lib/auth.js';
import { getAI, callGeminiWithFailover, cleanErrorMessage } from '../../_lib/gemini.js';

export default async function handler(req: AuthenticatedVercelRequest, res: VercelResponse) {
  const isAuth = await authenticateRequest(req, res);
  if (!isAuth) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const codeParam = req.query.code;
  const code = (Array.isArray(codeParam) ? codeParam[0] : codeParam)?.trim();

  if (!code) {
    return res.status(400).json({ success: false, error: 'Barcode is required' });
  }

  try {
    // Query Open Food Facts public REST API
    const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (offResponse.ok) {
      const offData = await offResponse.json();
      if (offData.status === 1 && offData.product) {
        const p = offData.product;
        const nutriments = p.nutriments || {};
        const name = p.product_name || p.generic_name || 'Scanned Barcode Food';
        const servingSize = p.serving_size || '100g standard serving';

        const calories = Math.round(
          nutriments['energy-kcal_serving'] ||
          nutriments['energy-kcal_100g'] ||
          nutriments['energy-kcal'] ||
          (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0)
        );
        const protein = Math.round((nutriments.proteins_serving || nutriments.proteins_100g || nutriments.proteins || 0) * 10) / 10;
        const carbs = Math.round((nutriments.carbohydrates_serving || nutriments.carbohydrates_100g || nutriments.carbohydrates || 0) * 10) / 10;
        const fat = Math.round((nutriments.fat_serving || nutriments.fat_100g || nutriments.fat || 0) * 10) / 10;
        const sugar = Math.round((nutriments.sugars_serving || nutriments.sugars_100g || nutriments.sugars || 0) * 10) / 10;
        const sodium = Math.round((nutriments.sodium_serving || nutriments.sodium_100g || nutriments.sodium || 0) * 1000);

        const nutriScoreGrade = (p.nutriscore_grade || '').toUpperCase();
        const novaGroup = p.nova_group;
        const isJunk = novaGroup === 4 || ['D', 'E'].includes(nutriScoreGrade) || sugar > 18 || (fat > 20 && protein < 5);
        const grade = ['A', 'B', 'C', 'D', 'E'].includes(nutriScoreGrade)
          ? nutriScoreGrade === 'E' ? 'F' : nutriScoreGrade
          : isJunk ? 'D' : 'B';
        const healthScore = grade === 'A' ? 95 : grade === 'B' ? 80 : grade === 'C' ? 60 : grade === 'D' ? 40 : 20;

        return res.json({
          success: true,
          data: {
            name,
            portion: servingSize,
            calories: calories || 150,
            protein,
            carbs,
            fat,
            sugar,
            sodium,
            category: isJunk ? 'junk' : 'healthy',
            isJunk,
            healthScore,
            grade,
            swapSuggestion: isJunk ? 'Try an unprocessed whole-food snack like raw nuts or fruit.' : 'Great nutrient-dense choice!',
            verdict: `Scanned from Open Food Facts (${p.brands || 'Packaged Product'}). Nova Group: ${novaGroup || 'N/A'}.`,
            barcode: code,
            nutritionSource: 'BARCODE',
            confidence: 0.98,
            imageUrl: p.image_front_url || p.image_url
          }
        });
      }
    }

    // If barcode not in Open Food Facts, use Gemini knowledge
    const ai = getAI();
    const prompt = `Lookup product details for barcode / UPC code: "${code}".
If you recognize the product, provide its name and nutrition. If unknown, identify the standard snack or product it is most associated with.
Respond with JSON matching:
{
  "name": string,
  "portion": string,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "sugar": number,
  "sodium": number,
  "category": "junk" | "healthy" | "neutral",
  "isJunk": boolean,
  "healthScore": number,
  "grade": "A" | "B" | "C" | "D" | "F",
  "swapSuggestion": string,
  "verdict": string
}`;

    const response = await callGeminiWithFailover(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: { ...parsed, barcode: code, nutritionSource: 'GEMINI_ESTIMATE' } });
  } catch (err: any) {
    console.warn('Barcode lookup notice:', cleanErrorMessage(err));
    return res.status(404).json({
      success: false,
      error: `Barcode (${code}) could not be recognized. Please enter meal details manually.`
    });
  }
}
