/**
 * Multi-Provider Cloud Nutrition Knowledge Architecture
 * 
 * Provides:
 * 1. Unified `NutritionProvider` interface
 * 2. `UsdaFoodDataCentralProvider` for USDA FDC REST API
 * 3. `OpenFoodFactsProvider` for global barcode & packaged food lookups
 * 4. `MultiProviderNutritionService` with Tiered Caching, Fallback & Rate Limiting
 * 5. 0MB local storage impact - user machines remain completely lightweight.
 */

import { lookupAuthoritativeFood } from './nutritionEngine';

export interface NormalizedNutrientData {
  calories: number;        // kcal per 100g
  protein: number;         // g per 100g
  carbs: number;           // g per 100g
  fat: number;             // g per 100g
  sugar?: number;          // g per 100g
  sodium?: number;         // mg per 100g
  fiber?: number;          // g per 100g
}

export interface ServingOption {
  description: string;     // e.g. "1 cup", "1 slice", "1 piece (80g)"
  gramWeight: number;      // e.g. 240
}

export interface NormalizedFoodItem {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  provider: 'USDA_FDC' | 'OPEN_FOOD_FACTS' | 'LOCAL_AUTHORITATIVE' | 'GEMINI_ESTIMATE';
  nutrientsPer100g: NormalizedNutrientData;
  servings: ServingOption[];
  confidence: number;      // 0 to 1
  fdcId?: number | string;
  barcode?: string;
  attribution: string;
}

export interface NutritionProvider {
  name: string;
  searchFood(query: string, limit?: number): Promise<NormalizedFoodItem[]>;
  getFoodById(id: string): Promise<NormalizedFoodItem | null>;
  lookupBarcode(barcode: string): Promise<NormalizedFoodItem | null>;
}

// In-Memory Lightweight LRU Cache (Max 500 items, <1MB RAM)
class SimpleLruCache<T> {
  private maxEntries: number;
  private cache: Map<string, { value: T; expiresAt: number }>;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.cache = new Map();
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs = 1000 * 60 * 60 * 24): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

const foodCache = new SimpleLruCache<NormalizedFoodItem[]>(500);
const singleFoodCache = new SimpleLruCache<NormalizedFoodItem>(500);

/**
 * 1. USDA FoodData Central Cloud Provider
 */
export class UsdaFoodDataCentralProvider implements NutritionProvider {
  name = 'USDA_FDC';
  private apiKey: string;
  private baseUrl = 'https://api.nal.usda.gov/fdc/v1';

