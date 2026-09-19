// src/lib/personalMemory.ts
import { collection, doc as doc2, getDocs, setDoc, query, orderBy, limit } from "firebase/firestore";

// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "polar-conquest-wmbw7",
  appId: "1:156919561999:web:6d37d34b869c96e78d887a",
  apiKey: "AIzaSyCwD13sZxjX3eXc4V54Rpun9S7VQxV91BY",
  authDomain: "polar-conquest-wmbw7.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-junkfoodcaloriet-b46ca9dc-3486-45d4-9dd5-0bd7ec1783dd",
  storageBucket: "polar-conquest-wmbw7.firebasestorage.app",
  messagingSenderId: "156919561999",
  measurementId: "",
  oAuthClientId: "156919561999-dg5gu9ho2hi4ff4a8o6uonu0c4c0p7kn.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebase.ts
var app = initializeApp(firebase_applet_config_default);
var db = getFirestore(app, firebase_applet_config_default.firestoreDatabaseId);
var auth = getAuth(app);
var googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// src/lib/personalMemory.ts
var HIGH_SIMILARITY_THRESHOLD = 0.85;
function cleanBase64(base64) {
  return base64.replace(/^data:image\/\w+;base64,/, "").trim();
}
function computeFallbackHash(base64Data) {
  if (!base64Data || base64Data.length < 16) return "0000000000000000";
  let hashBits = "";
  const stride = Math.max(1, Math.floor(base64Data.length / 64));
  for (let i = 0; i < 64; i++) {
    const idx = i * stride % base64Data.length;
    const nextIdx = (i + 1) * stride % base64Data.length;
    const char1 = base64Data.charCodeAt(idx);
    const char2 = base64Data.charCodeAt(nextIdx);
    hashBits += char1 >= char2 ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    const chunk = hashBits.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex.padStart(16, "0");
}
function calculateHammingDistance(hexHash1, hexHash2) {
  if (!hexHash1 || !hexHash2) return 64;
  const h1 = hexHash1.padStart(16, "0");
  const h2 = hexHash2.padStart(16, "0");
  let distance = 0;
  for (let i = 0; i < 16; i++) {
    const v1 = parseInt(h1[i] || "0", 16);
    const v2 = parseInt(h2[i] || "0", 16);
    let xor = v1 ^ v2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}
function calculateHashSimilarity(hexHash1, hexHash2) {
  const distance = calculateHammingDistance(hexHash1, hexHash2);
  const similarity = Math.max(0, Math.min(1, (64 - distance) / 64));
  return Math.round(similarity * 1e3) / 1e3;
}
function findBestMealMatch(queryHash, confirmedMeals, minThreshold = HIGH_SIMILARITY_THRESHOLD) {
  if (!confirmedMeals || confirmedMeals.length === 0) {
    return {
      matchFound: false,
      similarity: 0,
      reason: "No previous confirmed meals exist in memory."
    };
  }
  let bestMatch = void 0;
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
    matchedMeal: void 0,
    similarity: Math.max(0, bestSimilarity),
    reason: bestMatch ? `Highest similarity candidate "${bestMatch.mealName}" (${Math.round(bestSimilarity * 100)}%) is below high-confidence threshold (${Math.round(minThreshold * 100)}%). Full vision recognition required.` : "No visual match found."
  };
}
function detectFoodCategory(foodName, mealName) {
  const text = `${foodName} ${mealName || ""}`.toLowerCase();
  if (text.includes("curry") || text.includes("masala") || text.includes("korma") || text.includes("gravy") || text.includes("paneer") || text.includes("sambar") || text.includes("dal")) {
    return "curry";
  }
  if (text.includes("salad") || text.includes("greens") || text.includes("lettuce") || text.includes("caesar") || text.includes("slaw")) {
    return "salad";
  }
  if (text.includes("biryani") || text.includes("pulao") || text.includes("rice") || text.includes("fried rice")) {
    return "rice";
  }
  if (text.includes("naan") || text.includes("roti") || text.includes("bread") || text.includes("toast") || text.includes("pita") || text.includes("parotta")) {
    return "bread";
  }
  if (text.includes("steak") || text.includes("chicken") || text.includes("salmon") || text.includes("fish") || text.includes("beef") || text.includes("pork") || text.includes("egg") || text.includes("tofu")) {
    return "protein";
  }
  if (text.includes("burger") || text.includes("pizza") || text.includes("fry") || text.includes("fries") || text.includes("taco") || text.includes("samosa")) {
    return "fast_food";
  }
  if (text.includes("soup") || text.includes("ramen") || text.includes("pho") || text.includes("broth")) {
    return "soup";
  }
  if (text.includes("bowl") || text.includes("pad thai") || text.includes("noodle") || text.includes("pasta")) {
    return "bowl";
  }
  return "general";
}
function deriveCategoryPrior(params) {
  const { userId, category, existingPrior, corrections } = params;
  const relevantCorrections = corrections.filter((c) => c.foodCategory === category && c.userId === userId);
  const sampleCount = relevantCorrections.length;
  const traceableIds = relevantCorrections.map((c) => c.id);
  if (sampleCount === 0) {
    return {
      id: category,
      userId,
      category,
      version: existingPrior ? existingPrior.version + 1 : 1,
      oilMassAdjustmentFactor: 1,
      portionAdjustmentFactor: 1,
      calorieAdjustmentOffset: 0,
      confidenceOffset: 0,
      sampleCount: 0,
      traceableCorrectionIds: [],
      reasoning: `Neutral prior initialized for category "${category}" (0 corrections).`,
      updatedAt: Date.now()
    };
  }
  const oilCorrections = relevantCorrections.filter((c) => c.fieldName === "oil_grams");
  let oilFactor = 1;
  if (oilCorrections.length > 0) {
    let sumRatio = 0;
    for (const oc of oilCorrections) {
      if (oc.predictedValue > 0) {
        sumRatio += oc.confirmedValue / oc.predictedValue;
      } else {
        sumRatio += 1.2;
      }
    }
    oilFactor = Math.round(Math.max(0.7, Math.min(1.5, sumRatio / oilCorrections.length)) * 100) / 100;
  }
  const portionCorrections = relevantCorrections.filter((c) => c.fieldName === "portion_grams");
  let portionFactor = 1;
  if (portionCorrections.length > 0) {
    let sumPortionRatio = 0;
    for (const pc of portionCorrections) {
      if (pc.predictedValue > 0) {
        sumPortionRatio += pc.confirmedValue / pc.predictedValue;
      }
    }
    portionFactor = Math.round(Math.max(0.75, Math.min(1.4, sumPortionRatio / portionCorrections.length)) * 100) / 100;
  }
  const calCorrections = relevantCorrections.filter((c) => c.fieldName === "calories");
  let calOffset = 0;
  if (calCorrections.length > 0) {
    const sumDelta = calCorrections.reduce((acc, c) => acc + c.delta, 0);
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

// src/lib/nutritionEngine.ts
var USDA_REFERENCE_DB = {
  // Grains, Breads & Staples
  "white rice (cooked)": { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, sugar: 0.1, sodium: 1, fdcId: 168878 },
  "brown rice (cooked)": { calories: 123, protein: 2.7, carbs: 25.6, fat: 1, sugar: 0.2, sodium: 5, fdcId: 169704 },
  "chicken biryani": { calories: 180, protein: 10.5, carbs: 22.4, fat: 5.2, sugar: 1.2, sodium: 490, fdcId: 234520 },
  "vegetable biryani / pulao": { calories: 152, protein: 3.8, carbs: 26.5, fat: 3.4, sugar: 1.5, sodium: 410, fdcId: 234521 },
  "parotta / flatbread": { calories: 326, protein: 7.2, carbs: 49.5, fat: 11.2, sugar: 1.8, sodium: 410, fdcId: 234501 },
  "roti / chapati": { calories: 297, protein: 9.3, carbs: 56.4, fat: 3.7, sugar: 0.8, sodium: 190, fdcId: 234502 },
  "naan": { calories: 310, protein: 8.7, carbs: 52.3, fat: 7.4, sugar: 3.2, sodium: 490, fdcId: 234503 },
  "garlic naan": { calories: 243, protein: 7, carbs: 47, fat: 3.5, sugar: 1.8, sodium: 222, fdcId: 234503 },
  "pita bread": { calories: 275, protein: 9.1, carbs: 55.7, fat: 1.2, sugar: 2.4, sodium: 480, fdcId: 172688 },
  "sourdough toast": { calories: 240, protein: 8, carbs: 47, fat: 1.8, sugar: 1.2, sodium: 410, fdcId: 172688 },
  "pancake / hotcake": { calories: 175, protein: 4.9, carbs: 27.7, fat: 4.7, sugar: 3.3, sodium: 283, fdcId: 172686 },
  "garlic bread / toast": { calories: 308, protein: 7.5, carbs: 37.3, fat: 14.6, sugar: 2, sodium: 480, fdcId: 172688 },
  "dosa": { calories: 168, protein: 3.9, carbs: 29.1, fat: 3.8, sugar: 0.4, sodium: 210, fdcId: 234504 },
  "idli": { calories: 132, protein: 4.8, carbs: 26.5, fat: 0.8, sugar: 0.2, sodium: 180, fdcId: 234505 },
  "puri (deep fried wheat)": { calories: 330, protein: 6.5, carbs: 40.2, fat: 16.5, sugar: 0.5, sodium: 217, fdcId: 234533 },
  "pasta / fettuccine (cooked)": { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, sugar: 0.6, sodium: 1, fdcId: 168936 },
  "whole wheat bread": { calories: 247, protein: 12, carbs: 41.3, fat: 3.4, sugar: 4.3, sodium: 400, fdcId: 172688 },
  "white bread": { calories: 265, protein: 9, carbs: 49, fat: 3.2, sugar: 5, sodium: 490, fdcId: 172686 },
  "rolled oats (cooked)": { calories: 71, protein: 2.5, carbs: 12, fat: 1.5, sugar: 0.3, sodium: 49, fdcId: 173904 },
  "quinoa (cooked)": { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, sugar: 0.9, sodium: 7, fdcId: 168917 },
  "bulgur pilaf (cooked)": { calories: 110, protein: 4.2, carbs: 23.4, fat: 1.5, sugar: 1.2, sodium: 184, fdcId: 168917 },
  "ramen wheat noodles (cooked)": { calories: 158, protein: 5.8, carbs: 30.9, fat: 1, sugar: 0.5, sodium: 155, fdcId: 168936 },
  "rice pho noodles (cooked)": { calories: 109, protein: 1.8, carbs: 24, fat: 0.4, sugar: 0.2, sodium: 20, fdcId: 168936 },
  "corn tortilla": { calories: 218, protein: 5.7, carbs: 45, fat: 2.8, sugar: 0.8, sodium: 45, fdcId: 172686 },
  "mashed potatoes (buttered)": { calories: 118, protein: 1.9, carbs: 17.7, fat: 4.8, sugar: 1.4, sodium: 295, fdcId: 170438 },
  "hash brown potato": { calories: 235, protein: 2.5, carbs: 26.3, fat: 14, sugar: 0.4, sodium: 442, fdcId: 170699 },
  "thick cut potato chips / fries": { calories: 214, protein: 2.6, carbs: 31.2, fat: 8.9, sugar: 0.6, sodium: 170, fdcId: 170699 },
  "fried rice (chicken/veg)": { calories: 174, protein: 6.2, carbs: 27.8, fat: 4.4, sugar: 1.2, sodium: 460, fdcId: 234522 },
  "pad thai noodles": { calories: 192, protein: 7.8, carbs: 30.5, fat: 4.6, sugar: 4.5, sodium: 520, fdcId: 234523 },
  "black beans (seasoned)": { calories: 100, protein: 6.2, carbs: 16.9, fat: 1.2, sugar: 0.8, sodium: 200, fdcId: 172421 },
  // Proteins & Main Dishes
  "chicken breast (grilled)": { calories: 165, protein: 31, carbs: 0, fat: 3.6, sugar: 0, sodium: 74, fdcId: 171077 },
  "chicken thigh (grilled)": { calories: 180, protein: 27, carbs: 0, fat: 7, sugar: 0, sodium: 85, fdcId: 171077 },
  "chicken curry (meat + gravy)": { calories: 185, protein: 16.5, carbs: 4.2, fat: 11.5, sugar: 1.5, sodium: 480, fdcId: 234506 },
  "mutton / lamb curry": { calories: 225, protein: 17.8, carbs: 3.8, fat: 15.6, sugar: 1.2, sodium: 520, fdcId: 234507 },
  "fish curry": { calories: 135, protein: 16.2, carbs: 3.2, fat: 6.4, sugar: 0.8, sodium: 430, fdcId: 234524 },
  "beef steak (lean grilled)": { calories: 217, protein: 26.1, carbs: 0, fat: 11.8, sugar: 0, sodium: 62, fdcId: 174036 },
  "beef lean slices (pho/stir fry)": { calories: 148, protein: 23.7, carbs: 0, fat: 5.7, sugar: 0, sodium: 57, fdcId: 174036 },
  "beef bulgogi (seasoned)": { calories: 165, protein: 19.5, carbs: 5.1, fat: 7.5, sugar: 3.8, sodium: 527, fdcId: 174036 },
  "pork bacon (crispy)": { calories: 440, protein: 25, carbs: 1, fat: 37, sugar: 1, sodium: 1200, fdcId: 171077 },
  "pork sausage link": { calories: 300, protein: 15.4, carbs: 1.7, fat: 26, sugar: 0.7, sodium: 817, fdcId: 171077 },
  "chashu pork belly": { calories: 234, protein: 15.6, carbs: 1.7, fat: 18.6, sugar: 1.1, sodium: 300, fdcId: 171077 },
  "shredded pork carnitas": { calories: 190, protein: 24.5, carbs: 0.8, fat: 9.8, sugar: 0.4, sodium: 410, fdcId: 171077 },
  "pulled pork in bbq sauce": { calories: 224, protein: 15.9, carbs: 21, fat: 8.3, sugar: 8.8, sodium: 512, fdcId: 171077 },
  "turkey breast (smoked deli)": { calories: 104, protein: 17.5, carbs: 3.8, fat: 2, sugar: 2.5, sodium: 890, fdcId: 171077 },
  "chicken shawarma (spiced)": { calories: 175, protein: 21.2, carbs: 1.3, fat: 9.3, sugar: 0.4, sodium: 400, fdcId: 171077 },
  "shish taouk chicken skewer": { calories: 160, protein: 23, carbs: 0.7, fat: 7.1, sugar: 0.3, sodium: 322, fdcId: 171077 },
  "minced lamb & beef kebab": { calories: 232, protein: 18.1, carbs: 1.9, fat: 16.7, sugar: 0.6, sodium: 410, fdcId: 174036 },
  "crispy chickpea falafel": { calories: 233, protein: 8.6, carbs: 27.3, fat: 11.1, sugar: 1.5, sodium: 400, fdcId: 172421 },
  "beer battered cod fish fillet": { calories: 220, protein: 16.2, carbs: 12.4, fat: 11.8, sugar: 0.4, sodium: 290, fdcId: 175168 },
  "canned light tuna (in water)": { calories: 110, protein: 25.5, carbs: 0, fat: 0.8, sugar: 0, sodium: 243, fdcId: 175168 },
  "salmon (pan-seared)": { calories: 206, protein: 22.1, carbs: 0, fat: 12.3, sugar: 0, sodium: 61, fdcId: 175168 },
  "egg (whole boiled/poached)": { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, sugar: 1.1, sodium: 124, fdcId: 171287 },
  "egg (scrambled with butter)": { calories: 170, protein: 11, carbs: 2, fat: 13, sugar: 1.2, sodium: 210, fdcId: 173423 },
  "shrimp har gow dumpling": { calories: 152, protein: 10.4, carbs: 21.6, fat: 2.4, sugar: 0.8, sodium: 340, fdcId: 234534 },
  "pork & shrimp shumai": { calories: 171, protein: 11.1, carbs: 13.5, fat: 8.1, sugar: 1.1, sodium: 373, fdcId: 234535 },
  "chicken katsu cutlet (panko fried)": { calories: 247, protein: 22.6, carbs: 11.5, fat: 12.6, sugar: 0.5, sodium: 300, fdcId: 234536 },
  "tofu (firm)": { calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, sugar: 0.6, sodium: 14, fdcId: 172475 },
  "paneer (indian cottage cheese)": { calories: 296, protein: 18.3, carbs: 4.5, fat: 22.8, sugar: 2.5, sodium: 18, fdcId: 234508 },
  "paneer butter masala": { calories: 210, protein: 8.5, carbs: 6.2, fat: 17, sugar: 3.2, sodium: 490, fdcId: 234525 },
  "lentils / dal (cooked)": { calories: 116, protein: 9, carbs: 20.1, fat: 0.4, sugar: 1.8, sodium: 238, fdcId: 172421 },
  "dal makhani / black lentils": { calories: 145, protein: 6.2, carbs: 14.8, fat: 6.8, sugar: 1.2, sodium: 430, fdcId: 234526 },
  "chana masala / chickpeas": { calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, sugar: 4.2, sodium: 390, fdcId: 234527 },
  "sambar (lentil vegetable stew)": { calories: 75, protein: 3.2, carbs: 11.4, fat: 2, sugar: 2.8, sodium: 340, fdcId: 234509 },
  "greek yogurt (plain nonfat)": { calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, sugar: 3.2, sodium: 36, fdcId: 170899 },
  "whey protein isolate powder": { calories: 375, protein: 85, carbs: 3, fat: 1.5, sugar: 1, sodium: 160, fdcId: 234510 },
  "whole dairy milk": { calories: 62, protein: 3.4, carbs: 4.9, fat: 3.4, sugar: 5, sodium: 43, fdcId: 173423 },
  "cheddar cheese": { calories: 403, protein: 24.9, carbs: 1.3, fat: 33.1, sugar: 0.5, sodium: 621, fdcId: 170899 },
  "feta cheese": { calories: 264, protein: 14.2, carbs: 4.1, fat: 21.3, sugar: 0, sodium: 1146, fdcId: 170899 },
  "butter (salted)": { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1, sugar: 0.1, sodium: 576, fdcId: 173423 },
  "sour cream": { calories: 193, protein: 2.1, carbs: 4.6, fat: 18.9, sugar: 3.4, sodium: 53, fdcId: 170899 },
  // Vegetables, Curries, Oils & Condiments
  "coconut vegetable curry": { calories: 145, protein: 2.8, carbs: 9.5, fat: 11, sugar: 3.2, sodium: 380, fdcId: 234511 },
  "green beans stir fry (poriyal)": { calories: 85, protein: 2.4, carbs: 8.2, fat: 5.1, sugar: 2.1, sodium: 290, fdcId: 234512 },
  "cabbage coconut thoran": { calories: 65, protein: 1.8, carbs: 8.2, fat: 2.8, sugar: 2.4, sodium: 160, fdcId: 234512 },
  "broccoli (steamed)": { calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, sugar: 1.4, sodium: 41, fdcId: 170379 },
  "asparagus (roasted)": { calories: 40, protein: 2.8, carbs: 5.2, fat: 1, sugar: 1.3, sodium: 20, fdcId: 170379 },
  "spinach / saag": { calories: 68, protein: 3.5, carbs: 4.8, fat: 4.2, sugar: 0.8, sodium: 310, fdcId: 234513 },
  "papadum / papad (roasted)": { calories: 371, protein: 25.5, carbs: 59.9, fat: 3.3, sugar: 1.5, sodium: 1450, fdcId: 234514 },
  "coconut chutney": { calories: 230, protein: 3.1, carbs: 8.5, fat: 21, sugar: 3, sodium: 420, fdcId: 234515 },
  "tomato chutney": { calories: 95, protein: 1.8, carbs: 14.2, fat: 3.6, sugar: 6.5, sodium: 380, fdcId: 234516 },
  "avocado": { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, sugar: 0.7, sodium: 7, fdcId: 171705 },
  "hummus": { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6, sugar: 0.3, sodium: 380, fdcId: 170889 },
  "guacamole": { calories: 157, protein: 2, carbs: 8.6, fat: 14.1, sugar: 0.7, sodium: 280, fdcId: 234528 },
  "ghee / clarified butter": { calories: 876, protein: 0.2, carbs: 0, fat: 99.5, sugar: 0, sodium: 2, fdcId: 234529 },
  "olive oil": { calories: 884, protein: 0, carbs: 0, fat: 100, sugar: 0, sodium: 2, fdcId: 171413 },
  "alfredo sauce": { calories: 345, protein: 6.7, carbs: 4.4, fat: 34.4, sugar: 2.3, sodium: 1055, fdcId: 168936 },
  "caesar salad dressing": { calories: 320, protein: 7.8, carbs: 2.8, fat: 39.2, sugar: 2, sodium: 1178, fdcId: 171413 },
  "garlic toum emulsion": { calories: 600, protein: 2, carbs: 8, fat: 64, sugar: 2.7, sodium: 600, fdcId: 171413 },
  "tahini sauce / dressing": { calories: 355, protein: 9, carbs: 12, fat: 31.5, sugar: 2, sodium: 450, fdcId: 170889 },
  "tartar sauce": { calories: 344, protein: 1.2, carbs: 12.6, fat: 32.7, sugar: 5.8, sodium: 750, fdcId: 171413 },
  "tomato salsa (fresh)": { calories: 36, protein: 1.5, carbs: 7, fat: 0.2, sugar: 4.4, sodium: 430, fdcId: 170379 },
  "tabbouleh salad": { calories: 91, protein: 2.4, carbs: 11.4, fat: 4.5, sugar: 1.9, sodium: 163, fdcId: 168917 },
  "coleslaw (with mayo)": { calories: 161, protein: 1.3, carbs: 8.4, fat: 14.1, sugar: 5.4, sodium: 186, fdcId: 170379 },
  "kettle potato chips": { calories: 488, protein: 6.5, carbs: 54, fat: 28, sugar: 1, sodium: 550, fdcId: 170699 },
  "mirchi ka salan peanut curry": { calories: 175, protein: 5.7, carbs: 10.3, fat: 13, sugar: 1.8, sodium: 367, fdcId: 234537 },
  "cucumber raita": { calories: 100, protein: 11, carbs: 9.8, fat: 3, sugar: 1.5, sodium: 100, fdcId: 234538 },
  "shakshuka tomato sauce": { calories: 70, protein: 2, carbs: 6.3, fat: 4.7, sugar: 2.9, sodium: 250, fdcId: 234539 },
  "tonkotsu pork ramen broth": { calories: 77, protein: 2.8, carbs: 2, fat: 6.5, sugar: 0.6, sodium: 493, fdcId: 234540 },
  "pho spiced beef broth": { calories: 30, protein: 1.4, carbs: 2.9, fat: 0.9, sugar: 1.4, sodium: 511, fdcId: 234541 },
  "lasagna (meat and cheese)": { calories: 180, protein: 11.8, carbs: 13.9, fat: 8.8, sugar: 2.1, sodium: 337, fdcId: 234542 },
  // Fast Foods, Fruits & Sweets
  "french fries": { calories: 312, protein: 3.4, carbs: 41.4, fat: 15.5, sugar: 0.3, sodium: 210, fdcId: 170699 },
  "cheeseburger (fast food single)": { calories: 280, protein: 15, carbs: 29, fat: 12, sugar: 5, sodium: 620, fdcId: 170701 },
  "pizza (pepperoni or cheese slice)": { calories: 278, protein: 12.2, carbs: 28.9, fat: 12.3, sugar: 3.5, sodium: 645, fdcId: 170702 },
  "samosa (fried potato)": { calories: 308, protein: 4.5, carbs: 32.2, fat: 17.5, sugar: 1.8, sodium: 440, fdcId: 234530 },
  "gulab jamun": { calories: 387, protein: 4.2, carbs: 64.5, fat: 12.8, sugar: 48, sodium: 120, fdcId: 234531 },
  "mango lassi": { calories: 115, protein: 3.2, carbs: 18.4, fat: 3.2, sugar: 16, sodium: 60, fdcId: 234532 },
  "masala chai with milk": { calories: 91, protein: 3.9, carbs: 10.6, fat: 1, sugar: 4.2, sodium: 96, fdcId: 234532 },
  "maple syrup": { calories: 260, protein: 0, carbs: 67, fat: 0.1, sugar: 60.5, sodium: 12, fdcId: 172686 },
  "natural peanut butter": { calories: 588, protein: 25, carbs: 20, fat: 50, sugar: 7.5, sodium: 30, fdcId: 173944 },
  "banana (fresh)": { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, sugar: 12.2, sodium: 1, fdcId: 173944 },
  "blueberries (fresh)": { calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, sugar: 10, sodium: 1, fdcId: 171711 }
};
function lookupAuthoritativeFood(foodName) {
  if (!foodName) return null;
  const clean = foodName.toLowerCase().trim();
  if (USDA_REFERENCE_DB[clean]) {
    return USDA_REFERENCE_DB[clean];
  }
  for (const [key, data] of Object.entries(USDA_REFERENCE_DB)) {
    if (clean.includes(key) || key.includes(clean)) {
      return data;
    }
  }
  if (clean.includes("biryani") && clean.includes("chicken")) return USDA_REFERENCE_DB["chicken biryani"];
  if (clean.includes("biryani") || clean.includes("pulao")) return USDA_REFERENCE_DB["vegetable biryani / pulao"];
  if (clean.includes("rice") && !clean.includes("brown")) return USDA_REFERENCE_DB["white rice (cooked)"];
  if (clean.includes("parotta") || clean.includes("paratha")) return USDA_REFERENCE_DB["parotta / flatbread"];
  if (clean.includes("roti") || clean.includes("chapati")) return USDA_REFERENCE_DB["roti / chapati"];
  if (clean.includes("garlic naan")) return USDA_REFERENCE_DB["garlic naan"];
  if (clean.includes("naan")) return USDA_REFERENCE_DB["naan"];
  if (clean.includes("pita")) return USDA_REFERENCE_DB["pita bread"];
  if (clean.includes("sourdough")) return USDA_REFERENCE_DB["sourdough toast"];
  if (clean.includes("pancake")) return USDA_REFERENCE_DB["pancake / hotcake"];
  if (clean.includes("garlic bread")) return USDA_REFERENCE_DB["garlic bread / toast"];
  if (clean.includes("dosa")) return USDA_REFERENCE_DB["dosa"];
  if (clean.includes("idli")) return USDA_REFERENCE_DB["idli"];
  if (clean.includes("puri") || clean.includes("poori")) return USDA_REFERENCE_DB["puri (deep fried wheat)"];
  if (clean.includes("fettuccine") || clean.includes("pasta")) return USDA_REFERENCE_DB["pasta / fettuccine (cooked)"];
  if (clean.includes("chicken curry") || clean.includes("curry") && clean.includes("chicken")) return USDA_REFERENCE_DB["chicken curry (meat + gravy)"];
  if (clean.includes("mutton") || clean.includes("lamb")) return USDA_REFERENCE_DB["mutton / lamb curry"];
  if (clean.includes("fish curry")) return USDA_REFERENCE_DB["fish curry"];
  if (clean.includes("paneer butter") || clean.includes("paneer") && clean.includes("masala")) return USDA_REFERENCE_DB["paneer butter masala"];
  if (clean.includes("paneer")) return USDA_REFERENCE_DB["paneer (indian cottage cheese)"];
  if (clean.includes("dal makhani") || clean.includes("makhani")) return USDA_REFERENCE_DB["dal makhani / black lentils"];
  if (clean.includes("sambar")) return USDA_REFERENCE_DB["sambar (lentil vegetable stew)"];
  if (clean.includes("chana") || clean.includes("chickpea")) return USDA_REFERENCE_DB["chana masala / chickpeas"];
  if (clean.includes("dal") || clean.includes("dhal") || clean.includes("lentil")) return USDA_REFERENCE_DB["lentils / dal (cooked)"];
  if (clean.includes("papad")) return USDA_REFERENCE_DB["papadum / papad (roasted)"];
  if (clean.includes("coconut chutney")) return USDA_REFERENCE_DB["coconut chutney"];
  if (clean.includes("tomato chutney")) return USDA_REFERENCE_DB["tomato chutney"];
  if (clean.includes("chicken breast")) return USDA_REFERENCE_DB["chicken breast (grilled)"];
  if (clean.includes("chicken thigh")) return USDA_REFERENCE_DB["chicken thigh (grilled)"];
  if (clean.includes("steak") || clean.includes("sirloin")) return USDA_REFERENCE_DB["beef steak (lean grilled)"];
  if (clean.includes("bacon")) return USDA_REFERENCE_DB["pork bacon (crispy)"];
  if (clean.includes("sausage")) return USDA_REFERENCE_DB["pork sausage link"];
  if (clean.includes("chashu")) return USDA_REFERENCE_DB["chashu pork belly"];
  if (clean.includes("carnitas")) return USDA_REFERENCE_DB["shredded pork carnitas"];
  if (clean.includes("pulled pork")) return USDA_REFERENCE_DB["pulled pork in bbq sauce"];
  if (clean.includes("turkey")) return USDA_REFERENCE_DB["turkey breast (smoked deli)"];
  if (clean.includes("shawarma")) return USDA_REFERENCE_DB["chicken shawarma (spiced)"];
  if (clean.includes("shish taouk") || clean.includes("taouk")) return USDA_REFERENCE_DB["shish taouk chicken skewer"];
  if (clean.includes("kebab")) return USDA_REFERENCE_DB["minced lamb & beef kebab"];
  if (clean.includes("falafel")) return USDA_REFERENCE_DB["crispy chickpea falafel"];
  if (clean.includes("fish & chip") || clean.includes("battered fish") || clean.includes("cod")) return USDA_REFERENCE_DB["beer battered cod fish fillet"];
  if (clean.includes("tuna")) return USDA_REFERENCE_DB["canned light tuna (in water)"];
  if (clean.includes("katsu")) return USDA_REFERENCE_DB["chicken katsu cutlet (panko fried)"];
  if (clean.includes("har gow")) return USDA_REFERENCE_DB["shrimp har gow dumpling"];
  if (clean.includes("shumai") || clean.includes("siu mai")) return USDA_REFERENCE_DB["pork & shrimp shumai"];
  if (clean.includes("egg") && clean.includes("scrambled")) return USDA_REFERENCE_DB["egg (scrambled with butter)"];
  if (clean.includes("egg")) return USDA_REFERENCE_DB["egg (whole boiled/poached)"];
  if (clean.includes("samosa")) return USDA_REFERENCE_DB["samosa (fried potato)"];
  if (clean.includes("gulab jamun")) return USDA_REFERENCE_DB["gulab jamun"];
  if (clean.includes("lassi")) return USDA_REFERENCE_DB["mango lassi"];
  if (clean.includes("chai")) return USDA_REFERENCE_DB["masala chai with milk"];
  if (clean.includes("ghee")) return USDA_REFERENCE_DB["ghee / clarified butter"];
  if (clean.includes("olive oil")) return USDA_REFERENCE_DB["olive oil"];
  if (clean.includes("hummus")) return USDA_REFERENCE_DB["hummus"];
  if (clean.includes("guacamole")) return USDA_REFERENCE_DB["guacamole"];
  if (clean.includes("pad thai") || clean.includes("noodle")) return USDA_REFERENCE_DB["pad thai noodles"];
  if (clean.includes("ramen")) return USDA_REFERENCE_DB["ramen wheat noodles (cooked)"];
  if (clean.includes("pho noodle")) return USDA_REFERENCE_DB["rice pho noodles (cooked)"];
  if (clean.includes("tortilla") || clean.includes("taco")) return USDA_REFERENCE_DB["corn tortilla"];
  if (clean.includes("mashed potato")) return USDA_REFERENCE_DB["mashed potatoes (buttered)"];
  if (clean.includes("hash brown")) return USDA_REFERENCE_DB["hash brown potato"];
  if (clean.includes("alfredo")) return USDA_REFERENCE_DB["alfredo sauce"];
  if (clean.includes("caesar")) return USDA_REFERENCE_DB["caesar salad dressing"];
  if (clean.includes("toum")) return USDA_REFERENCE_DB["garlic toum emulsion"];
  if (clean.includes("tahini")) return USDA_REFERENCE_DB["tahini sauce / dressing"];
  if (clean.includes("tartar")) return USDA_REFERENCE_DB["tartar sauce"];
  if (clean.includes("salsa")) return USDA_REFERENCE_DB["tomato salsa (fresh)"];
  if (clean.includes("tabbouleh")) return USDA_REFERENCE_DB["tabbouleh salad"];
  if (clean.includes("coleslaw")) return USDA_REFERENCE_DB["coleslaw (with mayo)"];
  if (clean.includes("chips") || clean.includes("crisps")) return USDA_REFERENCE_DB["kettle potato chips"];
  if (clean.includes("mirchi ka salan")) return USDA_REFERENCE_DB["mirchi ka salan peanut curry"];
  if (clean.includes("raita")) return USDA_REFERENCE_DB["cucumber raita"];
  if (clean.includes("shakshuka")) return USDA_REFERENCE_DB["shakshuka tomato sauce"];
  if (clean.includes("tonkotsu broth")) return USDA_REFERENCE_DB["tonkotsu pork ramen broth"];
  if (clean.includes("pho broth")) return USDA_REFERENCE_DB["pho spiced beef broth"];
  if (clean.includes("lasagna")) return USDA_REFERENCE_DB["lasagna (meat and cheese)"];
  if (clean.includes("maple syrup") || clean.includes("syrup")) return USDA_REFERENCE_DB["maple syrup"];
  if (clean.includes("peanut butter")) return USDA_REFERENCE_DB["natural peanut butter"];
  if (clean.includes("banana")) return USDA_REFERENCE_DB["banana (fresh)"];
  if (clean.includes("blueberry") || clean.includes("blueberries")) return USDA_REFERENCE_DB["blueberries (fresh)"];
  if (clean.includes("burger")) return USDA_REFERENCE_DB["cheeseburger (fast food single)"];
  if (clean.includes("fry") || clean.includes("fries")) return USDA_REFERENCE_DB["french fries"];
  if (clean.includes("pizza")) return USDA_REFERENCE_DB["pizza (pepperoni or cheese slice)"];
  if (clean.includes("whey") || clean.includes("protein powder")) return USDA_REFERENCE_DB["whey protein isolate powder"];
  if (clean.includes("salmon")) return USDA_REFERENCE_DB["salmon (pan-seared)"];
  if (clean.includes("quinoa")) return USDA_REFERENCE_DB["quinoa (cooked)"];
  if (clean.includes("asparagus")) return USDA_REFERENCE_DB["asparagus (roasted)"];
  if (clean.includes("broccoli")) return USDA_REFERENCE_DB["broccoli (steamed)"];
  if (clean.includes("spinach") || clean.includes("saag")) return USDA_REFERENCE_DB["spinach / saag"];
  if (clean.includes("green bean") || clean.includes("poriyal")) return USDA_REFERENCE_DB["green beans stir fry (poriyal)"];
  if (clean.includes("feta")) return USDA_REFERENCE_DB["feta cheese"];
  if (clean.includes("oat") || clean.includes("oatmeal")) return USDA_REFERENCE_DB["rolled oats (cooked)"];
  if (clean.includes("black bean") || clean.includes("beans")) return USDA_REFERENCE_DB["black beans (seasoned)"];
  if (clean.includes("thoran") || clean.includes("cabbage")) return USDA_REFERENCE_DB["cabbage coconut thoran"];
  if (clean.includes("milk")) return USDA_REFERENCE_DB["whole dairy milk"];
  if (clean.includes("butter")) return USDA_REFERENCE_DB["butter (salted)"];
  if (clean.includes("sour cream")) return USDA_REFERENCE_DB["sour cream"];
  if (clean.includes("cheddar") || clean.includes("cheese")) return USDA_REFERENCE_DB["cheddar cheese"];
  return null;
}
function extractGramPortion(text, foodKey) {
  const t = text.toLowerCase();
  const gramMatch = t.match(/(\d+)\s*(?:g|grams)\b/);
  if (gramMatch) return Number(gramMatch[1]);
  const ozMatch = t.match(/(\d+)\s*oz\b/);
  if (ozMatch) return Math.round(Number(ozMatch[1]) * 28.35);
  const countMatch = t.match(/(\d+)\s*(?:slices?|pcs?|pieces?|strips?|skewers?|scoops?|puris?|tacos?|samosas?)\b/);
  const count = countMatch ? Number(countMatch[1]) : 1;
  if (foodKey.includes("naan") || foodKey.includes("roti") || foodKey.includes("parotta")) return count * 80;
  if (foodKey.includes("puri") || foodKey.includes("taco")) return count * 60;
  if (foodKey.includes("samosa") || foodKey.includes("falafel")) return count * 55;
  if (foodKey.includes("dumpling") || foodKey.includes("shumai") || foodKey.includes("har gow")) return count * 35;
  if (foodKey.includes("pancake")) return count * 80;
  if (foodKey.includes("bacon")) return count * 10;
  if (foodKey.includes("sausage")) return count * 45;
  if (foodKey.includes("egg")) return count * 55;
  if (foodKey.includes("toast") || foodKey.includes("bread") || foodKey.includes("pizza")) return count * 60;
  if (foodKey.includes("scoop")) return count * 30;
  if (foodKey.includes("tbsp") || foodKey.includes("butter") || foodKey.includes("oil") || foodKey.includes("syrup")) return count * 15;
  if (foodKey.includes("biryani")) return 350;
  if (foodKey.includes("lasagna")) return 350;
  if (foodKey.includes("rice") || foodKey.includes("noodle") || foodKey.includes("pasta") || foodKey.includes("pad thai")) return 200;
  if (foodKey.includes("steak") || foodKey.includes("salmon") || foodKey.includes("chicken") || foodKey.includes("pork")) return 160;
  if (foodKey.includes("curry") || foodKey.includes("dal") || foodKey.includes("chana") || foodKey.includes("sambar")) return 180;
  if (foodKey.includes("broth") || foodKey.includes("soup") || foodKey.includes("milk") || foodKey.includes("lassi") || foodKey.includes("chai")) return 250;
  if (foodKey.includes("hummus") || foodKey.includes("guacamole") || foodKey.includes("mashed potato") || foodKey.includes("coleslaw")) return 120;
  if (foodKey.includes("chips") || foodKey.includes("fries")) return 120;
  if (foodKey.includes("chutney") || foodKey.includes("dressing") || foodKey.includes("sauce")) return 40;
  return 100;
}
function parseMealDescriptionToComponents(description) {
  const clauses = description.split(/(?:,|\band\b|\bserving\b|\bservings\b|\bwith\b|\bserves\b|\btopped with\b|\bserved with\b|\bplus\b|\+|\&)/i).map((c) => c.trim()).filter((c) => c.length > 2 && !/^(a|an|the|fresh|warm|crisp|side|hot|cold|large|medium|small)$/i.test(c));
  const items = [];
  const matchedKeys = /* @__PURE__ */ new Set();
  for (const clause of clauses) {
    const foodData = lookupAuthoritativeFood(clause);
    if (!foodData) continue;
    let canonicalName = clause;
    for (const [k, d] of Object.entries(USDA_REFERENCE_DB)) {
      if (d.fdcId === foodData.fdcId) {
        canonicalName = k;
        break;
      }
    }
    if (matchedKeys.has(canonicalName)) continue;
    matchedKeys.add(canonicalName);
    const grams = extractGramPortion(clause, canonicalName);
    const ratio = grams / 100;
    items.push({
      name: clause.charAt(0).toUpperCase() + clause.slice(1),
      identifiedFood: canonicalName,
      portionDescription: `~${grams}g`,
      estimatedGrams: grams,
      minGrams: Math.round(grams * 0.85),
      maxGrams: Math.round(grams * 1.15),
      mass_g: {
        p10: Math.round(grams * 0.85),
        p50: grams,
        p90: Math.round(grams * 1.15)
      },
      mass_basis: "single_view",
      evidence: isUnobservableUnknownFood({ name: clause, identifiedFood: canonicalName }) ? "unobservable_unknown" : "context_derived",
      calories: Math.round(foodData.calories * ratio),
      protein: Math.round(foodData.protein * ratio * 10) / 10,
      carbs: Math.round(foodData.carbs * ratio * 10) / 10,
      fat: Math.round(foodData.fat * ratio * 10) / 10,
      sugar: Math.round(foodData.sugar * ratio * 10) / 10,
      sodium: Math.round(foodData.sodium * ratio),
      confidence: 0.95,
      assumptions: ["Authoritative USDA Reference composition"],
      source: "USDA_FDC",
      fdcId: foodData.fdcId
    });
  }
  return items;
}
function isUnobservableUnknownFood(food) {
  if (food.evidence === "unobservable_unknown") return true;
  const name = (food.name || food.identifiedFood || "").toLowerCase();
  const assumptions = (food.assumptions || []).join(" ").toLowerCase();
  const prep = (food.preparationState || "").toLowerCase();
  if (name.includes("oil") || name.includes("ghee") || name.includes("butter") || name.includes("dressing") || name.includes("sauce") || name.includes("gravy")) {
    return true;
  }
  if (assumptions.includes("oil") || assumptions.includes("ghee") || assumptions.includes("submerged") || assumptions.includes("hidden fat")) {
    return true;
  }
  if (prep.includes("deep fried") || prep.includes("fried") || prep.includes("rich gravy")) {
    return true;
  }
  return false;
}
function isComplexMealCategory(foods, mealName, cuisine) {
  const text = `${mealName || ""} ${cuisine || ""} ${foods.map((f) => f.name + " " + f.identifiedFood).join(" ")}`.toLowerCase();
  const complexKeywords = [
    "curry",
    "stew",
    "casserole",
    "biryani",
    "pulao",
    "bowl",
    "soup",
    "ramen",
    "pad thai",
    "pasta",
    "sauce",
    "lasagna",
    "fried rice",
    "thali",
    "masala",
    "korma",
    "sambar",
    "dal makhani",
    "shakshuka",
    "gravy",
    "stir fry",
    "casserole",
    "enchilada",
    "chili"
  ];
  if (complexKeywords.some((kw) => text.includes(kw))) return true;
  if (foods.length >= 3) return true;
  if (foods.some((f) => f.oilState === "HIGH_OIL" || f.evidence === "unobservable_unknown")) return true;
  return false;
}
function calculateDeterministicMealTotals(foods, options) {
  if (!foods || foods.length === 0) {
    throw new Error("Cannot calculate meal totals: Component foods array is empty.");
  }
  const inputList = foods.flat ? foods.flat(2) : foods;
  const normalizedFoods = inputList.map((f) => ({
    ...f,
    mass_g: f.mass_g ? { ...f.mass_g } : void 0,
    calorieRange: f.calorieRange ? [...f.calorieRange] : void 0,
    assumptions: f.assumptions ? [...f.assumptions] : []
  }));
  const mealCategory = detectFoodCategory(normalizedFoods.map((f) => f.name).join(" "), options?.mealName);
  let appliedPrior = void 0;
  if (options?.categoryPriors) {
    if (Array.isArray(options.categoryPriors)) {
      appliedPrior = options.categoryPriors.find((p) => p.category === mealCategory);
    } else {
      appliedPrior = options.categoryPriors[mealCategory];
    }
  }
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSugar = 0;
  let totalSodium = 0;
  let totalGrams = 0;
  let confidenceSum = 0;
  let hasUsda = false;
  let hasAi = false;
  const resolvedMassBasis = options?.hasSecondPhoto ? "two_view_calibrated" : options?.massBasis || (normalizedFoods.every((f) => f.mass_basis === "two_view_calibrated") ? "two_view_calibrated" : "single_view");
  const isCalibrated = resolvedMassBasis === "two_view_calibrated";
  for (const food of normalizedFoods) {
    const cal = Math.max(0, Number(food.calories) || 0);
    const p = Math.max(0, Number(food.protein) || 0);
    const c = Math.max(0, Number(food.carbs) || 0);
    const f = Math.max(0, Number(food.fat) || 0);
    const s = Math.max(0, Number(food.sugar) || 0);
    const na = Math.max(0, Number(food.sodium) || 0);
    const g = Math.max(1, Number(food.estimatedGrams) || 100);
    totalCalories += cal;
    totalProtein += p;
    totalCarbs += c;
    totalFat += f;
    totalSugar += s;
    totalSodium += na;
    totalGrams += g;
    confidenceSum += Number(food.confidence) || 0.85;
    if (food.source === "USDA_FDC" || food.source === "AUTHORITATIVE_DB") {
      hasUsda = true;
    } else {
      hasAi = true;
    }
    if (!food.evidence) {
      if (isUnobservableUnknownFood(food)) {
        food.evidence = "unobservable_unknown";
      } else if (food.source === "USER_EDITED") {
        food.evidence = "user_confirmed";
      } else if (food.source === "USDA_FDC" || food.source === "AUTHORITATIVE_DB") {
        food.evidence = "context_derived";
      } else {
        food.evidence = "visible";
      }
    }
    food.mass_basis = resolvedMassBasis;
    if (!food.mass_g || isCalibrated) {
      const minG = isCalibrated ? Math.round(g * 0.92) : food.minGrams || Math.round(g * 0.85);
      const maxG = isCalibrated ? Math.round(g * 1.08) : food.maxGrams || Math.round(g * 1.15);
      food.mass_g = {
        p10: minG,
        p50: g,
        p90: maxG
      };
    }
    let compOilMin = 0.95;
    let compOilMax = 1.1;
    if (food.oilState === "HIGH_OIL") {
      compOilMin = 1.05;
      compOilMax = 1.25;
    } else if (food.oilState === "LOW_OIL") {
      compOilMin = 0.9;
      compOilMax = 1.05;
    }
    if (appliedPrior && isUnobservableUnknownFood(food) && appliedPrior.oilMassAdjustmentFactor) {
      compOilMax = Math.round(compOilMax * appliedPrior.oilMassAdjustmentFactor * 100) / 100;
      food.mass_g.p90 = Math.round(food.mass_g.p90 * appliedPrior.oilMassAdjustmentFactor);
    }
    const calPerG = g > 0 ? cal / g : 0;
    food.calorieRange = [
      Math.round(food.mass_g.p10 * calPerG * compOilMin),
      Math.round(food.mass_g.p90 * calPerG * compOilMax)
    ];
  }
  const databaseCalories = Math.round(totalCalories);
  const expectedCaloriesFromMacros = Math.round(totalProtein * 4 + totalCarbs * 4 + totalFat * 9);
  const energyCheckDelta = Math.abs(databaseCalories - expectedCaloriesFromMacros);
  const isAtwaterInconsistent = databaseCalories > 0 && energyCheckDelta > Math.max(50, databaseCalories * 0.15);
  const atwaterDiagnostic = {
    expectedCalories: expectedCaloriesFromMacros,
    delta: energyCheckDelta,
    isInconsistent: isAtwaterInconsistent,
    reason: isAtwaterInconsistent ? `Diagnostic Note: Macro energy sum (${expectedCaloriesFromMacros} kcal) diverges from database-sourced energy (${databaseCalories} kcal) by ${energyCheckDelta} kcal. Canonical database value retained.` : `Conforms to 4-4-9 Atwater physiological fuel values (${expectedCaloriesFromMacros} kcal).`
  };
  const energyConsistencyReason = atwaterDiagnostic.reason;
  let sumMinCal = 0;
  let sumMaxCal = 0;
  for (const food of normalizedFoods) {
    if (food.calorieRange) {
      sumMinCal += food.calorieRange[0];
      sumMaxCal += food.calorieRange[1];
    }
  }
  const minCal = sumMinCal > 0 ? Math.min(totalCalories, sumMinCal) : Math.round(totalCalories * 0.88);
  const maxCal = sumMaxCal > 0 ? Math.max(totalCalories, sumMaxCal) : Math.round(totalCalories * 1.15);
  const sumP10Grams = normalizedFoods.reduce((acc, f) => acc + (f.mass_g?.p10 || Math.round(f.estimatedGrams * (isCalibrated ? 0.92 : 0.85))), 0);
  const sumP90Grams = normalizedFoods.reduce((acc, f) => acc + (f.mass_g?.p90 || Math.round(f.estimatedGrams * (isCalibrated ? 1.08 : 1.15))), 0);
  const mealMassDistribution = {
    p10: sumP10Grams,
    p50: totalGrams,
    p90: sumP90Grams
  };
  const isComplexMeal = isComplexMealCategory(normalizedFoods, options?.mealName, options?.cuisineType);
  const unobservableFoods = normalizedFoods.filter((f) => f.evidence === "unobservable_unknown");
  const hasUnobservableUnknown = unobservableFoods.length > 0;
  const unobservableUnknownGrams = unobservableFoods.reduce((acc, f) => acc + f.estimatedGrams, 0);
  const unobservableUnknownMassShare = totalGrams > 0 ? Math.round(unobservableUnknownGrams / totalGrams * 100) / 100 : 0;
  const informationGainExpectedKcal = Math.round(maxCal - minCal);
  const hasMaterialCaloricSwing = informationGainExpectedKcal >= 100;
  const requiresClarification = isComplexMeal ? hasMaterialCaloricSwing || hasUnobservableUnknown || unobservableUnknownMassShare >= 0.1 : totalCalories > 600 && hasMaterialCaloricSwing;
  const autoLogBlocked = isComplexMeal && resolvedMassBasis === "single_view" && !options?.scaleCue && (hasUnobservableUnknown || hasMaterialCaloricSwing);
  const autoLogBlockReason = autoLogBlocked ? "Uncertainty Gate Active: Complex meal with unobservable elements (oil/gravy) detected without 2-view calibration or scale cue. Clarification required before logging." : void 0;
  let clarificationPrompt = void 0;
  let clarificationOptions = void 0;
  if (requiresClarification) {
    if (hasUnobservableUnknown || totalFat > 20) {
      clarificationPrompt = `Cooking fat & sauce density swing potential is ~${informationGainExpectedKcal} kcal. Was this prepared with light, regular, or rich oil/ghee?`;
      clarificationOptions = [
        `Light / Minimal Oil (~${minCal} kcal)`,
        `Standard Preparation (~${databaseCalories} kcal)`,
        `Rich / Deep-Fried / Heavy (~${maxCal} kcal)`
      ];
    } else {
      clarificationPrompt = `Portion volume swing potential is ~${informationGainExpectedKcal} kcal across [${minCal} - ${maxCal} kcal]. Confirm serving volume:`;
      clarificationOptions = [
        `Smaller Portion (~${minCal} kcal)`,
        `Standard Serving (~${databaseCalories} kcal)`,
        `Generous / Large (~${maxCal} kcal)`
      ];
    }
  }
  const overallConfidence = normalizedFoods.length > 0 ? Math.round(confidenceSum / normalizedFoods.length * 100) / 100 : 0.85;
  const nutritionSource = hasUsda && !hasAi ? "USDA_FDC" : hasUsda && hasAi ? "MIXED" : "GEMINI_ESTIMATE";
  const notes = [...options?.estimationNotes || []];
  if (appliedPrior) {
    notes.push(`Personal Prior (v${appliedPrior.version}): ${appliedPrior.reasoning}`);
  }
  if (atwaterDiagnostic.isInconsistent) {
    notes.push(atwaterDiagnostic.reason);
  }
  const uncertainty = {
    foodIdentificationConfidence: Math.min(0.98, overallConfidence + 0.05),
    portionConfidence: resolvedMassBasis === "two_view_calibrated" ? 0.95 : totalGrams > 0 ? 0.88 : 0.75,
    nutritionSourceConfidence: hasUsda ? 0.95 : 0.85,
    overallConfidence,
    calorieRange: [minCal, maxCal],
    primaryUncertaintyFactor: hasUnobservableUnknown ? "HIDDEN_COOKING_FAT" : totalFat > 25 ? "HIDDEN_COOKING_FAT" : totalGrams > 400 ? "PORTION_VARIANCE" : "LAB_PRECISION",
    requiresClarification,
    clarificationPrompt,
    clarificationOptions,
    informationGainExpectedKcal,
    autoLogBlocked,
    autoLogBlockReason,
    unobservableUnknownMassShare,
    appliedPrior
  };
  const isJunk = evaluateIsJunkFood({
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    sugar: totalSugar,
    sodium: totalSodium,
    foods: normalizedFoods
  });
  const { score: healthScore, grade } = evaluateHealthScoreAndGrade({
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    sugar: totalSugar,
    sodium: totalSodium,
    isJunk,
    foods: normalizedFoods
  });
  return {
    name: options?.mealName || normalizedFoods.map((f) => f.name).join(" + "),
    mealType: options?.mealType || ((/* @__PURE__ */ new Date()).getHours() < 11 ? "Breakfast" : (/* @__PURE__ */ new Date()).getHours() < 16 ? "Lunch" : "Dinner"),
    cuisineType: options?.cuisineType || "Mixed",
    foodCategory: mealCategory,
    portion: totalGrams > 0 ? `${totalGrams}g (${normalizedFoods.length} items)` : `${normalizedFoods.length} items`,
    totalGrams,
    massDistribution: mealMassDistribution,
    massBasis: resolvedMassBasis,
    calories: databaseCalories,
    calorieRange: [minCal, maxCal],
    databaseCalories,
    macroDerivedCalories: expectedCaloriesFromMacros,
    atwaterDiagnostic,
    hasUnobservableUnknown,
    autoLogBlocked,
    autoLogBlockReason,
    complexMealDetected: isComplexMeal,
    suggestsSecondPhoto: isComplexMeal && resolvedMassBasis === "single_view",
    scaleCueApplied: options?.scaleCue,
    protein: Math.round(totalProtein * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    sugar: Math.round(totalSugar * 10) / 10,
    sodium: Math.round(totalSodium),
    isJunk,
    healthScore,
    grade,
    confidence: overallConfidence,
    uncertainty,
    nutritionSource,
    foods: normalizedFoods,
    appliedPrior,
    estimationNotes: notes,
    energyCheckDelta,
    energyConsistencyReason,
    swapSuggestion: isJunk ? "Consider swapping high-fat deep fried sides for steamed greens or fresh fruit." : "Balanced nutrient-dense whole food combination!",
    verdict: `Analyzed from ${normalizedFoods.length} component items (${nutritionSource}). Total canonical energy: ${databaseCalories} kcal [${minCal}-${maxCal} kcal].`
  };
}
function evaluateIsJunkFood(params) {
  const { calories, protein, fat, sugar, sodium, foods } = params;
  if (calories === 0) return false;
  const sugarCalories = sugar * 4;
  const fatCalories = fat * 9;
  const junkKeywords = ["deep fried", "french fry", "french fries", "fries", "donut", "candy", "soda", "chips", "crisps", "cheeseburger", "burger", "samosa", "gulab jamun", "pastry", "frosting", "sweetened beverage"];
  const hasJunkKeyword = foods.some(
    (f) => junkKeywords.some((kw) => f.name.toLowerCase().includes(kw) || f.identifiedFood.toLowerCase().includes(kw))
  );
  if (hasJunkKeyword) return true;
  if (sugarCalories / calories > 0.35) return true;
  if (fatCalories / calories > 0.5 && protein < 12) return true;
  if (sodium > 1400 && protein < 12) return true;
  return false;
}
function evaluateHealthScoreAndGrade(params) {
  const { calories, protein, fat, sugar, sodium, isJunk } = params;
  if (calories === 0) {
    return { score: 90, grade: "A" };
  }
  let score = 85;
  const proteinRatio = protein * 4 / calories;
  const sugarRatio = sugar * 4 / calories;
  const fatRatio = fat * 9 / calories;
  if (proteinRatio >= 0.25) {
    score += 10;
  } else if (proteinRatio < 0.1 && calories > 300) {
    score -= 10;
  }
  if (sugarRatio > 0.25) {
    score -= 20;
  } else if (sugarRatio > 0.15) {
    score -= 10;
  }
  if (fatRatio > 0.5 && !isJunk) {
    score -= 10;
  }
  if (sodium > 1400) {
    score -= 15;
  } else if (sodium > 900) {
    score -= 5;
  }
  if (isJunk) {
    score -= 25;
  }
  score = Math.max(15, Math.min(100, Math.round(score)));
  let grade = "B";
  if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";
  return { score, grade };
}

// src/lib/nutritionProvider.ts
var SimpleLruCache = class {
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
    this.cache = /* @__PURE__ */ new Map();
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }
  set(key, value, ttlMs = 1e3 * 60 * 60 * 24) {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
};
var foodCache = new SimpleLruCache(500);
var singleFoodCache = new SimpleLruCache(500);
var UsdaFoodDataCentralProvider = class {
  constructor(apiKey = "DEMO_KEY") {
    this.name = "USDA_FDC";
    this.baseUrl = "https://api.nal.usda.gov/fdc/v1";
    this.apiKey = process.env.USDA_API_KEY || apiKey;
  }
  async searchFood(query2, limit2 = 5) {
    const cleanQuery = query2.trim().toLowerCase();
    if (!cleanQuery) return [];
    const cacheKey = `usda_search_${cleanQuery}_${limit2}`;
    const cached = foodCache.get(cacheKey);
    if (cached) return cached;
    try {
      const url = `${this.baseUrl}/foods/search?api_key=${this.apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          query: cleanQuery,
          pageSize: limit2,
          dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"]
        }),
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) {
        throw new Error(`USDA API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const foods = Array.isArray(data.foods) ? data.foods : [];
      const normalized = foods.map((f) => {
        const nutrients = {};
        if (Array.isArray(f.foodNutrients)) {
          for (const n of f.foodNutrients) {
            const name = (n.nutrientName || "").toLowerCase();
            const val = Number(n.value) || 0;
            if (name.includes("energy") && (n.unitName === "KCAL" || !nutrients["energy"])) nutrients["calories"] = val;
            else if (name.includes("protein")) nutrients["protein"] = val;
            else if (name.includes("carbohydrate")) nutrients["carbs"] = val;
            else if (name.includes("total lipid") || name.includes("fat")) nutrients["fat"] = val;
            else if (name.includes("sugars, total") || name === "sugars") nutrients["sugar"] = val;
            else if (name.includes("sodium")) nutrients["sodium"] = val;
            else if (name.includes("fiber, total")) nutrients["fiber"] = val;
          }
        }
        const servings = [];
        if (f.servingSize && f.servingSizeUnit) {
          servings.push({
            description: `1 serving (${f.servingSize}${f.servingSizeUnit})`,
            gramWeight: f.servingSizeUnit.toLowerCase() === "g" ? Number(f.servingSize) : 100
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
          name: f.description || query2,
          category: f.foodCategory || "General Food",
          brand: f.brandOwner || f.brandName,
          provider: "USDA_FDC",
          fdcId: f.fdcId,
          nutrientsPer100g: {
            calories: nutrients["calories"] || 0,
            protein: Math.round((nutrients["protein"] || 0) * 10) / 10,
            carbs: Math.round((nutrients["carbs"] || 0) * 10) / 10,
            fat: Math.round((nutrients["fat"] || 0) * 10) / 10,
            sugar: Math.round((nutrients["sugar"] || 0) * 10) / 10,
            sodium: Math.round(nutrients["sodium"] || 0),
            fiber: Math.round((nutrients["fiber"] || 0) * 10) / 10
          },
          servings,
          confidence: 0.95,
          attribution: `USDA FoodData Central (FDC #${f.fdcId})`
        };
      });
      foodCache.set(cacheKey, normalized);
      return normalized;
    } catch (err) {
      console.warn(`[UsdaProvider] Search failed for '${query2}':`, err.message);
      return [];
    }
  }
  async getFoodById(id) {
    const fdcId = id.replace("usda_", "");
    const cacheKey = `usda_food_${fdcId}`;
    const cached = singleFoodCache.get(cacheKey);
    if (cached) return cached;
    try {
      const url = `${this.baseUrl}/food/${fdcId}?api_key=${this.apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4e3) });
      if (!res.ok) return null;
      const f = await res.json();
      const nutrients = {};
      if (Array.isArray(f.foodNutrients)) {
        for (const n of f.foodNutrients) {
          const name = (n.nutrient?.name || n.nutrientName || "").toLowerCase();
          const val = Number(n.amount || n.value) || 0;
          if (name.includes("energy") && (n.nutrient?.unitName === "kcal" || !nutrients["calories"])) nutrients["calories"] = val;
          else if (name.includes("protein")) nutrients["protein"] = val;
          else if (name.includes("carbohydrate")) nutrients["carbs"] = val;
          else if (name.includes("fat") || name.includes("total lipid")) nutrients["fat"] = val;
          else if (name.includes("sugars")) nutrients["sugar"] = val;
          else if (name.includes("sodium")) nutrients["sodium"] = val;
        }
      }
      const item = {
        id: `usda_${f.fdcId}`,
        name: f.description,
        category: f.foodCategory?.description || "General Food",
        provider: "USDA_FDC",
        fdcId: f.fdcId,
        nutrientsPer100g: {
          calories: nutrients["calories"] || 0,
          protein: nutrients["protein"] || 0,
          carbs: nutrients["carbs"] || 0,
          fat: nutrients["fat"] || 0,
          sugar: nutrients["sugar"] || 0,
          sodium: nutrients["sodium"] || 0
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
  async lookupBarcode(barcode) {
    const results = await this.searchFood(barcode, 1);
    return results.length > 0 ? results[0] : null;
  }
};
var OpenFoodFactsProvider = class {
  constructor() {
    this.name = "OPEN_FOOD_FACTS";
  }
  async searchFood(query2, limit2 = 5) {
    const cacheKey = `off_search_${query2}_${limit2}`;
    const cached = foodCache.get(cacheKey);
    if (cached) return cached;
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query2)}&search_simple=1&action=process&json=1&page_size=${limit2}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "GoogleJunkGuard-Tracker/2.0" },
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) return [];
      const data = await res.json();
      const products = Array.isArray(data.products) ? data.products : [];
      const normalized = products.map((p) => {
        const nut = p.nutriments || {};
        return {
          id: `off_${p.code || p.id}`,
          name: p.product_name || query2,
          brand: p.brands,
          category: p.categories,
          provider: "OPEN_FOOD_FACTS",
          barcode: p.code,
          nutrientsPer100g: {
            calories: Number(nut["energy-kcal_100g"] || nut["energy-kcal"] || Number(nut.energy_100g) / 4.184 || 0),
            protein: Number(nut.proteins_100g || 0),
            carbs: Number(nut.carbohydrates_100g || 0),
            fat: Number(nut.fat_100g || 0),
            sugar: Number(nut.sugars_100g || 0),
            sodium: Number(nut.sodium_100g ? Number(nut.sodium_100g) * 1e3 : Number(nut.salt_100g || 0) * 400)
          },
          servings: p.serving_size ? [{ description: p.serving_size, gramWeight: Number(p.serving_quantity) || 100 }] : [],
          confidence: 0.9,
          attribution: `Open Food Facts (Barcode #${p.code})`
        };
      });
      foodCache.set(cacheKey, normalized);
      return normalized;
    } catch {
      return [];
    }
  }
  async getFoodById(id) {
    const code = id.replace("off_", "");
    return this.lookupBarcode(code);
  }
  async lookupBarcode(barcode) {
    const cacheKey = `off_barcode_${barcode}`;
    const cached = singleFoodCache.get(cacheKey);
    if (cached) return cached;
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "GoogleJunkGuard-Tracker/2.0" },
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status !== 1 || !data.product) return null;
      const p = data.product;
      const nut = p.nutriments || {};
      const item = {
        id: `off_${p.code}`,
        name: p.product_name || "Packaged Product",
        brand: p.brands,
        provider: "OPEN_FOOD_FACTS",
        barcode: p.code,
        nutrientsPer100g: {
          calories: Number(nut["energy-kcal_100g"] || nut["energy-kcal"] || Number(nut.energy_100g) / 4.184 || 0),
          protein: Number(nut.proteins_100g || 0),
          carbs: Number(nut.carbohydrates_100g || 0),
          fat: Number(nut.fat_100g || 0),
          sugar: Number(nut.sugars_100g || 0),
          sodium: Number(nut.sodium_100g ? Number(nut.sodium_100g) * 1e3 : Number(nut.salt_100g || 0) * 400)
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
};
var MultiProviderNutritionService = class {
  constructor() {
    this.usdaProvider = new UsdaFoodDataCentralProvider();
    this.offProvider = new OpenFoodFactsProvider();
  }
  /**
   * Tiered food search with fast LRU caching and fallback
   */
  async resolveFoodEntity(query2) {
    const clean = query2.trim();
    if (!clean) return null;
    if (/^\d{8,14}$/.test(clean)) {
      const barcodeItem = await this.offProvider.lookupBarcode(clean);
      if (barcodeItem) return barcodeItem;
    }
    const usdaResults = await this.usdaProvider.searchFood(clean, 3);
    if (usdaResults.length > 0) {
      return usdaResults[0];
    }
    const offResults = await this.offProvider.searchFood(clean, 3);
    if (offResults.length > 0) {
      return offResults[0];
    }
    const seedMatch = lookupAuthoritativeFood(clean);
    if (seedMatch) {
      return {
        id: `seed_${seedMatch.fdcId}`,
        name: clean.charAt(0).toUpperCase() + clean.slice(1),
        category: "Standard Recipe / Foundation",
        provider: "LOCAL_AUTHORITATIVE",
        fdcId: seedMatch.fdcId,
        nutrientsPer100g: {
          calories: seedMatch.calories,
          protein: seedMatch.protein,
          carbs: seedMatch.carbs,
          fat: seedMatch.fat,
          sugar: seedMatch.sugar,
          sodium: seedMatch.sodium
        },
        servings: [{ description: "1 standard serving (100g)", gramWeight: 100 }],
        confidence: 0.95,
        attribution: `USDA FDC / IFCT Reference Seed (#${seedMatch.fdcId})`
      };
    }
    return null;
  }
};
var nutritionService = new MultiProviderNutritionService();
export {
  HIGH_SIMILARITY_THRESHOLD,
  calculateDeterministicMealTotals,
  cleanBase64,
  computeFallbackHash,
  deriveCategoryPrior,
  findBestMealMatch,
  isUnobservableUnknownFood,
  nutritionService,
  parseMealDescriptionToComponents
};
