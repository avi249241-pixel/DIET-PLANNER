import { describe, it, expect, mock } from 'bun:test';
import { apiFetch, sanitizeErrorMessage, ApiError } from '../src/lib/apiFetch';

describe('Centralized apiFetch Defensive Error Handling Suite', () => {
  it('sanitizes SyntaxError and Vercel HTML error strings into friendly user messages', () => {
    const rawSyntaxErr = "Unexpected token 'A', 'A server e'... is not valid JSON";
    const cleanMsg = sanitizeErrorMessage(rawSyntaxErr);

    expect(cleanMsg.includes('Unexpected token')).toBe(false);
    expect(cleanMsg.includes('is not valid JSON')).toBe(false);
    expect(cleanMsg.includes('AI service is temporarily warming up')).toBe(true);
  });

  it('handles HTML 500 FUNCTION_INVOCATION_FAILED from Vercel without throwing SyntaxError', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        '<html><body>A server error has occurred. FUNCTION_INVOCATION_FAILED</body></html>',
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }) as any;

    try {
      await apiFetch('/api/ai/analyze-food', { method: 'POST' });
      expect(true).toBe(false); // Should not reach here
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe("Couldn't analyze this photo — try again with better lighting or log manually below.");
      expect(err.message.includes('Unexpected token')).toBe(false);
      expect(err.status).toBe(500);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles HTML 502/504 Bad Gateway from proxy cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' }
      });
    }) as any;

    try {
      await apiFetch('/api/ai/analyze-food');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('AI service is currently waking up or busy. Please retry in a few seconds or log manually below.');
      expect(err.status).toBe(502);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('parses valid JSON response successfully', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ success: true, data: { meal: 'Salad', calories: 250 } }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }) as any;

    try {
      const res = await apiFetch('/api/ai/analyze-food');
      expect(res.success).toBe(true);
      expect(res.data.meal).toBe('Salad');
      expect(res.data.calories).toBe(250);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('propagates structured API errors safely when returned in JSON', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ success: false, error: 'Photo is too blurry to resolve ingredients' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }) as any;

    try {
      await apiFetch('/api/ai/analyze-food');
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('Photo is too blurry to resolve ingredients');
      expect(err.status).toBe(400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
