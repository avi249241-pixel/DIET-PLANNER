import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, AuthenticatedVercelRequest } from '../_lib/auth';
import { cleanErrorMessage } from '../_lib/gemini';
import {
  computeFallbackHash,
  cleanBase64,
  findBestMealMatch,
  HIGH_SIMILARITY_THRESHOLD
} from '../../src/lib/personalMemory';

export default async function handler(req: AuthenticatedVercelRequest, res: VercelResponse) {
  const isAuth = await authenticateRequest(req, res);
  if (!isAuth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { imageBase64, photoHash, confirmedMeals } = req.body || {};
    const mealsList = Array.isArray(confirmedMeals) ? confirmedMeals : [];

    if (!mealsList || mealsList.length === 0) {
      return res.json({
        success: true,
        data: {
          matchFound: false,
          similarity: 0,
          reason: 'Personal food memory is empty for this user.'
        }
      });
    }

    if (!imageBase64 && !photoHash) {
      return res.status(400).json({
        success: false,
        error: 'Either imageBase64 or photoHash must be provided.'
      });
    }

    const queryHash = photoHash || computeFallbackHash(cleanBase64(imageBase64 || ''));
    const matchResult = findBestMealMatch(queryHash, mealsList, HIGH_SIMILARITY_THRESHOLD);

    return res.json({
      success: true,
      data: matchResult
    });
  } catch (err: any) {
    console.warn('Personal food memory match notice:', cleanErrorMessage(err));
    return res.json({
      success: true,
      data: {
        matchFound: false,
        similarity: 0,
        reason: 'Memory lookup encountered an error; falling back to full vision pipeline.'
      }
    });
  }
}
