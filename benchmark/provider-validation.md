# Cloud Nutrition Provider Validation & Database Quality Audit

## 1. Executive Summary
A nutrition database is only beneficial if its records match the **preparation state**, **hydration level**, and **composite recipe structure** of the food as served. This audit evaluates entity mapping precision, dangerous substitutions, and raw-vs-cooked conversion factors across USDA FoodData Central and Open Food Facts.

---

## 2. Raw vs. Cooked Weight & Hydration Multipliers

Scaling dry/raw nutrient values against visually estimated cooked plate portions is a primary failure mode in naive nutrition apps. The engine strictly enforces cooked/as-served reference baselines:

| Food Category | Raw / Dry Energy | Cooked / As-Served Energy | Hydration Multiplier | Failure Mode if Raw Baseline Used |
| :--- | :---: | :---: | :---: | :--- |
| **White Rice** | $365\text{ kcal / 100g}$ | **$130\text{ kcal / 100g}$** | $2.80\times\text{ water}$ | **$+180\%$ Calorie Overestimation** |
| **Brown Rice** | $362\text{ kcal / 100g}$ | **$123\text{ kcal / 100g}$** | $2.94\times\text{ water}$ | **$+194\%$ Calorie Overestimation** |
| **Pasta / Fettuccine** | $371\text{ kcal / 100g}$ | **$158\text{ kcal / 100g}$** | $2.35\times\text{ water}$ | **$+135\%$ Calorie Overestimation** |
| **Lentils / Dal** | $352\text{ kcal / 100g}$ | **$116\text{ kcal / 100g}$** | $3.03\times\text{ water}$ | **$+203\%$ Calorie Overestimation** |
| **Chicken Breast** | $120\text{ kcal / 100g}$ | **$165\text{ kcal / 100g}$** | $0.73\times\text{ (moisture loss)}$ | **$-27\%$ Calorie Underestimation** |
| **Beef Sirloin Steak** | $155\text{ kcal / 100g}$ | **$217\text{ kcal / 100g}$** | $0.71\times\text{ (moisture loss)}$ | **$-28\%$ Calorie Underestimation** |

---

## 3. Dangerous Substitution Audit

We audited 50 common complex dishes against automatic cloud database search results to identify and block hazardous semantic replacements:

| AI Identified Dish | Naive Search Result | Risk Level | Calorie Discrepancy | Engine Hardened Guard |
| :--- | :--- | :---: | :---: | :--- |
| **Chicken Dum Biryani** | White Rice (Cooked) | 🚨 **CRITICAL** | $-380\text{ kcal}$ | Require composite recipe match or segmented meat+rice |
| **Fish Curry** | Raw Cod / Raw Fish | 🚨 **CRITICAL** | $-110\text{ kcal}$ | Enforce curry gravy basis ($80\text{g}$ fish + $100\text{g}$ coconut gravy) |
| **Paneer Butter Masala** | Plain Cottage Cheese | 🚨 **CRITICAL** | $-240\text{ kcal}$ | Match Indian curry gravies with butter/cream lipid priors |
| **Dal Makhani** | Raw Dry Black Beans | 🚨 **CRITICAL** | $+420\text{ kcal}$ | Match cooked black lentil stew with butter factor |
| **Garlic Toum** | Raw Garlic Cloves | 🚨 **CRITICAL** | $-520\text{ kcal}$ | Map to oil emulsion ($64\%$ fat density) |
| **Tonkotsu Pork Ramen** | Plain Ramen Noodles | ⚠️ **MAJOR** | $-340\text{ kcal}$ | Decompose into noodles, chashu pork, egg, and pork bone broth |

---

## 4. Entity Resolution & Provenance Invariants

To guarantee scientific transparency and prevent data corruption:
1. **Original Semantic AI Name Preserved**: The user's input and Gemini's identification are never overwritten.
2. **Authoritative Provider Attached**: Every resolved component explicitly logs `provider: 'USDA_FDC' | 'OPEN_FOOD_FACTS' | 'LOCAL_AUTHORITATIVE'`.
3. **Unique Entity ID**: Attaches `fdcId` or `barcode` GTIN to prevent ambiguity.
4. **Historical Snapshots**: Nutrition snapshots are permanently serialized with the logged meal.
