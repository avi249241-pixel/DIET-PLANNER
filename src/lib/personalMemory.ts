import { ConfirmedMealRecord, CorrectionLogEntry, CategoryPrior, EvidenceClass, ComponentFoodItem } from '../types';

export const HIGH_SIMILARITY_THRESHOLD = 0.85; // 85% visual similarity required for one-tap memory path
export const RECOMPUTE_THRESHOLD_N = 3; // Recompute category priors after every 3 corrections

/**
 * Clean data URI header from base64 string
 */
export function cleanBase64(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '').trim();
}

/**
 * Compute a deterministic 64-bit perceptual difference hash (dHash)
 * Works seamlessly in both browser (Canvas) and Node/server environments.
 */
export async function computePerceptualHash(base64Image: string): Promise<string> {
  const clean = cleanBase64(base64Image);
  if (!clean) return '0000000000000000';

  // 1. Browser-native 9x8 Grayscale Canvas dHash
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 9;
          canvas.height = 8;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(computeFallbackHash(clean));
            return;
          }

          ctx.drawImage(img, 0, 0, 9, 8);
          const imgData = ctx.getImageData(0, 0, 9, 8).data;

          // Convert to grayscale luminance
          const gray: number[] = [];
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            gray.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
          }

          // Compute 64-bit difference hash (8 rows x 8 comparisons)
          let bits = '';
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              const left = gray[row * 9 + col];
              const right = gray[row * 9 + col + 1];
              bits += left > right ? '1' : '0';
            }
          }

          // Convert 64 binary bits to 16 hex characters
          let hex = '';
          for (let i = 0; i < 64; i += 4) {
            const chunk = bits.slice(i, i + 4);
            hex += parseInt(chunk, 2).toString(16);
          }
          resolve(hex.padStart(16, '0'));
        } catch {
          resolve(computeFallbackHash(clean));
        }
      };
      img.onerror = () => resolve(computeFallbackHash(clean));
      img.src = `data:image/jpeg;base64,${clean}`;
    });
  }

  // 2. Deterministic Node / Server / Test Environment Fallback
  return computeFallbackHash(clean);
}

/**
 * Deterministic 64-bit hash from sample strides across base64 binary content
 */
export function computeFallbackHash(base64Data: string): string {
  if (!base64Data || base64Data.length < 16) return '0000000000000000';
  
  let hashBits = '';
  const stride = Math.max(1, Math.floor(base64Data.length / 64));
  
  for (let i = 0; i < 64; i++) {
    const idx = (i * stride) % base64Data.length;
    const nextIdx = ((i + 1) * stride) % base64Data.length;
    const char1 = base64Data.charCodeAt(idx);
    const char2 = base64Data.charCodeAt(nextIdx);
    hashBits += char1 >= char2 ? '1' : '0';
  }

  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const chunk = hashBits.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex.padStart(16, '0');
}

/**
 * Calculate Hamming distance between two 16-hex (64-bit) hashes
 */
