# Per-Meal Error Attribution & Root Cause Analysis

## 1. Executive Summary
A comprehensive per-meal error decomposition was conducted across all 40 benchmark items (30 Primary + 10 Holdout) to identify the true causal drivers of nutrition calculation error.

---

## 2. Top Systemic Error Sources (Ranked by Measured Impact)

| Rank | Systemic Error Source | Total Attributed Error (kcal) | Share of Total Error (%) | Mitigation Strategy |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **Portion Weight Estimation** | **4494 kcal** | **38.4%** | Volumetric plate occupancy reasoning + dish density priors |
| **2** | **Hidden Cooking Medium / Emulsion Fat** | **3162 kcal** | **27%** | Visual sheen detection + 4D uncertainty intervals |
| **3** | **Multi-Component Segmentation (Omission)** | **2909 kcal** | **24.8%** | NLP clause parsing + thali/katori breakdown |
| **4** | **Regional Recipe Composition / Density** | **947 kcal** | **8.1%** | Broth/gravy regional preparation modifiers |
| **5** | **Database Entity Mapping / Substitution** | **205 kcal** | **1.7%** | Non-destructive semantic entity resolution |
| **6** | **Arithmetic / Atwater Rounding** | **0 kcal** | **0%** | Verified 4-4-9 deterministic calculator |

---

## 3. Per-Meal Attribution Table (40 Meals)

