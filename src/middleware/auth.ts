import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  // Support test tokens strictly when test mode or ALLOW_TEST_TOKEN is enabled
  const allowTestToken = process.env.ALLOW_TEST_TOKEN === 'true' || process.env.NODE_ENV === 'test';
  if (allowTestToken && token.startsWith('test-token-')) {
    const uid = token.replace('test-token-', '').trim();
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid test token format' });
    }
    req.user = {
      uid,
      email: `${uid}@test.local`,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'polar-conquest-wmbw7',
      iss: 'https://securetoken.google.com/polar-conquest-wmbw7',
      sub: uid,
      firebase: { identities: {}, sign_in_provider: 'custom' }
    } as DecodedIdToken;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.warn('Firebase ID token verification failed:', error instanceof Error ? error.message : String(error));
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};