export function calculateHammingDistance(hexHash1: string, hexHash2: string): number {
  if (!hexHash1 || !hexHash2) return 64;
  
  const h1 = hexHash1.padStart(16, '0');
  const h2 = hexHash2.padStart(16, '0');
  
  let distance = 0;
  for (let i = 0; i < 16; i++) {
    const v1 = parseInt(h1[i] || '0', 16);
    const v2 = parseInt(h2[i] || '0', 16);
    let xor = v1 ^ v2;
    // Count set bits in 4-bit chunk
    while (xor > 0) {
      distance += (xor & 1);
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Compute similarity score between 0.0 and 1.0 based on Hamming distance
 * 0 bits diff -> 1.00 (100% match)
 * 8 bits diff -> 0.875 (87.5% match)
 * 16 bits diff -> 0.75 (75% match)
 */
export function calculateHashSimilarity(hexHash1: string, hexHash2: string): number {
  const distance = calculateHammingDistance(hexHash1, hexHash2);
  const similarity = Math.max(0, Math.min(1, (64 - distance) / 64));
  return Math.round(similarity * 1000) / 1000;
}

/**
 * Match a photo hash against a user's past confirmed meals.
 * Strict boundary: Only matches above HIGH_SIMILARITY_THRESHOLD get the one-tap shortcut.
 */
export function findBestMealMatch(
  queryHash: string,
  confirmedMeals: ConfirmedMealRecord[],
  minThreshold = HIGH_SIMILARITY_THRESHOLD
): {
  matchFound: boolean;
  matchedMeal?: ConfirmedMealRecord;
  similarity: number;
  reason: string;
} {
  if (!confirmedMeals || confirmedMeals.length === 0) {
    return {
      matchFound: false,
      similarity: 0,
      reason: 'No previous confirmed meals exist in memory.'
    };
  }

  let bestMatch: ConfirmedMealRecord | undefined = undefined;
  let bestSimilarity = -1;

  for (const meal of confirmedMeals) {
    if (!meal.photoHash) continue;
    const sim = calculateHashSimilarity(queryHash, meal.photoHash);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestMatch = meal;
    }
  }

  if (bestMatch && bestSimilarity >= minThreshold) {
    return {
      matchFound: true,
      matchedMeal: bestMatch,
      similarity: bestSimilarity,
      reason: `High-confidence match (${Math.round(bestSimilarity * 100)}%) with confirmed meal "${bestMatch.mealName}" from ${bestMatch.date}.`
    };
  }

  return {
    matchFound: false,
    matchedMeal: undefined,
    similarity: Math.max(0, bestSimilarity),
    reason: bestMatch
      ? `Highest similarity candidate "${bestMatch.mealName}" (${Math.round(bestSimilarity * 100)}%) is below high-confidence threshold (${Math.round(minThreshold * 100)}%). Full vision recognition required.`
      : 'No visual match found.'
  };
}

/**
 * Categorize a meal or food into a standardized culinary category
 */
export function detectFoodCategory(foodName: string, mealName?: string): string {
  const text = `${foodName} ${mealName || ''}`.toLowerCase();
  if (text.includes('curry') || text.includes('masala') || text.includes('korma') || text.includes('gravy') || text.includes('paneer') || text.includes('sambar') || text.includes('dal')) {
    return 'curry';
  }
  if (text.includes('salad') || text.includes('greens') || text.includes('lettuce') || text.includes('caesar') || text.includes('slaw')) {
    return 'salad';
  }
  if (text.includes('biryani') || text.includes('pulao') || text.includes('rice') || text.includes('fried rice')) {
    return 'rice';
  }
  if (text.includes('naan') || text.includes('roti') || text.includes('bread') || text.includes('toast') || text.includes('pita') || text.includes('parotta')) {
    return 'bread';
  }
  if (text.includes('steak') || text.includes('chicken') || text.includes('salmon') || text.includes('fish') || text.includes('beef') || text.includes('pork') || text.includes('egg') || text.includes('tofu')) {
    return 'protein';
  }
  if (text.includes('burger') || text.includes('pizza') || text.includes('fry') || text.includes('fries') || text.includes('taco') || text.includes('samosa')) {
    return 'fast_food';
  }
  if (text.includes('soup') || text.includes('ramen') || text.includes('pho') || text.includes('broth')) {
    return 'soup';
  }
  if (text.includes('bowl') || text.includes('pad thai') || text.includes('noodle') || text.includes('pasta')) {
    return 'bowl';
  }
  return 'general';
}

/**
 * Compute differences between initial model predictions and user-confirmed meal totals
 * Every delta records its evidence class and food category context.
 */
export function computeCorrectionDeltas(params: {
  userId: string;
  mealName: string;
  mealId?: string;
  foodCategory: string;
  predicted: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    foods?: Array<{ name: string; estimatedGrams?: number; fat?: number; evidence?: EvidenceClass }>;
  };
  confirmed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    foods?: Array<{ name: string; estimatedGrams?: number; fat?: number; evidence?: EvidenceClass }>;
  };
}): CorrectionLogEntry[] {
  const { userId, mealName, mealId, foodCategory, predicted, confirmed } = params;
  const entries: CorrectionLogEntry[] = [];
  const now = Date.now();

  // 1. Caloric Delta
  const calDelta = Math.round(confirmed.calories - predicted.calories);
  if (Math.abs(calDelta) >= 25) {
    entries.push({
      id: `corr-${now}-cal-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      mealId,
      mealName,
      foodCategory,
      fieldName: 'calories',
      predictedValue: Math.round(predicted.calories),
      confirmedValue: Math.round(confirmed.calories),
      delta: calDelta,
      evidenceClass: 'context_derived',
      timestamp: now
    });
  }

  // 2. Fat / Oil Mass Delta
  const fatDelta = Math.round((confirmed.fat - predicted.fat) * 10) / 10;
  if (Math.abs(fatDelta) >= 3.0) {
    // Check if oil or gravy was unobservable_unknown in predicted
    const hasUnobservableOil = (predicted.foods || []).some(
      f => f.evidence === 'unobservable_unknown' || f.name.toLowerCase().includes('oil') || f.name.toLowerCase().includes('butter')
    );

    entries.push({
      id: `corr-${now}-oil-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      mealId,
      mealName,
      foodCategory,
      fieldName: 'oil_grams',
      predictedValue: Math.round(predicted.fat * 10) / 10,
      confirmedValue: Math.round(confirmed.fat * 10) / 10,
      delta: fatDelta,
      evidenceClass: hasUnobservableOil ? 'unobservable_unknown' : 'visible',
      timestamp: now
    });
  }

  // 3. Portion Mass Delta (from components)
  const predGrams = (predicted.foods || []).reduce((acc, f) => acc + (f.estimatedGrams || 0), 0);
  const confGrams = (confirmed.foods || []).reduce((acc, f) => acc + (f.estimatedGrams || 0), 0);
  const portionDelta = Math.round(confGrams - predGrams);

  if (predGrams > 0 && confGrams > 0 && Math.abs(portionDelta) >= 20) {
    entries.push({
      id: `corr-${now}-portion-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      mealId,
      mealName,
      foodCategory,
      fieldName: 'portion_grams',
      predictedValue: predGrams,
      confirmedValue: confGrams,
      delta: portionDelta,
      evidenceClass: 'visible',
      timestamp: now
    });
  }

  return entries;
}

/**
 * Derive or update a per-user, per-category prior from accumulated corrections.
 * - Versioned (never overwritten silently)
 * - Traceable (records exact correctionLog IDs that generated it)
 * - Bounded (clamped within safe physiological limits)
 */
export function deriveCategoryPrior(params: {
  userId: string;
  category: string;
  existingPrior?: CategoryPrior | null;
  corrections: CorrectionLogEntry[];
}): CategoryPrior {
  const { userId, category, existingPrior, corrections } = params;
  
  const relevantCorrections = corrections.filter(c => c.foodCategory === category && c.userId === userId);
  const sampleCount = relevantCorrections.length;
  const traceableIds = relevantCorrections.map(c => c.id);

  if (sampleCount === 0) {
    // Return neutral prior
    return {
      id: category,
      userId,
      category,
      version: existingPrior ? existingPrior.version + 1 : 1,
      oilMassAdjustmentFactor: 1.0,
      portionAdjustmentFactor: 1.0,
      calorieAdjustmentOffset: 0,
      confidenceOffset: 0,
      sampleCount: 0,
      traceableCorrectionIds: [],
      reasoning: `Neutral prior initialized for category "${category}" (0 corrections).`,
      updatedAt: Date.now()
    };
  }

  // 1. Compute oil mass adjustment factor
  const oilCorrections = relevantCorrections.filter(c => c.fieldName === 'oil_grams');
  let oilFactor = 1.0;
  if (oilCorrections.length > 0) {
    let sumRatio = 0;
    for (const oc of oilCorrections) {
      if (oc.predictedValue > 0) {
        sumRatio += (oc.confirmedValue / oc.predictedValue);
      } else {
        sumRatio += 1.20; // Default widening when unpredicted oil confirmed
      }
    }
    // Damped adjustment bounded between 0.70x and 1.50x to prevent over-fitting
    oilFactor = Math.round(Math.max(0.70, Math.min(1.50, sumRatio / oilCorrections.length)) * 100) / 100;
  }

  // 2. Compute portion adjustment factor
  const portionCorrections = relevantCorrections.filter(c => c.fieldName === 'portion_grams');
  let portionFactor = 1.0;
  if (portionCorrections.length > 0) {
    let sumPortionRatio = 0;
    for (const pc of portionCorrections) {
      if (pc.predictedValue > 0) {
        sumPortionRatio += (pc.confirmedValue / pc.predictedValue);
      }
    }
    portionFactor = Math.round(Math.max(0.75, Math.min(1.40, sumPortionRatio / portionCorrections.length)) * 100) / 100;
  }

  // 3. Compute calorie adjustment offset
  const calCorrections = relevantCorrections.filter(c => c.fieldName === 'calories');
  let calOffset = 0;
  if (calCorrections.length > 0) {
    const sumDelta = calCorrections.reduce((acc, c) => acc + c.delta, 0);
    // Damped mean offset clamped between -150 kcal and +150 kcal
    calOffset = Math.round(Math.max(-150, Math.min(150, sumDelta / calCorrections.length)));
  }

  const version = (existingPrior?.version || 0) + 1;
  const reasoning = `Version ${version}: Derived from ${sampleCount} corrections. Oil mass factor: ${oilFactor}x, Portion factor: ${portionFactor}x, Calorie offset: ${calOffset >= 0 ? `+${calOffset}` : calOffset} kcal.`;

  return {
    id: category,
    userId,
    category,
    version,
    oilMassAdjustmentFactor: oilFactor,
    portionAdjustmentFactor: portionFactor,
    calorieAdjustmentOffset: calOffset,
    confidenceOffset: sampleCount >= 5 ? 0.05 : 0,
    sampleCount,
    traceableCorrectionIds: traceableIds,
    reasoning,
    updatedAt: Date.now()
  };
}

// --------------------------------------------------------------------------
// PERSISTENCE & DUAL-WRITE HELPERS (LocalStorage + Firestore)
// --------------------------------------------------------------------------

import { collection, doc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export async function loadUserConfirmedMeals(userId: string): Promise<ConfirmedMealRecord[]> {
  const cacheKey = `confirmedMeals_${userId}`;
  let cached: ConfirmedMealRecord[] = [];
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (userId && userId !== 'default-user' && userId !== 'athlete_guest' && db) {
    try {
      const colRef = collection(db, 'users', userId, 'confirmedMeals');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const remoteMeals = snap.docs.map(d => d.data() as ConfirmedMealRecord);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(remoteMeals));
        } catch {}
        return remoteMeals;
      }
    } catch (err) {
      console.warn('Firestore confirmedMeals load notice (using cache):', err);
    }
  }

  return cached;
}

export async function saveUserConfirmedMeal(userId: string, meal: ConfirmedMealRecord): Promise<void> {
  const cacheKey = `confirmedMeals_${userId}`;
  try {
    const existingRaw = localStorage.getItem(cacheKey);
    const list: ConfirmedMealRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = list.filter(m => m.id !== meal.id);
    localStorage.setItem(cacheKey, JSON.stringify([meal, ...filtered]));
  } catch {}

  if (userId && userId !== 'default-user' && userId !== 'athlete_guest' && db) {
    try {
      const docRef = doc(db, 'users', userId, 'confirmedMeals', meal.id);
      await setDoc(docRef, meal);
    } catch (err) {
      console.warn('Firestore confirmedMeals save notice:', err);
    }
  }
}

export async function loadUserCorrectionLog(userId: string): Promise<CorrectionLogEntry[]> {
  const cacheKey = `correctionLog_${userId}`;
  let cached: CorrectionLogEntry[] = [];
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (userId && userId !== 'default-user' && userId !== 'athlete_guest' && db) {
    try {
      const colRef = collection(db, 'users', userId, 'correctionLog');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const remote = snap.docs.map(d => d.data() as CorrectionLogEntry);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(remote));
        } catch {}
        return remote;
      }
    } catch (err) {
      console.warn('Firestore correctionLog load notice (using cache):', err);
    }
  }

  return cached;
}

export async function appendUserCorrectionLog(userId: string, entries: CorrectionLogEntry[]): Promise<void> {
  if (!entries || entries.length === 0) return;
  const cacheKey = `correctionLog_${userId}`;
  try {
    const existingRaw = localStorage.getItem(cacheKey);
    const list: CorrectionLogEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    localStorage.setItem(cacheKey, JSON.stringify([...entries, ...list]));
  } catch {}

  if (userId && userId !== 'default-user' && userId !== 'athlete_guest' && db) {
    try {
      for (const entry of entries) {
        const docRef = doc(db, 'users', userId, 'correctionLog', entry.id);
        await setDoc(docRef, entry);
      }
    } catch (err) {
      console.warn('Firestore correctionLog append notice:', err);
    }
  }
}

export async function loadUserCategoryPriors(userId: string): Promise<Record<string, CategoryPrior>> {
  const cacheKey = `categoryPriors_${userId}`;
  let cached: Record<string, CategoryPrior> = {};
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (userId && userId !== 'default-user' && userId !== 'athlete_guest' && db) {
    try {
      const colRef = collection(db, 'users', userId, 'categoryPriors');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const priors: Record<string, CategoryPrior> = {};
        snap.docs.forEach(d => {
          const p = d.data() as CategoryPrior;
          priors[p.category] = p;
        });
        try {
          localStorage.setItem(cacheKey, JSON.stringify(priors));
        } catch {}
        return priors;
      }
    } catch (err) {
      console.warn('Firestore categoryPriors load notice (using cache):', err);
    }
  }

  return cached;
}

export async function saveUserCategoryPrior(userId: string, prior: CategoryPrior): Promise<void> {
  const cacheKey = `categoryPriors_${userId}`;
  try {
    const raw = localStorage.getItem(cacheKey);
    const priors = raw ? JSON.parse(raw) : {};
    priors[prior.category] = prior;
    localStorage.setItem(cacheKey, JSON.stringify(priors));
  } catch {}

  if (userId && userId !== 'default-user' && userId !== 'athlete_guest' && db) {
    try {
      const docRef = doc(db, 'users', userId, 'categoryPriors', prior.id);
      await setDoc(docRef, prior);
    } catch (err) {
      console.warn('Firestore categoryPrior save notice:', err);
    }
  }
}

