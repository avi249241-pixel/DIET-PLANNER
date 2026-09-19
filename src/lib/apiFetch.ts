export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  fallbackErrorMessage?: string;
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
 * Universal safe fetch wrapper across all frontend components.
 * Guarantees:
 * 1. Inspects response.ok before attempting to parse JSON.
 * 2. Catches non-JSON responses (e.g. Vercel 500/502/504 HTML error pages) cleanly.
 * 3. Never throws raw SyntaxError to caller or user interface.
 * 4. Extracts meaningful, polite, and actionable user messages.
 * 5. Handles timeouts cleanly.
 */
export async function apiFetch<T = any>(
  input: string | URL | Request,
  init?: ApiFetchOptions
): Promise<{ success: boolean; data?: T; error?: string }> {
  const timeoutMs = init?.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
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

    if (!res.ok) {
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
