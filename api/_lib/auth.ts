import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'polar-conquest-wmbw7',
  });
}
export const adminAuth = getAuth();

export interface AuthenticatedVercelRequest extends VercelRequest {
  user?: DecodedIdToken;
}

export async function authenticateRequest(
  req: AuthenticatedVercelRequest,
  res: VercelResponse
): Promise<boolean> {
  // CORS Headers
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
    return false;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
    return false;
  }

  // Support test tokens strictly when test mode or ALLOW_TEST_TOKEN is enabled
  const allowTestToken = process.env.ALLOW_TEST_TOKEN === 'true' || process.env.NODE_ENV === 'test';
  if (allowTestToken && token.startsWith('test-token-')) {
    const uid = token.replace('test-token-', '').trim();
    if (!uid) {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid test token format' });
      return false;
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
    return true;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    return true;
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
    return false;
  }
}
