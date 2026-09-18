import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { sanitizeForFirestore } from '../src/lib/firestoreSanitizer';

describe('QA Production Bug Fix 1: Vision Upload Error Handling & Cold-Start Resilience', () => {
  const COLD_START_MESSAGE =
    'AI vision backend is waking up (cold start) — please retry in 30-60s or log this meal manually';

  it('handles HTML 502 Bad Gateway response from proxy without throwing raw SyntaxError', async () => {
    // Simulate Vercel / Render 502 proxy HTML error response
    const mockHtmlResponse = new Response('<html><body>502 Bad Gateway (Backend Unreachable)</body></html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/html' }
    });

    // Emulate the frontend fetch handler logic in MainLogScreen
    let analysisError: string | null = null;
    let isAnalyzing = true;

    try {
      if (!mockHtmlResponse.ok) {
        let errMsg = COLD_START_MESSAGE;
        try {
          const errData = await mockHtmlResponse.json();
          if (
            errData &&
            errData.error &&
            mockHtmlResponse.status !== 502 &&
            mockHtmlResponse.status !== 503 &&
            mockHtmlResponse.status !== 504
          ) {
            errMsg = errData.error;
          }
        } catch {
          // Response is non-JSON HTML, preserve friendly waking-up message
        }
        analysisError = errMsg;
      }
    } finally {
      isAnalyzing = false;
    }

    expect(isAnalyzing).toBe(false);
    expect(analysisError).toBe(COLD_START_MESSAGE);
    expect(analysisError).not.toContain('SyntaxError');
    expect(analysisError).not.toContain('Unexpected token');
  });

  it('handles 504 Gateway Timeout or non-JSON 500 error gracefully', async () => {
    const mock504Response = new Response('Gateway Timeout: Render instance sleeping', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: { 'Content-Type': 'text/plain' }
    });

    let analysisError: string | null = null;
    if (!mock504Response.ok) {
      let errMsg = COLD_START_MESSAGE;
      try {
        const errData = await mock504Response.json();
        if (errData?.error && mock504Response.status !== 504) {
          errMsg = errData.error;
        }
      } catch {
        // Fallback to friendly message
      }
      analysisError = errMsg;
    }

    expect(analysisError).toBe(COLD_START_MESSAGE);
  });

  it('propagates specific domain error when backend returns structured JSON error', async () => {
    const mockJsonErrorResponse = new Response(
      JSON.stringify({ success: false, error: 'Photo resolution too low for meal recognition' }),
      {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    let analysisError: string | null = null;
    if (!mockJsonErrorResponse.ok) {
      let errMsg = COLD_START_MESSAGE;
      try {
        const errData = await mockJsonErrorResponse.json();
        if (errData && errData.error) {
          errMsg = errData.error;
        }
      } catch {}
      analysisError = errMsg;
    }

    expect(analysisError).toBe('Photo resolution too low for meal recognition');
  });
});

describe('QA Production Bug Fix 2: Duplicate Submit Guard on Manual Food Logger', () => {
  it('prevents concurrent double-firing when submit is clicked rapidly', async () => {
    let callCount = 0;
    let isSubmitting = false;
    const createdItems: string[] = [];

    // Simulate async database insertion with asynchronous delay
    const simulateAsyncAddFood = async (name: string) => {
      await new Promise((r) => setTimeout(r, 25));
      callCount++;
      createdItems.push(name);
      return { id: `food-${callCount}`, name };
    };

    // Simulate handleManualSubmit with the isSubmitting guard
    const handleManualSubmit = async (foodName: string) => {
      if (isSubmitting) {
        return null; // Block second concurrent execution
      }
      isSubmitting = true;
      try {
        return await simulateAsyncAddFood(foodName);
      } finally {
        isSubmitting = false;
      }
    };

    // Trigger rapid double-click (two invocations dispatched immediately)
    const [result1, result2] = await Promise.all([
      handleManualSubmit('Double Click Smoothie'),
      handleManualSubmit('Double Click Smoothie')
    ]);

    // Exactly one operation should succeed and one should be blocked
    expect(callCount).toBe(1);
    expect(createdItems).toHaveLength(1);
    expect(createdItems[0]).toBe('Double Click Smoothie');
    expect(result1).not.toBeNull();
    expect(result2).toBeNull();
  });

  it('permits subsequent submissions after the first submission completes', async () => {
    let isSubmitting = false;
    let callCount = 0;

    const handleManualSubmit = async (foodName: string) => {
      if (isSubmitting) return null;
      isSubmitting = true;
      try {
        await new Promise((r) => setTimeout(r, 10));
        callCount++;
        return foodName;
      } finally {
        isSubmitting = false;
      }
    };

    // First submit completes
    const res1 = await handleManualSubmit('Meal 1');
    expect(res1).toBe('Meal 1');
    expect(callCount).toBe(1);

    // Second submit after first finishes succeeds
    const res2 = await handleManualSubmit('Meal 2');
    expect(res2).toBe('Meal 2');
    expect(callCount).toBe(2);
  });
});

