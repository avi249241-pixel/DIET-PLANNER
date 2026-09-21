export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  fallbackErrorMessage?: string;
  preferClientAi?: boolean;
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  data?: any;
  isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    statusText: string,
    data?: any,
    isNetworkError = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Sanitizes any error message so that raw technical parsing errors,
 * HTML pages, or stack traces never reach end-users.
 */
export function sanitizeErrorMessage(rawMessage: string, fallback = 'Couldn\'t complete request — please try again or log manually'): string {
  if (!rawMessage) return fallback;

  // Check for HTML error pages or JSON parser errors
  if (
    rawMessage.includes('Unexpected token') ||
    rawMessage.includes('is not valid JSON') ||
    rawMessage.includes('FUNCTION_INVOCATION_FAILED') ||
    rawMessage.includes('A server error has occurred') ||
    rawMessage.includes('<!DOCTYPE') ||
    rawMessage.includes('<html')
  ) {
    return 'AI service is temporarily warming up or unavailable. Please retry in a moment or log manually below.';
  }

  // Check for quota / rate limits
  if (
    rawMessage.includes('429') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('quota')
  ) {
    return 'Service is experiencing high demand. Please wait a moment and retry.';
  }

  // Check for ByteString / character encoding errors
  if (
    rawMessage.includes('ByteString') ||
    rawMessage.includes('65279') ||
    rawMessage.includes('Failed to execute \'fetch\'')
  ) {
    return 'Couldn\'t analyze this photo — please try again or log manually below.';
  }

  // Check for network connection failures
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('ECONNREFUSED')
  ) {
    return 'Could not connect to server. Please check your internet connection and try again.';
  }

  return rawMessage;
}

/**
 * Strips zero-width characters/BOMs (\uFEFF) from HTTP headers to prevent
 * browser ByteString conversion exceptions.
 */
function cleanHeaders(headers?: HeadersInit): HeadersInit | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const cleaned = new Headers();
    headers.forEach((val, key) => {
      const cleanKey = key.replace(/[\uFEFF\u200B]/g, '').trim();
      const cleanVal = val.replace(/[\uFEFF\u200B]/g, '').trim();
      cleaned.append(cleanKey, cleanVal);
    });
    return cleaned;
  }
  if (Array.isArray(headers)) {
    return headers.map(([k, v]) => [
      k.replace(/[\uFEFF\u200B]/g, '').trim(),
      v.replace(/[\uFEFF\u200B]/g, '').trim(),
    ] as [string, string]);
  }
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const cleanKey = k.replace(/[\uFEFF\u200B]/g, '').trim();
    const cleanVal = typeof v === 'string' ? v.replace(/[\uFEFF\u200B]/g, '').trim() : String(v);
    cleaned[cleanKey] = cleanVal;
  }
  return cleaned;
}

/**
 * Retrieves the base API URL from environment configuration.
 * Allows routing directly to Railway or custom backend service.
 */
export function getApiBaseUrl(): string {
  try {
    const envUrl = (import.meta as any)?.env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string') {
      return envUrl.replace(/\/+$/, '');
    }
  } catch {}
  return '';
}

import {
  analyzeFoodClient,
  matchMealMemoryClient,
  recomputeCategoryPriorsClient,
  lookupBarcodeClient,
  weeklyAuditClient,
  calculateProfileClient,
} from './clientAiService';

/**
 * Handles /api/ routes directly in the browser when running serverless / zero-backend.
 */
export async function handleClientDirectRoute<T = any>(
  path: string,
  init?: ApiFetchOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
  let body: any = {};
  if (init?.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = {};
    }
  }

  if (path === '/api/ai/analyze-food') {
    const data = await analyzeFoodClient(body);
    return { success: true, data };
  }

  if (path === '/api/ai/match-meal-memory') {
    const data = matchMealMemoryClient(body);
    return { success: true, data };
  }

  if (path === '/api/ai/recompute-category-priors') {
    const data = recomputeCategoryPriorsClient(body);
    return { success: true, data };
  }

  if (path.startsWith('/api/food/barcode/')) {
    const code = decodeURIComponent(path.replace('/api/food/barcode/', ''));
    const data = await lookupBarcodeClient(code);
    return { success: true, data };
  }

  if (path === '/api/ai/weekly-audit') {
    const data = await weeklyAuditClient(body);
    return { success: true, data };
  }

  if (path === '/api/ai/calculate-profile') {
    const data = calculateProfileClient(body);
    return { success: true, data };
  }

  if (path === '/api/ai/analyze-recipe') {
    return {
      success: false,
      error: 'Recipe builder is currently in preview. Please use Quick Log or Manual Entry.',
    };
  }

  if (path === '/api/ai/smart-grocery-list') {
    return {
      success: false,
      error: 'Smart grocery list sync is currently in preview.',
    };
  }

  if (path === '/health' || path === '/api/health') {
    return {
      success: true,
      data: { status: 'healthy', mode: 'client-direct', timestamp: new Date().toISOString() } as any,
    };
  }

  throw new ApiError(`Route not found: ${path}`, 404, 'Not Found');
}