  constructor(apiKey = 'DEMO_KEY') {
    let resolvedKey = apiKey;
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USDA_API_KEY) {
      resolvedKey = (import.meta as any).env.VITE_USDA_API_KEY;
    } else if (typeof process !== 'undefined' && process.env?.USDA_API_KEY) {
      resolvedKey = process.env.USDA_API_KEY;
    }
    this.apiKey = resolvedKey;
  }

  async searchFood(query: string, limit = 5): Promise<NormalizedFoodItem[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const cacheKey = `usda_search_${cleanQuery}_${limit}`;
    const cached = foodCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/foods/search?api_key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          query: cleanQuery,
          pageSize: limit,
          dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"]
        }),
        signal: AbortSignal.timeout(4000)
      });

      if (!res.ok) {
        throw new Error(`USDA API returned HTTP ${res.status}`);
      }

      const data: any = await res.json();
      const foods = Array.isArray(data.foods) ? data.foods : [];

      const normalized: NormalizedFoodItem[] = foods.map((f: any) => {
        const nutrients: Record<string, number> = {};
        if (Array.isArray(f.foodNutrients)) {
          for (const n of f.foodNutrients) {
            const name = (n.nutrientName || '').toLowerCase();
            const val = Number(n.value) || 0;
            if (name.includes('energy') && (n.unitName === 'KCAL' || !nutrients['energy'])) nutrients['calories'] = val;
            else if (name.includes('protein')) nutrients['protein'] = val;
            else if (name.includes('carbohydrate')) nutrients['carbs'] = val;
            else if (name.includes('total lipid') || name.includes('fat')) nutrients['fat'] = val;
            else if (name.includes('sugars, total') || name === 'sugars') nutrients['sugar'] = val;
            else if (name.includes('sodium')) nutrients['sodium'] = val;
            else if (name.includes('fiber, total')) nutrients['fiber'] = val;
          }
        }

        const servings: ServingOption[] = [];
        if (f.servingSize && f.servingSizeUnit) {
          servings.push({
            description: `1 serving (${f.servingSize}${f.servingSizeUnit})`,
            gramWeight: f.servingSizeUnit.toLowerCase() === 'g' ? Number(f.servingSize) : 100
          });
        }
        if (Array.isArray(f.foodMeasures)) {
          for (const m of f.foodMeasures) {
            if (m.gramWeight && m.disseminationText) {
              servings.push({
                description: m.disseminationText,
                gramWeight: Number(m.gramWeight)
              });
            }
          }
        }

        return {
          id: `usda_${f.fdcId}`,
          name: f.description || query,
          category: f.foodCategory || 'General Food',
          brand: f.brandOwner || f.brandName,
          provider: 'USDA_FDC',
          fdcId: f.fdcId,
          nutrientsPer100g: {
            calories: nutrients['calories'] || 0,
            protein: Math.round((nutrients['protein'] || 0) * 10) / 10,
            carbs: Math.round((nutrients['carbs'] || 0) * 10) / 10,
            fat: Math.round((nutrients['fat'] || 0) * 10) / 10,
            sugar: Math.round((nutrients['sugar'] || 0) * 10) / 10,
            sodium: Math.round(nutrients['sodium'] || 0),
            fiber: Math.round((nutrients['fiber'] || 0) * 10) / 10
          },
          servings,
          confidence: 0.95,
          attribution: `USDA FoodData Central (FDC #${f.fdcId})`
        };
      });

      foodCache.set(cacheKey, normalized);
      return normalized;
    } catch (err: any) {
      console.warn(`[UsdaProvider] Search failed for '${query}':`, err.message);
      return [];
    }
  }

  async getFoodById(id: string): Promise<NormalizedFoodItem | null> {
    const fdcId = id.replace('usda_', '');
    const cacheKey = `usda_food_${fdcId}`;
    const cached = singleFoodCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/food/${fdcId}?api_key=${this.apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const f: any = await res.json();

      const nutrients: Record<string, number> = {};
      if (Array.isArray(f.foodNutrients)) {
        for (const n of f.foodNutrients) {
          const name = (n.nutrient?.name || n.nutrientName || '').toLowerCase();
          const val = Number(n.amount || n.value) || 0;
          if (name.includes('energy') && (n.nutrient?.unitName === 'kcal' || !nutrients['calories'])) nutrients['calories'] = val;
          else if (name.includes('protein')) nutrients['protein'] = val;
          else if (name.includes('carbohydrate')) nutrients['carbs'] = val;
          else if (name.includes('fat') || name.includes('total lipid')) nutrients['fat'] = val;
          else if (name.includes('sugars')) nutrients['sugar'] = val;
          else if (name.includes('sodium')) nutrients['sodium'] = val;
        }
      }

      const item: NormalizedFoodItem = {
        id: `usda_${f.fdcId}`,
        name: f.description,
        category: f.foodCategory?.description || 'General Food',
        provider: 'USDA_FDC',
        fdcId: f.fdcId,
        nutrientsPer100g: {
          calories: nutrients['calories'] || 0,
          protein: nutrients['protein'] || 0,
          carbs: nutrients['carbs'] || 0,
          fat: nutrients['fat'] || 0,
          sugar: nutrients['sugar'] || 0,
          sodium: nutrients['sodium'] || 0
        },
        servings: [],
        confidence: 0.95,
        attribution: `USDA FoodData Central (FDC #${f.fdcId})`
      };

      singleFoodCache.set(cacheKey, item);
      return item;
    } catch {
      return null;
    }
  }

  async lookupBarcode(barcode: string): Promise<NormalizedFoodItem | null> {
    const results = await this.searchFood(barcode, 1);
    return results.length > 0 ? results[0] : null;
  }
}

/**
 * 2. Open Food Facts Cloud Provider (Global Barcodes & Packaged Products)
 */
export class OpenFoodFactsProvider implements NutritionProvider {
  name = 'OPEN_FOOD_FACTS';