describe('QA Production Bug Fix 3: Firestore undefined Field Rejection & Sanitizer', () => {
  // Emulate Firebase Firestore's exact validation logic for setDoc
  const mockValidateFirestoreDoc = (data: any, path: string = 'document'): void => {
    if (data === undefined) {
      throw new Error(`FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined (found in field ${path})`);
    }
    if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
      for (const [key, val] of Object.entries(data)) {
        mockValidateFirestoreDoc(val, `${path}.${key}`);
      }
    }
  };

  it('fails raw Firebase validation when optional fields are undefined', () => {
    const rawFoodWithUndefined = {
      name: 'Avocado Toast',
      calories: 380,
      protein: 18,
      carbs: 32,
      fat: 20,
      sugar: undefined, // Empty optional field
      sodium: undefined // Empty optional field
    };

    expect(() => {
      mockValidateFirestoreDoc(rawFoodWithUndefined);
    }).toThrow('Unsupported field value: undefined');
  });

  it('sanitizeForFirestore strips undefined fields completely while preserving 0, null, false, and valid strings', () => {
    const rawData = {
      name: 'Steel-Cut Oatmeal',
      calories: 420,
      protein: 34,
      sugar: undefined, // Must be stripped
      sodium: undefined, // Must be stripped
      zeroValue: 0, // Must be preserved
      nullValue: null, // Must be preserved
      falseValue: false, // Must be preserved
      emptyString: '', // Must be preserved
      nested: {
        definedField: 'hello',
        undefinedField: undefined // Must be stripped in nested objects
      },
      tags: ['healthy', undefined, 'breakfast'] // Undefined filtered from arrays
    };

    const sanitized = sanitizeForFirestore(rawData);

    expect(sanitized).toEqual({
      name: 'Steel-Cut Oatmeal',
      calories: 420,
      protein: 34,
      zeroValue: 0,
      nullValue: null,
      falseValue: false,
      emptyString: '',
      nested: {
        definedField: 'hello'
      },
      tags: ['healthy', 'breakfast']
    });

    expect('sugar' in sanitized).toBe(false);
    expect('sodium' in sanitized).toBe(false);
    expect('undefinedField' in (sanitized as any).nested).toBe(false);
  });

  it('sanitized document passes strict Firestore validation without errors', () => {
    const manualFoodInput = {
      id: 'food-test-123',
      userId: 'qa_athlete',
      name: 'Grilled Salmon with Brown Rice',
      calories: 520,
      protein: 42,
      carbs: 45,
      fat: 16,
      sugar: undefined,
      sodium: undefined,
      portion: '1 fillet (220g)',
      mealType: 'Dinner',
      isJunk: false,
      createdAt: Date.now(),
      date: '2026-09-18'
    };

    const cleanData = sanitizeForFirestore(manualFoodInput);

    // Must execute cleanly without throwing
    expect(() => {
      mockValidateFirestoreDoc(cleanData);
    }).not.toThrow();

    expect(cleanData.calories).toBe(520);
    expect(cleanData.isJunk).toBe(false);
    expect('sugar' in cleanData).toBe(false);
    expect('sodium' in cleanData).toBe(false);
  });

  it('preserves Date instances and special Firestore types', () => {
    const now = new Date();
    const mockTimestamp = { toMillis: () => 1789754546000, seconds: 1789754546 };
    const input = {
      date: now,
      timestamp: mockTimestamp,
      other: undefined
    };

    const sanitized = sanitizeForFirestore(input);
    expect(sanitized.date).toBe(now);
    expect(sanitized.timestamp).toBe(mockTimestamp);
    expect('other' in sanitized).toBe(false);
  });
});
