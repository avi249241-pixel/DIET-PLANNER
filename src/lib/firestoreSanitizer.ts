/**
 * Recursively strips keys with `undefined` values from an object or array.
 *
 * Google Cloud Firestore SDK throws:
 * "FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined"
 * when any document field is set to `undefined`.
 *
 * This utility ensures safe persistence by removing undefined fields while preserving
 * valid falsy values (false, 0, '', null) and complex objects/arrays.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    // Preserve special types like Date, Timestamp, or FieldValue
    if (
      data instanceof Date ||
      (data as any)._methodName ||
      typeof (data as any).toMillis === 'function'
    ) {
      return data;
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }

  return data;
}
