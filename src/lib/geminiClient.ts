/**
 * Direct Client-Side Gemini AI Client
 * 
 * Enables 100% serverless, zero-backend execution directly from the browser.
 * - Manages API key in localStorage with env fallback
 * - Validates API keys against Google AI Studio
 * - Executes multimodal vision and structured JSON calls with automatic failover
 */

const STORAGE_KEY = 'diet_planner_gemini_api_key';
let inMemoryKey: string | null = null;

/**
 * Retrieves the currently active Gemini API key.
 * Checks localStorage first, then in-memory fallback, then Vite environment variables.
 */
export function getStoredGeminiApiKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local && local.trim().length > 0) {
        return local.trim();
      }
    } else if (inMemoryKey && inMemoryKey.trim().length > 0) {
      return inMemoryKey.trim();
    }
  } catch {}

  try {
    const envKeyName = ['VITE', 'GEMINI', 'API', 'KEY'].join('_');
    const metaEnv = (import.meta as any)?.env;
    const envKey = metaEnv?.[envKeyName] || metaEnv?.VITE_AI_STUDIO_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim();
    }
  } catch {}

  return '';
}

/**
 * Saves a Gemini API key to local storage (or in-memory cache).
 */
export function setStoredGeminiApiKey(key: string): void {
  const clean = key
    .replace(/^[\uFEFF\uFFFE\u00EF\u00BB\u00BF]+/, '')
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^['"]|['"]$/g, '');

  if (!clean) {
    inMemoryKey = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  } else {
    inMemoryKey = clean;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, clean);
      }
    } catch {}
  }
}

/**
 * Removes the stored Gemini API key from local storage and memory.
 */
export function removeStoredGeminiApiKey(): void {
  inMemoryKey = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Checks whether an API key is available.
 */
export function hasGeminiApiKey(): boolean {
  return getStoredGeminiApiKey().length > 0;
}

/**
 * Validates an API key by making a lightweight test query to Gemini 2.5 Flash.
 */
export async function validateGeminiApiKey(candidateKey: string): Promise<{ valid: boolean; error?: string }> {
  const cleanKey = candidateKey
    .replace(/^[\uFEFF\uFFFE\u00EF\u00BB\u00BF]+/, '')
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^['"]|['"]$/g, '');

  if (!cleanKey) {
    return { valid: false, error: 'Please enter an API key.' };
  }

  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

  try {
    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Ping' }] }],
        generationConfig: { maxOutputTokens: 5 }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || `API error (${res.status})`;
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        return { valid: false, error: 'Invalid API key. Please verify your key in Google AI Studio.' };
      }
      return { valid: false, error: msg };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Could not connect to Google Gemini API.' };
  }
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiCallConfig {
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Executes a Gemini prompt with automatic multi-model failover directly from the client.
 */
export async function callClientGemini(
  parts: GeminiPart[],
  config: GeminiCallConfig = { responseMimeType: 'application/json' },
  customKey?: string
): Promise<string> {
  const apiKey = customKey || getStoredGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your free key in Settings.');
  }

  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const generationConfig: Record<string, any> = {
        temperature: config.temperature ?? 0.2,
      };

      if (config.responseMimeType) {
        generationConfig.responseMimeType = config.responseMimeType;
      }
      if (config.responseSchema) {
        generationConfig.responseSchema = config.responseSchema;
      }
      if (config.maxOutputTokens) {
        generationConfig.maxOutputTokens = config.maxOutputTokens;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error?.message || `HTTP ${res.status}`;
        if (
          res.status === 503 ||
          res.status === 429 ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('UNAVAILABLE')
        ) {
          lastError = new Error(`Model ${model} unavailable (${errorMsg}), failing over...`);
          continue;
        }
        throw new Error(errorMsg);
      }

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';
      if (!text) {
        throw new Error('No content returned from Gemini model.');
      }

      return text;
    } catch (err: any) {
      lastError = err;
      const msg = err.message || String(err);
      if (msg.includes('unavailable') || msg.includes('429') || msg.includes('503')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini model endpoints failed. Please check your API key.');
}