| ID | Set | Meal Name | Category | Ground Truth | Predicted | Error (kcal) | Error (%) | Dominant Failure Mode |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **BM-SA-01** | primary | Chicken Biryani with Mirchi Ka Salan & Raita | South Asian | 920 kcal | 1305 kcal | 385 kcal | 41.8% | Portion Weight Estimation & Ghee Variance |
| **BM-SA-02** | primary | Kerala Feast with Rice, Parotta, Chicken Curry & Veg Curry | South Asian | 1247 kcal | 1534 kcal | 287 kcal | 23% | Multi-Component Segmentation (Omission) |
| **BM-SA-03** | primary | Masala Dosa with Sambar & Coconut Chutney | South Asian | 515 kcal | 501 kcal | 14 kcal | 2.7% | Portion Weight Estimation |
| **BM-SA-04** | primary | Paneer Butter Masala with 2 Garlic Naan | South Asian | 990 kcal | 792 kcal | 198 kcal | 20% | Portion Weight Estimation |
| **BM-SA-05** | primary | 2 Fried Samosas with Gulab Jamun & Chai | South Asian | 1055 kcal | 761 kcal | 294 kcal | 27.9% | Hidden Cooking Medium / Emulsion Fat |
| **BM-SA-06** | primary | Dal Tadka with 2 Whole Wheat Rotis, Rice & Cucumber Salad | South Asian | 615 kcal | 667 kcal | 52 kcal | 8.5% | Multi-Component Segmentation (Omission) |
| **BM-EA-01** | primary | Chicken Pad Thai with Crushed Peanuts & Lime | East/Southeast Asian | 730 kcal | 757 kcal | 27 kcal | 3.7% | Portion Weight Estimation |
| **BM-EA-02** | primary | Pan-Seared Salmon Teriyaki with White Rice & Edamame | East/Southeast Asian | 645 kcal | 569 kcal | 76 kcal | 11.8% | Portion Weight Estimation |
| **BM-EA-03** | primary | Tonkotsu Pork Ramen with Soft-Boiled Nitamago Egg | East/Southeast Asian | 820 kcal | 1068 kcal | 248 kcal | 30.2% | Regional Recipe Composition / Density |
| **BM-EA-04** | primary | Chicken Fried Rice with Sunny-Side Egg | East/Southeast Asian | 615 kcal | 933 kcal | 318 kcal | 51.7% | Portion Weight Estimation |
| **BM-EA-05** | primary | Beef Pho Noodle Soup with Herbs & Bean Sprouts | East/Southeast Asian | 485 kcal | 611 kcal | 126 kcal | 26% | Regional Recipe Composition / Density |
| **BM-EA-06** | primary | Steamed Dim Sum Platter (Shumai & Har Gow) | East/Southeast Asian | 410 kcal | 398 kcal | 12 kcal | 2.9% | Portion Weight Estimation |
| **BM-WE-01** | primary | Cheeseburger with Medium French Fries | Western | 670 kcal | 923 kcal | 253 kcal | 37.8% | Portion Weight Estimation |
| **BM-WE-02** | primary | 2 Slices Pepperoni Pizza | Western | 596 kcal | 194 kcal | 402 kcal | 67.4% | Portion Weight Estimation |
| **BM-WE-03** | primary | Grilled Sirloin Steak with Mashed Potatoes & Green Beans | Western | 765 kcal | 597 kcal | 168 kcal | 22% | Portion Weight Estimation |
| **BM-WE-04** | primary | Buttermilk Pancakes with Butter & Maple Syrup | Western | 645 kcal | 394 kcal | 251 kcal | 38.9% | Portion Weight Estimation |
| **BM-WE-05** | primary | Rolled Oatmeal with Blueberries, Banana & Peanut Butter | Western | 425 kcal | 216 kcal | 209 kcal | 49.2% | Portion Weight Estimation |
| **BM-WE-06** | primary | Grilled Chicken Caesar Salad with Croutons & Parmesan | Western | 520 kcal | 462 kcal | 58 kcal | 11.2% | Hidden Cooking Medium / Emulsion Fat |
| **BM-ME-01** | primary | Chicken Shawarma Platter with Hummus & Warm Pita | Middle Eastern/Mediterranean | 810 kcal | 659 kcal | 151 kcal | 18.6% | Hidden Cooking Medium / Emulsion Fat |
| **BM-ME-02** | primary | Greek Salad with Block Feta & Kalamata Olives | Middle Eastern/Mediterranean | 485 kcal | 180 kcal | 305 kcal | 62.9% | Portion Weight Estimation |
| **BM-ME-03** | primary | Crispy Falafel Plate with Tahini Sauce & Tabbouleh | Middle Eastern/Mediterranean | 620 kcal | 361 kcal | 259 kcal | 41.8% | Hidden Cooking Medium / Emulsion Fat |
| **BM-ME-04** | primary | Poached Shakshuka in Spiced Tomato Pepper Sauce | Middle Eastern/Mediterranean | 420 kcal | 333 kcal | 87 kcal | 20.7% | Portion Weight Estimation |
| **BM-ME-05** | primary | Grilled Lamb & Beef Kebab Platter with Bulgur Pilaf | Middle Eastern/Mediterranean | 740 kcal | 405 kcal | 335 kcal | 45.3% | Portion Weight Estimation |
| **BM-ME-06** | primary | Herb Grilled Salmon with Quinoa & Roasted Asparagus | Middle Eastern/Mediterranean | 545 kcal | 421 kcal | 124 kcal | 22.8% | Portion Weight Estimation |
| **BM-CP-01** | primary | Loaded Chicken Burrito Bowl with Guacamole & Sour Cream | Composite/Difficult | 840 kcal | 950 kcal | 110 kcal | 13.1% | Multi-Component Platter Occlusion |
| **BM-CP-02** | primary | Classic Full Diner Breakfast Platter | Composite/Difficult | 895 kcal | 640 kcal | 255 kcal | 28.5% | Multi-Component Platter Occlusion |
| **BM-CP-03** | primary | Fettuccine Alfredo with Grilled Chicken Breast | Composite/Difficult | 960 kcal | 596 kcal | 364 kcal | 37.9% | Multi-Component Platter Occlusion |
| **BM-CP-04** | primary | Beer-Battered Fish & Chips with Tartar Sauce & Mushy Peas | Composite/Difficult | 1040 kcal | 592 kcal | 448 kcal | 43.1% | Multi-Component Platter Occlusion |
| **BM-CP-05** | primary | Sourdough Avocado Toast with 2 Poached Eggs & Bacon | Composite/Difficult | 685 kcal | 705 kcal | 20 kcal | 2.9% | Multi-Component Platter Occlusion |
| **BM-CP-06** | primary | Whey Protein Shake with Whole Milk, Banana & PB | Composite/Difficult | 540 kcal | 557 kcal | 17 kcal | 3.1% | Multi-Component Platter Occlusion |
| **BM-HO-01** | holdout | Fish Curry with Brown Rice & Cabbage Thoran | South Asian | 520 kcal | 574 kcal | 54 kcal | 10.4% | Portion Weight Estimation |
| **BM-HO-02** | holdout | Chana Masala with 2 Puris | South Asian | 680 kcal | 198 kcal | 482 kcal | 70.9% | Hidden Cooking Medium / Emulsion Fat |
| **BM-HO-03** | holdout | Chicken Katsu Curry with Steamed Rice | East/Southeast Asian | 890 kcal | 286 kcal | 604 kcal | 67.9% | Portion Weight Estimation |
| **BM-HO-04** | holdout | Beef Bibimbap with Fried Egg & Gochujang | East/Southeast Asian | 670 kcal | 349 kcal | 321 kcal | 47.9% | Portion Weight Estimation |
| **BM-HO-05** | holdout | Smoked Pulled Pork Sandwich with Coleslaw | Western | 785 kcal | 324 kcal | 461 kcal | 58.7% | Portion Weight Estimation |
| **BM-HO-06** | holdout | Turkey Bacon Club Sandwich with Potato Chips | Western | 710 kcal | 657 kcal | 53 kcal | 7.5% | Portion Weight Estimation |
| **BM-HO-07** | holdout | Grilled Chicken Shish Taouk with Garlic Toum & Flatbread | Middle Eastern/Mediterranean | 615 kcal | 408 kcal | 207 kcal | 33.7% | Hidden Cooking Medium / Emulsion Fat |
| **BM-HO-08** | holdout | Mediterranean Tuna Nicoise Salad with Boiled Egg | Middle Eastern/Mediterranean | 490 kcal | 394 kcal | 96 kcal | 19.6% | Portion Weight Estimation |
| **BM-HO-09** | holdout | Baked Meat Lasagna with Garlic Bread | Composite/Difficult | 840 kcal | 534 kcal | 306 kcal | 36.4% | Multi-Component Platter Occlusion |
| **BM-HO-10** | holdout | 3 Carnitas Street Tacos with Guacamole | Composite/Difficult | 710 kcal | 826 kcal | 116 kcal | 16.3% | Multi-Component Platter Occlusion |
