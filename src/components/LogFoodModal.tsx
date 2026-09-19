import React, { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { X, Camera, Upload, Activity, CheckCircle2, ChevronRight, AlertTriangle, Leaf, Search, Barcode, Plus, Utensils, Sparkles, BookPlus } from 'lucide-react';
import { FoodItem, MealType } from '../types';
import { JUNK_FOOD_PRESETS, HEALTHY_FOOD_PRESETS } from '../data/presets';
import { 
  calculateDeterministicMealTotals, 
  updateComponentPortion, 
  removeComponentFromMeal, 
  addComponentToMeal 
} from '../lib/nutritionEngine';

interface LogFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFoodLogged?: () => void;
  dailyJunkCount: number;
  initialTab?: 'camera' | 'search' | 'barcode' | 'presets' | 'recipe';
}

export const LogFoodModal: React.FC<LogFoodModalProps> = ({ 
  isOpen, 
  onClose, 
  onFoodLogged, 
  dailyJunkCount,
  initialTab = 'camera'
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'camera' | 'search' | 'barcode' | 'presets' | 'recipe'>(initialTab);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result state
  const [analyzedData, setAnalyzedData] = useState<any | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('Lunch');

  // Input states
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recipe Builder states
  const [recipeName, setRecipeName] = useState('');
  const [recipeServings, setRecipeServings] = useState(2);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ name: string; amount: string }>>([
    { name: 'Rolled Oats', amount: '1 cup (80g)' },
    { name: 'Whey Protein Powder', amount: '1 scoop (30g)' },
    { name: 'Almond Butter', amount: '1 tbsp (16g)' }
  ]);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsProcessing(false);
    setSuccess(false);
    setError(null);
    setAnalyzedData(null);
    setBase64Image(null);
    setSearchQuery('');
    setBarcodeInput('');
    onClose();
  };

  const getAutoMealType = (): MealType => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Breakfast';
    if (hour >= 11 && hour < 15) return 'Lunch';
    if (hour >= 15 && hour < 18) return 'Snack';
    if (hour >= 18 && hour < 22) return 'Dinner';
    return 'Late Night';
  };

  // 1. Process Image Upload / Camera
  const processImage = async (file: File) => {
    if (!user) return;
    setIsProcessing(true);
    setError(null);
    setSelectedMealType(getAutoMealType());
    
    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 800;
            
            if (width > height && width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            } else {
              reject(new Error("Failed to get canvas context"));
            }
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      setBase64Image(base64String);
      
      let idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        const currentUid = user?.uid || localStorage.getItem('customUserId') || 'athlete_guest';
        idToken = `test-token-${currentUid}`;
      }

      const response = await fetch('/api/ai/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          imageBase64: base64String,
          mimeType: file.type
        })
      });
      
      if (!response.ok) {
        let errMsg = 'AI vision service is unavailable. Please retry in a moment.';
        try {
          const errData = await response.json();
          if (errData?.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || "Failed to analyze image");
      
      setAnalyzedData(resData.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze food");
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Process Text Food Query
  const processTextSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsProcessing(true);
    setError(null);
    setSelectedMealType(getAutoMealType());

    try {
      let idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        const currentUid = user?.uid || localStorage.getItem('customUserId') || 'athlete_guest';
        idToken = `test-token-${currentUid}`;
      }

      const response = await fetch('/api/ai/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ description: searchQuery })
      });

      if (!response.ok) {
        let errMsg = 'Food analysis service is unavailable. Please retry in a moment.';
        try {
          const errData = await response.json();
          if (errData?.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || "Failed to analyze description");
      setAnalyzedData(resData.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze food description");
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Process Barcode Lookup
  const processBarcodeLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) return;
    setIsProcessing(true);
    setError(null);
    setSelectedMealType(getAutoMealType());

    try {
      const response = await fetch(`/api/food/barcode/${encodeURIComponent(code)}`);
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || "Product not found");
      
      setAnalyzedData(resData.data);
      if (resData.data.imageUrl) {
        setBase64Image(resData.data.imageUrl);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Barcode lookup failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Process Recipe Composition
  const processRecipeAnalysis = async () => {
    if (!recipeIngredients.length || recipeIngredients.some(i => !i.name.trim())) {
      setError("Please specify at least one valid ingredient");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setSelectedMealType(getAutoMealType());

    try {
      const response = await fetch('/api/ai/analyze-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeName: recipeName || "Custom Homemade Recipe",
          servings: recipeServings,
          ingredients: recipeIngredients
        })
      });

      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || "Failed to analyze recipe");

      const r = resData.data;
      setAnalyzedData({
        name: r.name,
        portion: `1 serving (1 of ${r.servings})`,
        calories: r.caloriesPerServing,
        protein: r.proteinPerServing,
        carbs: r.carbsPerServing,
        fat: r.fatPerServing,
        sugar: r.sugarPerServing || 0,
        sodium: r.sodiumPerServing || 0,
        category: r.isJunk ? 'junk' : 'healthy',
        isJunk: r.isJunk,
        healthScore: r.healthScore || 90,
        grade: r.grade || 'A',
        verdict: r.summary || 'Custom balanced home-cooked recipe.',
        swapSuggestion: r.prepTips
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze recipe");
    } finally {
      setIsProcessing(false);
    }
  };

  // Select Preset Item
  const handleSelectPreset = (preset: any) => {
    setSelectedMealType(getAutoMealType());
    setAnalyzedData({
      name: preset.name,
      portion: preset.portion,
      calories: preset.calories,
      protein: preset.protein,
      carbs: preset.carbs,
      fat: preset.fat,
      sugar: preset.sugar,
      sodium: preset.sodium,
      category: preset.category,
      isJunk: preset.isJunk,
      healthScore: preset.isJunk ? 35 : 95,
      grade: preset.isJunk ? 'D' : 'A',
      verdict: preset.isJunk ? 'Ultra-processed food preset.' : 'Nutrient-dense whole-food preset.',
      swapSuggestion: preset.isJunk ? 'Pair with leafy greens or choose an unsweetened whole alternative.' : 'Excellent choice for sustaining energy!'
    });
  };

  // Final Confirmation & Write to Firestore
  const confirmAndLog = async () => {
    if (!user || !analyzedData) return;
    setIsProcessing(true);
    setError(null);
    
    try {
      const isJunk = Boolean(analyzedData.isJunk || analyzedData.category === 'junk');

      const logId = `food-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      
      const foodItem: FoodItem = {
        id: logId,
        userId: user.uid,
        name: analyzedData.name || 'Custom Item',
        isJunk,
        calories: Number(analyzedData.calories) || 0,
        minCal: analyzedData.minCal || (analyzedData.uncertainty?.calorieRange ? analyzedData.uncertainty.calorieRange[0] : undefined),
        maxCal: analyzedData.maxCal || (analyzedData.uncertainty?.calorieRange ? analyzedData.uncertainty.calorieRange[1] : undefined),
        protein: Number(analyzedData.protein) || 0,
        carbs: Number(analyzedData.carbs) || 0,
        fat: Number(analyzedData.fat) || 0,
        sugar: Number(analyzedData.sugar) || 0,
        sodium: Number(analyzedData.sodium) || 0,
        date: today,
        mealType: selectedMealType,
        grade: analyzedData.grade || (isJunk ? 'D' : 'A'),
        healthScore: Number(analyzedData.healthScore) || (isJunk ? 40 : 90),
        portion: analyzedData.portion || '1 serving',
        swapSuggestion: analyzedData.swapSuggestion || '',
        verdict: analyzedData.verdict || '',
        createdAt: Date.now(),
        foods: analyzedData.foods || [],
        confidence: Number(analyzedData.confidence) || 0.9,
        uncertainty: analyzedData.uncertainty || undefined,
        nutritionSource: analyzedData.nutritionSource || 'GEMINI_ESTIMATE',
        estimationNotes: analyzedData.estimationNotes || [],
        energyCheckDelta: analyzedData.energyCheckDelta || 0,
        ...(base64Image ? { imageUrl: base64Image } : {})
      };
      
      try {
        const cachedRaw = localStorage.getItem(`foodLogs_${user.uid}_${today}`);
        const existing = cachedRaw ? JSON.parse(cachedRaw) : [];
        localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify([foodItem, ...existing]));

        const cachedWeekly = localStorage.getItem(`weeklyFoodLogs_${user.uid}`);
        const existingWeekly = cachedWeekly ? JSON.parse(cachedWeekly) : [];
        localStorage.setItem(`weeklyFoodLogs_${user.uid}`, JSON.stringify([foodItem, ...existingWeekly]));
      } catch {}

      try {
        await setDoc(doc(db, 'users', user.uid, 'foodLogs', logId), foodItem);
      } catch (firestoreErr) {
        console.warn('Firestore remote sync notice (saved locally):', firestoreErr);
      }
      
      setSuccess(true);
      if (onFoodLogged) onFoodLogged();
      setTimeout(() => {
        handleClose();
      }, 1200);
      
    } catch (err: any) {
      console.warn('Log food error:', err);
      setError(err.message || "Failed to log food");
    } finally {
      setIsProcessing(false);
    }

  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Log Food & Macros</h2>
          </div>
          <button 
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Logging Modality Navigation Tabs (only if not viewing analysis) */}
        {!analyzedData && !success && (
          <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'camera' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'search' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>AI Search</span>
            </button>
            <button
              onClick={() => setActiveTab('barcode')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'barcode' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Barcode</span>
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'presets' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Presets</span>
            </button>
            <button
              onClick={() => setActiveTab('recipe')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'recipe' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookPlus className="w-3.5 h-3.5" />
              <span>Recipe</span>
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl flex items-start gap-2.5 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white">Meal Successfully Logged!</h2>
              <p className="text-xs text-slate-400">Calories, macros, and nutrition score saved to your daily ledger.</p>
            </div>
          ) : isProcessing ? (
            <div className="py-12 text-center space-y-4">
              <Activity className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">Analyzing Nutrition...</h3>
                <p className="text-xs text-slate-400 mt-1">Cross-referencing biochemical database and macro composition.</p>
              </div>
            </div>
          ) : analyzedData ? (
            /* Analysis Confirmation View */
            <div className="space-y-4">
              {base64Image && (
                <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
                  <img src={base64Image} alt="Food" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <div>
                      <h3 className="text-base font-bold text-white drop-shadow-md">{analyzedData.name}</h3>
                      <p className="text-xs text-slate-300 drop-shadow-md">{analyzedData.portion}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm border ${
                      ['A','B'].includes(analyzedData.grade) ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 
                      analyzedData.grade === 'C' ? 'bg-yellow-500 text-slate-950 border-yellow-400' : 
                      'bg-red-500 text-white border-red-400'
                    }`}>
                      {analyzedData.grade}
                    </div>
                  </div>
                </div>
              )}

              {!base64Image && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-white">{analyzedData.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-xs text-slate-400">{analyzedData.portion}</span>
                      {analyzedData.nutritionSource && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                          {analyzedData.nutritionSource === 'USDA_FDC' ? '🏛️ USDA Reference' : analyzedData.nutritionSource === 'BARCODE' ? '📦 Barcode Data' : '🤖 Cloud Nutrition'}
                        </span>
                      )}
                      {(analyzedData.minCal || analyzedData.uncertainty?.calorieRange) && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60">
                          Range: {analyzedData.minCal || analyzedData.uncertainty?.calorieRange?.[0]}–{analyzedData.maxCal || analyzedData.uncertainty?.calorieRange?.[1]} kcal
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-lg font-black text-xs border ${
                    ['A','B'].includes(analyzedData.grade) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                    analyzedData.grade === 'C' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 
                    'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    Grade {analyzedData.grade} • {analyzedData.healthScore}/100
                  </div>
                </div>
              )}

              {/* Detected Component Foods Breakdown */}
              {Array.isArray(analyzedData.foods) && analyzedData.foods.length > 0 && (
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Detected Component Foods ({analyzedData.foods.length})
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {Math.round((analyzedData.confidence || 0.9) * 100)}% Confidence
                    </span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {analyzedData.foods.map((food: any, idx: number) => (
                      <div key={idx} className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs group hover:border-slate-700 transition">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-white truncate">{food.name}</p>
                              {food.source && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {food.source === 'USDA_FDC' ? 'USDA' : food.source === 'USER_EDITED' ? 'Edited' : 'AI'}
                                </span>
                              )}
                              {/* Preparation State Badge */}
                              {food.preparationState && (
                                <button
                                  type="button"
                                  title="Click to cycle preparation state"
                                  onClick={() => {
                                    const nextState = food.preparationState === 'COOKED' ? 'RAW' : food.preparationState === 'RAW' ? 'PREPARED' : 'COOKED';
                                    const updatedFoods = [...analyzedData.foods];
                                    updatedFoods[idx] = { ...food, preparationState: nextState, source: 'USER_EDITED' };
                                    const calc = calculateDeterministicMealTotals(updatedFoods, { mealName: analyzedData.name, mealType: selectedMealType });
                                    setAnalyzedData({
                                      ...analyzedData,
                                      ...calc,
                                      foods: updatedFoods
                                    });
                                  }}
                                  className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 cursor-pointer"
                                >
                                  {food.preparationState === 'COOKED' ? '🍳 Cooked' : food.preparationState === 'RAW' ? '🌱 Raw' : '🥣 Prepared'}
                                </button>
                              )}
                              {/* Cooking Oil Level Badge */}
                              {food.oilState && (
                                <button
                                  type="button"
                                  title="Click to adjust cooking oil level"
                                  onClick={() => {
                                    const nextOil = food.oilState === 'LOW_OIL' ? 'MODERATE_OIL' : food.oilState === 'MODERATE_OIL' ? 'HIGH_OIL' : 'LOW_OIL';
                                    const updatedFoods = [...analyzedData.foods];
                                    updatedFoods[idx] = { ...food, oilState: nextOil, source: 'USER_EDITED' };
                                    const calc = calculateDeterministicMealTotals(updatedFoods, { mealName: analyzedData.name, mealType: selectedMealType });
                                    setAnalyzedData({
                                      ...analyzedData,
                                      ...calc,
                                      foods: updatedFoods
                                    });
                                  }}
                                  className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
                                >
                                  {food.oilState === 'HIGH_OIL' ? '🧈 High Oil' : food.oilState === 'MODERATE_OIL' ? '🍳 Mod Oil' : '💧 Light Oil'}
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {food.portionDescription || `~${food.estimatedGrams}g`}
                              {food.minGrams && food.maxGrams ? ` [${food.minGrams}–${food.maxGrams}g]` : ''}
                              {food.assumptions && food.assumptions.length > 0 ? ` • ${food.assumptions[0]}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Gram Adjustment Controls */}
                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentGrams = Number(food.estimatedGrams) || 100;
                                  const nextGrams = Math.max(10, currentGrams - 25);
                                  const updatedFoods = updateComponentPortion(analyzedData.foods, idx, nextGrams);
                                  const calc = calculateDeterministicMealTotals(updatedFoods, { mealName: analyzedData.name, mealType: selectedMealType });
                                  setAnalyzedData({
                                    ...analyzedData,
                                    calories: calc.calories,
                                    minCal: calc.uncertainty?.calorieRange?.[0],
                                    maxCal: calc.uncertainty?.calorieRange?.[1],
                                    protein: calc.protein,
                                    carbs: calc.carbs,
                                    fat: calc.fat,
                                    sugar: calc.sugar,
                                    sodium: calc.sodium,
                                    totalGrams: calc.totalGrams,
                                    portion: calc.portion,
                                    healthScore: calc.healthScore,
                                    grade: calc.grade,
                                    isJunk: calc.isJunk,
                                    foods: updatedFoods
                                  });
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-1.5 text-[11px] font-bold text-slate-200">
                                {food.estimatedGrams}g
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentGrams = Number(food.estimatedGrams) || 100;
                                  const nextGrams = currentGrams + 25;
                                  const updatedFoods = updateComponentPortion(analyzedData.foods, idx, nextGrams);
                                  const calc = calculateDeterministicMealTotals(updatedFoods, { mealName: analyzedData.name, mealType: selectedMealType });
                                  setAnalyzedData({
                                    ...analyzedData,
                                    calories: calc.calories,
                                    minCal: calc.uncertainty?.calorieRange?.[0],
                                    maxCal: calc.uncertainty?.calorieRange?.[1],
                                    protein: calc.protein,
                                    carbs: calc.carbs,
                                    fat: calc.fat,
                                    sugar: calc.sugar,
                                    sodium: calc.sodium,
                                    totalGrams: calc.totalGrams,
                                    portion: calc.portion,
                                    healthScore: calc.healthScore,
                                    grade: calc.grade,
                                    isJunk: calc.isJunk,
                                    foods: updatedFoods
                                  });
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Remove Component Button */}
                            {analyzedData.foods.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedFoods = removeComponentFromMeal(analyzedData.foods, idx);
                                  const calc = calculateDeterministicMealTotals(updatedFoods, { mealName: analyzedData.name, mealType: selectedMealType });
                                  setAnalyzedData({
                                    ...analyzedData,
                                    calories: calc.calories,
                                    minCal: calc.uncertainty?.calorieRange?.[0],
                                    maxCal: calc.uncertainty?.calorieRange?.[1],
                                    protein: calc.protein,
                                    carbs: calc.carbs,
                                    fat: calc.fat,
                                    sugar: calc.sugar,
                                    sodium: calc.sodium,
                                    totalGrams: calc.totalGrams,
                                    portion: calc.portion,
                                    healthScore: calc.healthScore,
                                    grade: calc.grade,
                                    isJunk: calc.isJunk,
                                    foods: updatedFoods
                                  });
                                }}
                                className="p-1 text-slate-500 hover:text-red-400 transition cursor-pointer"
                                title="Remove ingredient"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1">
                          <span>{food.protein}g Protein • {food.carbs}g Carbs • {food.fat}g Fat</span>
                          <span className="font-bold text-white">{food.calories} kcal</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Quick Component / Oil / Drink Bar */}
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 self-center mr-1">+ Add extra:</span>
                    {[
                      { name: '1 tbsp Ghee/Oil', identifiedFood: 'ghee / clarified butter', estimatedGrams: 14, calories: 123, protein: 0, carbs: 0, fat: 13.9, portionDescription: '1 tbsp (14g)', source: 'USDA_FDC' as const, confidence: 1, preparationState: 'PREPARED' as const, oilState: 'HIGH_OIL' as const, assumptions: ['Added cooking fat'] },
                      { name: '1 Boiled Egg', identifiedFood: 'egg (whole boiled/poached)', estimatedGrams: 50, calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, portionDescription: '1 egg (50g)', source: 'USDA_FDC' as const, confidence: 1, preparationState: 'COOKED' as const, oilState: 'LOW_OIL' as const, assumptions: ['Whole egg'] },
                      { name: 'Side Salad', identifiedFood: 'broccoli (steamed)', estimatedGrams: 100, calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, portionDescription: '1 bowl (100g)', source: 'USDA_FDC' as const, confidence: 1, preparationState: 'RAW' as const, oilState: 'LOW_OIL' as const, assumptions: ['Fresh greens'] },
                      { name: '1/2 Cup Rice', identifiedFood: 'white rice (cooked)', estimatedGrams: 100, calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, portionDescription: '1/2 cup (100g)', source: 'USDA_FDC' as const, confidence: 1, preparationState: 'COOKED' as const, oilState: 'LOW_OIL' as const, assumptions: ['Cooked rice'] }
                    ].map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const updatedFoods = addComponentToMeal(analyzedData.foods || [], item);
                          const calc = calculateDeterministicMealTotals(updatedFoods, { mealName: analyzedData.name, mealType: selectedMealType });
                          setAnalyzedData({
                            ...analyzedData,
                            calories: calc.calories,
                            minCal: calc.uncertainty?.calorieRange?.[0],
                            maxCal: calc.uncertainty?.calorieRange?.[1],
                            protein: calc.protein,
                            carbs: calc.carbs,
                            fat: calc.fat,
                            sugar: calc.sugar,
                            sodium: calc.sodium,
                            totalGrams: calc.totalGrams,
                            portion: calc.portion,
                            healthScore: calc.healthScore,
                            grade: calc.grade,
                            isJunk: calc.isJunk,
                            foods: updatedFoods
                          });
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-emerald-400" />
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Junk vs Clean Classification Toggle */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classification</span>
                  <span className="text-xs font-black text-white">
                    {analyzedData.isJunk ? '🚨 Junk Food / High Reward' : '🥗 Clean Nutrient-Dense Fuel'}
                  </span>
                </div>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAnalyzedData({ ...analyzedData, isJunk: false, category: 'healthy' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      !analyzedData.isJunk ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Clean
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyzedData({ ...analyzedData, isJunk: true, category: 'junk' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      analyzedData.isJunk ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Junk Food
                  </button>
                </div>
              </div>

              {/* Meal Type Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Meal Timing</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Late Night'] as MealType[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMealType(m)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition text-center ${
                        selectedMealType === m
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Portion Scale Adjuster */}
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-bold">Quick Portion Scale:</span>
                <div className="flex gap-1.5">
                  {[0.5, 1, 1.5, 2].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => {
                        const baseCal = analyzedData.baseCalories || analyzedData.calories;
                        const baseP = analyzedData.baseProtein !== undefined ? analyzedData.baseProtein : analyzedData.protein;
                        const baseC = analyzedData.baseCarbs !== undefined ? analyzedData.baseCarbs : analyzedData.carbs;
                        const baseF = analyzedData.baseFat !== undefined ? analyzedData.baseFat : analyzedData.fat;

                        const scaledFoods = Array.isArray(analyzedData.foods) ? analyzedData.foods.map((f: any) => ({
                          ...f,
                          calories: Math.round((f.baseCalories || f.calories) * scale),
                          protein: Math.round((f.baseProtein !== undefined ? f.baseProtein : f.protein) * scale * 10) / 10,
                          carbs: Math.round((f.baseCarbs !== undefined ? f.baseCarbs : f.carbs) * scale * 10) / 10,
                          fat: Math.round((f.baseFat !== undefined ? f.baseFat : f.fat) * scale * 10) / 10,
                          estimatedGrams: Math.round((f.baseGrams || f.estimatedGrams) * scale)
                        })) : [];

                        setAnalyzedData({
                          ...analyzedData,
                          baseCalories: baseCal,
                          baseProtein: baseP,
                          baseCarbs: baseC,
                          baseFat: baseF,
                          calories: Math.round(baseCal * scale),
                          protein: Math.round(baseP * scale * 10) / 10,
                          carbs: Math.round(baseC * scale * 10) / 10,
                          fat: Math.round(baseF * scale * 10) / 10,
                          portion: scale === 1 ? (analyzedData.basePortion || analyzedData.portion) : `${scale}x (${analyzedData.basePortion || analyzedData.portion})`,
                          foods: scaledFoods.length > 0 ? scaledFoods : analyzedData.foods
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800 transition hover:text-white"
                    >
                      {scale}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Macro Cards with Direct Number Editing */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Calories</p>
                  <input
                    type="number"
                    value={analyzedData.calories}
                    onChange={(e) => setAnalyzedData({ ...analyzedData, calories: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-white py-1 mt-1 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">kcal</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-blue-400 uppercase">Protein</p>
                  <input
                    type="number"
                    value={analyzedData.protein}
                    onChange={(e) => setAnalyzedData({ ...analyzedData, protein: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-blue-400 py-1 mt-1 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">g</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-yellow-400 uppercase">Carbs</p>
                  <input
                    type="number"
                    value={analyzedData.carbs}
                    onChange={(e) => setAnalyzedData({ ...analyzedData, carbs: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-yellow-400 py-1 mt-1 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">g</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-red-400 uppercase">Fat</p>
                  <input
                    type="number"
                    value={analyzedData.fat}
                    onChange={(e) => setAnalyzedData({ ...analyzedData, fat: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-red-400 py-1 mt-1 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">g</span>
                </div>
              </div>

              {/* Verdict & Health Alert */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 space-y-2">
                <p><strong className="text-white">Analysis:</strong> {analyzedData.verdict}</p>
                {(analyzedData.isJunk || analyzedData.category === 'junk') && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-2.5 rounded-lg text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Junk Food Notice:</strong> Counts towards your 1 daily junk meal allowance.</span>
                  </div>
                )}
                {analyzedData.swapSuggestion && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-2.5 rounded-lg text-xs flex items-start gap-2">
                    <Leaf className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Healthy Tip:</strong> {analyzedData.swapSuggestion}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAnalyzedData(null)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition text-xs"
                >
                  Re-scan
                </button>
                <button 
                  onClick={confirmAndLog}
                  className="w-2/3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                >
                  <span>Confirm & Save Log</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Modality Tabs */
            <>
              {/* TAB 1: Camera / Image */}
              {activeTab === 'camera' && (
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Visual Food Scanner</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Snap your plate or package. Gemini AI will instantly calculate calories and check if it's clean or junk.
                    </p>
                  </div>

                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
                  />

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold p-4 rounded-2xl transition flex flex-col items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-xs">Take Photo</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                          setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 1000);
                        }
                      }}
                      className="bg-slate-950 hover:bg-slate-800 text-white font-bold p-4 rounded-2xl transition flex flex-col items-center justify-center gap-2 border border-slate-800"
                    >
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-xs">Upload Image</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: AI Natural Language Search */}
              {activeTab === 'search' && (
                <form onSubmit={processTextSearch} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Describe Meal or Food</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 2 slices whole wheat toast with 2 poached eggs and avocado..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 pr-10"
                        autoFocus
                      />
                      <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 <strong>AI Tip:</strong> You can enter complex composite meals like <span className="text-emerald-400">"Medium chicken burrito bowl with brown rice, black beans, salsa and guacamole"</span>.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={!searchQuery.trim()}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                  >
                    <span>Analyze Food with AI</span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* TAB 3: Barcode Database Lookup */}
              {activeTab === 'barcode' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enter UPC / EAN Barcode Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 5449000000996 or 3017620422003"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => processBarcodeLookup()}
                        disabled={!barcodeInput.trim()}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 rounded-xl transition text-xs shadow-sm"
                      >
                        Lookup
                      </button>
                    </div>
                  </div>

                  {/* Sample test barcodes */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Barcode Examples (Open Food Facts Database):</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBarcodeInput('5449000000996');
                          processBarcodeLookup('5449000000996');
                        }}
                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 p-2.5 rounded-xl text-left transition"
                      >
                        <p className="text-xs font-bold text-white">Coca-Cola (Can)</p>
                        <p className="text-[10px] text-red-400 font-mono">5449000000996 • Junk</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBarcodeInput('3017620422003');
                          processBarcodeLookup('3017620422003');
                        }}
                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 p-2.5 rounded-xl text-left transition"
                      >
                        <p className="text-xs font-bold text-white">Nutella Spread</p>
                        <p className="text-[10px] text-amber-400 font-mono">3017620422003 • Junk</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Presets Library */}
              {activeTab === 'presets' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Clean & Healthy Presets</span>
                      <span className="text-[10px] text-slate-500">Tap to log</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {HEALTHY_FOOD_PRESETS.slice(0, 4).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className="bg-slate-950 hover:border-emerald-500/40 border border-slate-800 p-2.5 rounded-xl text-left transition flex items-center gap-2"
                        >
                          <span className="text-xl">{p.emoji}</span>
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-emerald-400">{p.calories} kcal • {p.protein}g P</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Junk Food Presets</span>
                      <span className="text-[10px] text-slate-500">Counts to 1/day limit</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {JUNK_FOOD_PRESETS.slice(0, 4).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          className="bg-slate-950 hover:border-amber-500/40 border border-slate-800 p-2.5 rounded-xl text-left transition flex items-center gap-2"
                        >
                          <span className="text-xl">{p.emoji}</span>
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-amber-400">{p.calories} kcal • {p.sugar}g Sugar</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Custom Recipe Builder */}
              {activeTab === 'recipe' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Recipe Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Protein Overnight Oats"
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Servings</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={recipeServings}
                        onChange={(e) => setRecipeServings(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ingredients</label>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {recipeIngredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Ingredient name"
                            value={ing.name}
                            onChange={(e) => {
                              const newArr = [...recipeIngredients];
                              newArr[idx].name = e.target.value;
                              setRecipeIngredients(newArr);
                            }}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Amount (e.g. 100g)"
                            value={ing.amount}
                            onChange={(e) => {
                              const newArr = [...recipeIngredients];
                              newArr[idx].amount = e.target.value;
                              setRecipeIngredients(newArr);
                            }}
                            className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                          />
                          {recipeIngredients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
                              className="text-slate-500 hover:text-red-400 p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setRecipeIngredients([...recipeIngredients, { name: '', amount: '1 portion' }])}
                      className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Ingredient</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={processRecipeAnalysis}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-sm"
                  >
                    <span>Calculate Recipe Serving Macros</span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