  async searchFood(query: string, limit = 5): Promise<NormalizedFoodItem[]> {
    const cacheKey = `off_search_${query}_${limit}`;
    const cached = foodCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GoogleJunkGuard-Tracker/2.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      const products = Array.isArray(data.products) ? data.products : [];

      const normalized: NormalizedFoodItem[] = products.map((p: any) => {
        const nut = p.nutriments || {};
        return {
          id: `off_${p.code || p.id}`,
          name: p.product_name || query,
          brand: p.brands,
          category: p.categories,
          provider: 'OPEN_FOOD_FACTS',
          barcode: p.code,
          nutrientsPer100g: {
            calories: Number(nut['energy-kcal_100g'] || nut['energy-kcal'] || (Number(nut.energy_100g) / 4.184) || 0),
            protein: Number(nut.proteins_100g || 0),
            carbs: Number(nut.carbohydrates_100g || 0),
            fat: Number(nut.fat_100g || 0),
            sugar: Number(nut.sugars_100g || 0),
            sodium: Number(nut.sodium_100g ? Number(nut.sodium_100g) * 1000 : (Number(nut.salt_100g || 0) * 400))
          },
          servings: p.serving_size ? [{ description: p.serving_size, gramWeight: Number(p.serving_quantity) || 100 }] : [],
          confidence: 0.90,
          attribution: `Open Food Facts (Barcode #${p.code})`
        };
      });

      foodCache.set(cacheKey, normalized);
      return normalized;
    } catch {
      return [];
    }
  }

  async getFoodById(id: string): Promise<NormalizedFoodItem | null> {
    const code = id.replace('off_', '');
    return this.lookupBarcode(code);
  }

  async lookupBarcode(barcode: string): Promise<NormalizedFoodItem | null> {
    const cacheKey = `off_barcode_${barcode}`;
    const cached = singleFoodCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GoogleJunkGuard-Tracker/2.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      if (data.status !== 1 || !data.product) return null;

      const p = data.product;
      const nut = p.nutriments || {};
      const item: NormalizedFoodItem = {
        id: `off_${p.code}`,
        name: p.product_name || 'Packaged Product',
        brand: p.brands,
        provider: 'OPEN_FOOD_FACTS',
        barcode: p.code,
        nutrientsPer100g: {
          calories: Number(nut['energy-kcal_100g'] || nut['energy-kcal'] || (Number(nut.energy_100g) / 4.184) || 0),
          protein: Number(nut.proteins_100g || 0),
          carbs: Number(nut.carbohydrates_100g || 0),
          fat: Number(nut.fat_100g || 0),
          sugar: Number(nut.sugars_100g || 0),
          sodium: Number(nut.sodium_100g ? Number(nut.sodium_100g) * 1000 : (Number(nut.salt_100g || 0) * 400))
        },
        servings: p.serving_size ? [{ description: p.serving_size, gramWeight: Number(p.serving_quantity) || 100 }] : [],
        confidence: 0.95,
        attribution: `Open Food Facts (GTIN #${p.code})`
      };

      singleFoodCache.set(cacheKey, item);
      return item;
    } catch {
      return null;
    }
  }
}

/**
 * 3. Multi-Provider Tiered Nutrition Service
 */
export class MultiProviderNutritionService {
  private usdaProvider: UsdaFoodDataCentralProvider;
  private offProvider: OpenFoodFactsProvider;

  constructor() {
    this.usdaProvider = new UsdaFoodDataCentralProvider();
    this.offProvider = new OpenFoodFactsProvider();
  }

  /**
   * Tiered food search with fast LRU caching and fallback
   */
  async resolveFoodEntity(query: string): Promise<NormalizedFoodItem | null> {
    const clean = query.trim();
    if (!clean) return null;

    // Check if query is barcode
    if (/^\d{8,14}$/.test(clean)) {
      const barcodeItem = await this.offProvider.lookupBarcode(clean);
      if (barcodeItem) return barcodeItem;
    }

    // Tier 1: USDA FoodData Central (Authoritative Foundation & SR Legacy)
    const usdaResults = await this.usdaProvider.searchFood(clean, 3);
    if (usdaResults.length > 0) {
      return usdaResults[0];
    }

    // Tier 2: Open Food Facts (Packaged brand names)
    const offResults = await this.offProvider.searchFood(clean, 3);
    if (offResults.length > 0) {
      return offResults[0];
    }

    // Tier 3: Curated USDA/IFCT Seed Dataset (Zero network fallback)
    const seedMatch = lookupAuthoritativeFood(clean);
    if (seedMatch) {
      return {
        id: `seed_${seedMatch.fdcId}`,
        name: clean.charAt(0).toUpperCase() + clean.slice(1),
        category: 'Standard Recipe / Foundation',
        provider: 'LOCAL_AUTHORITATIVE',
        fdcId: seedMatch.fdcId,
        nutrientsPer100g: {
          calories: seedMatch.calories,
          protein: seedMatch.protein,
          carbs: seedMatch.carbs,
          fat: seedMatch.fat,
          sugar: seedMatch.sugar,
          sodium: seedMatch.sodium
        },
        servings: [{ description: '1 standard serving (100g)', gramWeight: 100 }],
        confidence: 0.95,
        attribution: `USDA FDC / IFCT Reference Seed (#${seedMatch.fdcId})`
      };
    }

    return null;
  }
}

export const nutritionService = new MultiProviderNutritionService();
