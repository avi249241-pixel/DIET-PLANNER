# Real-World Nutrition Accuracy Benchmark Methodology

## 1. Executive Summary & Objective
This benchmark evaluates the scientific precision, portion-estimation fidelity, macro-balance consistency, and cultural diversity handling of **Google's Junk Guard Meal Analysis Pipeline** against direct **Google Gemini Multimodal AI** and **Authoritative Ground Truth Databases**.

---

## 2. Dataset Architecture & Stratification
The benchmark dataset contains **40 comprehensively annotated meals** split into:
- **Primary Training & Evaluation Set (30 meals)**: Evaluated for baseline identification, error diagnosis, pipeline tuning, and before/after comparison.
- **Holdout Validation Set (10 meals)**: Kept strictly isolated during pipeline tuning to detect and prevent overfitting.

### Cuisine Diversity & Category Distribution
Each set spans 5 major global dietary archetypes:
1. **South Asian (8 meals total)**: Thalis, Biryanis, Dosas, Curries, Rotis, Puris, Samosas, Lassi, Chai.
2. **East / Southeast Asian (8 meals total)**: Ramen, Pad Thai, Dim Sum (Shumai/Har Gow), Pho, Bulgogi/Bibimbap, Teriyaki Salmon, Fried Rice, Katsu.
3. **Western (8 meals total)**: Burgers & Fries, Artisanal Pizza, Sirloin Steak, Pancakes, Oatmeal, Caesar Salad, Pulled Pork, Club Sandwiches.
4. **Middle Eastern / Mediterranean (8 meals total)**: Shawarma platters, Falafel plates, Shakshuka, Greek salad, Kebab platters, Tuna Niçoise, Grilled skewers.
5. **Composite / High Difficulty (8 meals total)**: Multi-component breakfast feasts, Burrito bowls, Sourdough avocado toasts with eggs & bacon, Fish & chips with tartar sauce, Lasagna with garlic bread, High-protein shakes.

---

## 3. Reference Ground Truth Standards
Reference values are grounded strictly in:
1. **USDA FoodData Central (FDC)**: Standard Reference (SR Legacy) and Foundation Foods chemical analysis.
2. **Indian Food Composition Tables (IFCT / ICMR-NIN 2017)**: Analyzed regional Indian culinary items.
3. **Standardized Culinary Chemical Recipe Formulations**: Precise measured weights of proteins, complex carbs, cooking lipids, sauces, and garnishes.

Every item in `benchmark/manifest.json` specifies:
- Explicit component breakdown with gram weights.
- Energy content ($E_{\text{ref}}$ in kcal).
- Macro composition: Protein ($P_{\text{ref}}$), Carbohydrates ($C_{\text{ref}}$), Fat ($F_{\text{ref}}$), Sugar ($S_{\text{ref}}$), Sodium ($\text{Na}_{\text{ref}}$).
- Scientifically defensible reference tolerance range ($\pm 7.5\%$ to $\pm 10\%$).

---

## 4. Evaluation Metrics & Statistical Formulas

### 1. Mean Absolute Error (MAE)
$$\text{MAE}_{\text{cal}} = \frac{1}{N} \sum_{i=1}^N \left| \text{Calories}_{\text{predicted}, i} - \text{Calories}_{\text{ref}, i} \right|$$

### 2. Mean Absolute Percentage Error (MAPE)
$$\text{MAPE}_{\text{cal}} = \frac{1}{N} \sum_{i=1}^N \left( \frac{\left| \text{Calories}_{\text{predicted}, i} - \text{Calories}_{\text{ref}, i} \right|}{\text{Calories}_{\text{ref}, i}} \right) \times 100\%$$

### 3. Median Absolute Error
$$\text{Median}_{\text{err}} = \text{median}\left( \{ \left| \text{Calories}_{\text{predicted}, i} - \text{Calories}_{\text{ref}, i} \right| \}_{i=1}^N \right)$$

### 4. Component Recall & Precision
$$\text{Recall}_{\text{comp}} = \frac{\text{True Component Matches}}{\text{Total Ground Truth Components}} \times 100\%$$
$$\text{Precision}_{\text{comp}} = \frac{\text{True Component Matches}}{\text{Total Detected Components}} \times 100\%$$

### 5. Atwater Energy Balance Delta
Ensures macro consistency according to the 4-4-9 principle:
$$\Delta_{\text{energy}} = \left| \text{Total Calories} - (4 \times \text{Protein} + 4 \times \text{Carbs} + 9 \times \text{Fat}) \right|$$

---

## 5. Three-Way Evaluation Protocol
For each benchmark sample, three distinct evaluation paths are executed:
- **Path A (Our Application Pipeline)**: HTTP `POST /api/ai/analyze-food` hitting the full production pipeline (Gemini prompt $\rightarrow$ Multi-component extraction $\rightarrow$ USDA/IFCT database verification $\rightarrow$ Energy balance check $\rightarrow$ Persisted structure).
- **Path B (Direct Gemini Multimodal AI)**: Raw unconstrained Gemini multimodal structured JSON response.
- **Path C (Authoritative Reference Values)**: The calibrated ground truth baseline.
