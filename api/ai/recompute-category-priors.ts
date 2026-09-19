import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, AuthenticatedVercelRequest } from '../_lib/auth.js';
import { deriveCategoryPrior } from '../_lib/engine.js';

export default async function handler(req: AuthenticatedVercelRequest, res: VercelResponse) {
  const isAuth = await authenticateRequest(req, res);
  if (!isAuth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { category, existingPrior, corrections } = req.body || {};
    const userId = req.user?.uid || 'default-user';

    if (!category) {
      return res.status(400).json({ success: false, error: 'category is required.' });
    }

    const prior = deriveCategoryPrior({
      userId,
      category,
      existingPrior,
      corrections: corrections || []
    });

    return res.json({ success: true, data: prior });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