/**
 * Universal safe fetch wrapper across all frontend components.
 * Guarantees:
 * 1. Inspects response.ok before attempting to parse JSON.
 * 2. Catches non-JSON responses (e.g. Vercel 500/502/504 HTML error pages) cleanly.
 * 3. Never throws raw SyntaxError to caller or user interface.
 * 4. Extracts meaningful, polite, and actionable user messages.
 * 5. Transparently falls back to client-side direct execution when no backend server is running.
 */
export async function apiFetch<T = any>(
  input: string | URL | Request,
  init?: ApiFetchOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
  const timeoutMs = init?.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let targetUrl = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      targetUrl = `${baseUrl}${input}`;
    }
  }

  try {
    const rawHeaders: Record<string, string> = {
      ...(init?.headers as Record<string, string> || {})
    };

    // Auto-attach authorization if targeting /api and not already provided
    if (typeof input === 'string' && input.startsWith('/api') && !rawHeaders['Authorization'] && !rawHeaders['authorization']) {
      if (typeof window !== 'undefined') {
        const uid = localStorage.getItem('customUserId') || 'athlete_guest';
        rawHeaders['Authorization'] = `Bearer test-token-${uid}`;
      }
    }

    // Auto-attach client-side Gemini key if stored
    if (typeof window !== 'undefined' && !rawHeaders['x-gemini-api-key']) {
      const clientKey = localStorage.getItem('gemini_api_key');
      if (clientKey) {
        rawHeaders['x-gemini-api-key'] = clientKey;
      }
    }

    const cleanedInit = {
      ...init,
      headers: cleanHeaders(rawHeaders)
    };

    const res = await fetch(targetUrl, {
      ...cleanedInit,
      signal: init?.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let bodyData: any = null;
    let rawText = '';

    if (isJson) {
      try {
        bodyData = await res.json();
      } catch {
        bodyData = null;
      }
    } else {
      try {
        rawText = await res.text();
      } catch {
        rawText = '';
      }
    }

    // Check if the backend is absent (404 on /api/) or served SPA HTML index.html fallback
    const isHtml = !isJson && (rawText.includes('<!DOCTYPE') || rawText.includes('<html'));
    if (
      typeof input === 'string' &&
      input.startsWith('/api') &&
      (res.status === 404 || (res.status === 200 && isHtml))
    ) {
      try {
        return await handleClientDirectRoute<T>(input, cleanedInit);
      } catch (clientErr: any) {
        if (clientErr instanceof ApiError) throw clientErr;
        throw new ApiError(clientErr.message || 'Client AI execution failed', 500, 'Client AI Error');
      }
    }

    if (!res.ok) {
      // If backend AI or food endpoint returns 500/502/503/401, attempt resilient client-side execution
      if (typeof input === 'string' && (input.startsWith('/api/ai/') || input.startsWith('/api/food/'))) {
        try {
          console.warn(`Backend responded with status ${res.status} on ${input}; invoking client-direct fallback.`);
          return await handleClientDirectRoute<T>(input, cleanedInit);
        } catch {
          // If client-direct also fails, continue to formatted error below
        }
      }
      let friendlyMsg =
        init?.fallbackErrorMessage ||
        'Service is temporarily unavailable. Please try again or log manually below.';

      if (bodyData && typeof bodyData === 'object' && bodyData.error) {
        friendlyMsg = sanitizeErrorMessage(bodyData.error);
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        friendlyMsg =
          'AI service is currently waking up or busy. Please retry in a few seconds or log manually below.';
      } else if (
        rawText.includes('FUNCTION_INVOCATION_FAILED') ||
        rawText.includes('A server error has occurred')
      ) {
        friendlyMsg =
          'Couldn\'t analyze this photo — try again with better lighting or log manually below.';
      } else if (res.status === 401) {
        friendlyMsg = 'Authentication session expired. Please refresh or sign in again.';
      } else if (res.status === 429) {
        friendlyMsg = 'Service is experiencing high demand. Please wait a moment and retry.';
      } else {
        friendlyMsg = sanitizeErrorMessage(friendlyMsg);
      }

      throw new ApiError(friendlyMsg, res.status, res.statusText, bodyData);
    }

    // Success response (2xx)
    if (!bodyData) {
      if (rawText) {
        try {
          bodyData = JSON.parse(rawText);
        } catch {
          return { success: true, data: rawText as unknown as T };
        }
      } else {
        return { success: true, data: undefined };
      }
    }

    if (bodyData && typeof bodyData === 'object' && bodyData.success === false && bodyData.error) {
      bodyData.error = sanitizeErrorMessage(bodyData.error);
    }

    return bodyData;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    // Fall back to client-side direct execution when backend network connection fails
    if (
      typeof input === 'string' &&
      input.startsWith('/api') &&
      (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('ECONNREFUSED'))
    ) {
      try {
        return await handleClientDirectRoute<T>(input, init);
      } catch (clientErr: any) {
        if (clientErr instanceof ApiError) throw clientErr;
        throw new ApiError(clientErr.message || 'Client AI error', 500, 'Client AI Error');
      }
    }

    if (err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. Please check your connection and retry.',
        408,
        'Request Timeout',
        null,
        true
      );
    }

    const rawMsg = err.message || '';
    const cleanMsg = sanitizeErrorMessage(
      rawMsg,
      'Could not complete request. Please check your internet connection.'
    );

    throw new ApiError(cleanMsg, 0, 'Network Error', null, true);
  }
}
