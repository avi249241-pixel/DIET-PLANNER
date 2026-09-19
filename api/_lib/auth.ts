import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export interface DecodedIdToken {
  aud: string;
  auth_time: number;
  email?: string;
  email_verified?: boolean;
  exp: number;
  firebase?: {
    identities?: { [key: string]: any };
    sign_in_provider?: string;
    [key: string]: any;
  };
  iat: number;
  iss: string;
  sub: string;
  uid: string;
  [key: string]: any;
}

export interface AuthenticatedVercelRequest extends VercelRequest {
  user?: DecodedIdToken;
}

// In-memory cache for Google public x509 certificates
let cachedCertificates: { [kid: string]: string } | null = null;
let cacheExpiry = 0;

async function getGooglePublicKeys(): Promise<{ [kid: string]: string }> {
  const now = Date.now();
  if (cachedCertificates && now < cacheExpiry) {
    return cachedCertificates;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public keys: ${res.status}`);
    }

    // Read Cache-Control header if available
    const cacheControl = res.headers.get('cache-control');
    let maxAgeSeconds = 3600; // default 1 hour
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/);
      if (match && match[1]) {
        maxAgeSeconds = parseInt(match[1], 10);
      }
    }

    cachedCertificates = await res.json();
    cacheExpiry = now + maxAgeSeconds * 1000;
    return cachedCertificates!;
  } catch (err) {
    if (cachedCertificates) return cachedCertificates;
    throw err;
  }
}

export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  let header: { alg?: string; kid?: string; typ?: string };
  let payload: DecodedIdToken;

  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Failed to parse JWT payload');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Allow 60s clock skew
  if (payload.exp && payload.exp < nowSec - 60) {
    throw new Error('Token has expired');
  }

  // Ensure sub exists
  if (!payload.sub) {
    throw new Error('Token missing subject');
  }
  payload.uid = payload.sub;

  // Cryptographic Signature Verification
  if (header.kid) {
    try {
      const keys = await getGooglePublicKeys();
      const cert = keys[header.kid];
      if (cert) {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(`${parts[0]}.${parts[1]}`);
        const isValid = verifier.verify(cert, Buffer.from(parts[2], 'base64url'));
        if (isValid) {
          return payload;
        }
      }
    } catch {
      // If local cert check fails, fall through to Google tokeninfo
    }
  }

  // Fallback: Verify via Google OAuth2 tokeninfo endpoint
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const info = await res.json();
      if (info.sub && (!info.exp || parseInt(info.exp, 10) > nowSec - 60)) {
        return {
          ...payload,
          uid: info.sub || payload.sub,
          email: info.email || payload.email,
          email_verified: info.email_verified === 'true' || info.email_verified === true,
        };
      }
    }
  } catch {}

  throw new Error('Cryptographic signature verification failed');
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
  const rawAllow = (process.env.ALLOW_TEST_TOKEN || '').trim().toLowerCase().replace(/['"]/g, '');
  const allowTestToken =
    rawAllow === 'true' ||
    rawAllow === '1' ||
    process.env.NODE_ENV === 'test';
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
      firebase: { identities: {}, sign_in_provider: 'custom' },
    };
    return true;
  }

  try {
    const decodedToken = await verifyFirebaseToken(token);
    req.user = decodedToken;
    return true;
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
    return false;
  }
}
