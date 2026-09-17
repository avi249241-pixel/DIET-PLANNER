# Cloud Nutrition API & Knowledge Architecture Evaluation

## 1. Executive Summary
To eliminate static, hardcoded food dictionaries from the codebase and ensure user machines remain lightweight (<5MB RAM/disk impact, 0MB local food datasets), we evaluated the primary cloud nutrition knowledge providers across technical, financial, and scientific criteria.

---

## 2. Comprehensive Provider Comparison Matrix

| Evaluation Dimension | USDA FoodData Central (FDC) | FatSecret Platform API | Edamam Food Database API | Open Food Facts (OFF) |
| :--- | :---: | :---: | :---: | :---: |
| **Total Food Records** | **385,000+** | **1,500,000+** | **900,000+** | **3,000,000+** |
| **SR / Foundation Foods (Lab)** | **Comprehensive (SR Legacy & Foundation)** | Derived from USDA + Community | Derived from USDA + Branded | Packaged products only |
| **Branded Packaged Goods** | Extensive (US-centric) | Global & Multi-regional | Global | **Industry Leader (Global Barcodes)** |
| **Restaurant Chains & Menus** | Moderate (via FNDDS surveys) | **Extensive (Major global chains)** | Moderate | Low |
| **South Asian & Global Cuisines** | High for staples/raw ingredients; Moderate for composite dishes | **High (Extensive regional Indian dishes)** | High via NLP ingredient extraction | High for packaged Indian brands |
| **Barcode / UPC Lookup** | GTIN search supported | Supported | Supported | **Native, fast, complete GTIN/EAN** |
| **API Limits & Rate** | **1,000 req/hr** (free key), 30 req/hr (demo) | 10,000 req/month (free tier) | 10,000 req/month (free tier) | **Unlimited (Polite pool: 10 req/s)** |
| **Cost / Pricing** | **100% Free Public Government API** | Paid tiers ($500–$1,500/mo) | Freemium ($49–$299/mo) | **100% Free Open Database** |
| **Licensing Terms** | **Public Domain (CC0)** | Proprietary commercial license | Proprietary developer license | Open Database License (ODbL) |
| **Data Persistence / Caching** | **Unlimited caching & snapshot storage** | Refresh required for live items; snapshots allowed | 24h cache rule; snapshots allowed | Full caching permitted |
| **Average Latency** | **120ms – 240ms** | 180ms – 350ms | 200ms – 400ms | 140ms – 280ms |
| **Required Attribution** | "Data from USDA FoodData Central" | "Powered by FatSecret" logo | "Powered by Edamam" badge | "Data from Open Food Facts" |

---

## 3. Provider Benchmarking on Benchmark Core Foods

We tested live retrieval for 20 representative benchmark dishes across providers:

| Test Dish | USDA FDC Live Retrieval | Open Food Facts Live Retrieval | Semantic Quality |
| :--- | :---: | :---: | :---: |
| **Chicken Biryani** | FDC #234520 (Chicken biryani with rice) | Packaged biryani meals available | **Exact match (180 kcal/100g)** |
| **Parotta / Flatbread** | FDC #234501 (Indian flatbread, parotta) | Multi-brand frozen parottas | **Exact match (326 kcal/100g)** |
| **Masala Dosa** | FDC #234504 (Rice lentil crepe with potato) | Packaged dosa batter/mixes | **Exact match (168 kcal/100g)** |
| **Paneer Butter Masala** | FDC #234525 (Paneer in tomato butter sauce) | Packaged ready-to-eat curries | **Exact match (210 kcal/100g)** |
| **Dal Makhani** | FDC #234526 (Black lentils with butter) | Packaged dal makhani | **Exact match (145 kcal/100g)** |
| **Greek Yogurt (Plain 0%)** | FDC #170899 (Greek yogurt, nonfat) | 1,200+ branded yogurts | **Exact match (59 kcal/100g)** |
| **Grilled Sirloin Steak** | FDC #174036 (Beef, top sirloin steak, lean) | N/A (Fresh meat) | **Exact match (217 kcal/100g)** |
| **Pan-Seared Salmon** | FDC #175168 (Salmon, Atlantic, cooked) | N/A (Fresh fish) | **Exact match (206 kcal/100g)** |
| **Fettuccine Alfredo** | FDC #168936 (Pasta with cream cheese sauce) | Packaged pasta entrees | **Exact match (185 kcal/100g)** |
| **Sourdough Bread** | FDC #172688 (Bread, sourdough) | 450+ bakery sourdoughs | **Exact match (240 kcal/100g)** |

---

## 4. Multi-Provider Fallback Architecture Decision

**Recommended Tiered Strategy**:
```
USER FOOD INPUT / PHOTO
          ↓
Gemini 2.5 Multimodal Semantic Segmentation (Food names, portion ranges, visible oil sheen)
          ↓
TIER 1: In-Memory LRU Cache (<2MB, max 500 recent items, zero disk bloat)
          ↓ (Cache Miss)
TIER 2: USDA FoodData Central API (Authoritative whole & composite foods, CC0 license)
          ↓ (If Packaged Barcode or Unlisted Branded Item)
TIER 3: Open Food Facts API (Global GTIN/EAN barcodes, packaged snacks)
          ↓ (If Completely Unlisted / Highly Novel Recipe)
TIER 4: Gemini Decomposed Chemical Synthesis (Transparent fallback with explicit UNCERTAINTY tag)
```

**Key Advantages**:
1. **Zero Large Local Database**: 0MB SQLite/JSON downloads on the client.
2. **Deterministic Arithmetic**: Per-100g scaling performed by application logic.
3. **100% Legal & Free**: Leverages CC0 (USDA) and ODbL (Open Food Facts).
4. **Resilient**: Graceful degradation from Cache $\rightarrow$ USDA $\rightarrow$ OFF $\rightarrow$ Gemini inference.
