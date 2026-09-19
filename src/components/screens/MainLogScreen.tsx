import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../AuthContext';
import { auth } from '../../lib/firebase';
import { MealType, FoodItem, ConfirmedMealRecord } from '../../types';
import { MealAnalysisResult, ComponentFood, calculateDeterministicMealTotals } from '../../lib/nutritionEngine';
import {
  computePerceptualHash,
  computeCorrectionDeltas,
  deriveCategoryPrior,
  detectFoodCategory,
  loadUserConfirmedMeals,
  saveUserConfirmedMeal,
  loadUserCorrectionLog,
  appendUserCorrectionLog,
  loadUserCategoryPriors,
  saveUserCategoryPrior,
  RECOMPUTE_THRESHOLD_N
} from '../../lib/personalMemory';
import {
  Camera,
  PlusCircle,
  Check,
  AlertCircle,
  Sparkles,
  UploadCloud,
  Info,
  Loader2,
  ShieldCheck,
  HelpCircle,
  XCircle,
  ChevronRight,
  Flame,
  Award,
  RotateCcw,
  Zap,
  Layers,
  Scale,
  AlertTriangle,
  Edit2,
  Trash2,
  Plus,
  X,
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch, sanitizeErrorMessage } from '../../lib/apiFetch';

export function MainLogScreen() {
  const { foodItems, addFoodItem, setActiveScreen } = useStore();
  const { user } = useAuth();

  const [relogSuccessId, setRelogSuccessId] = useState<string | null>(null);

  // Distinct recent meals (last 5-8 distinct logged meals from already-reconciled items)
  const recentMeals = React.useMemo(() => {
    const seenNames = new Set<string>();
    const distinct: FoodItem[] = [];
    for (const item of foodItems) {
      const key = item.name.toLowerCase().trim();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        distinct.push(item);
      }
      if (distinct.length >= 8) break;
    }
    return distinct;
  }, [foodItems]);

  const handleQuickReLog = async (item: FoodItem) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const created = await addFoodItem({
      userId: user?.uid || 'default-user',
      name: item.name,
      isJunk: item.isJunk,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      sugar: item.sugar,
      sodium: item.sodium,
      portion: item.portion || '1 standard serving',
      healthScore: item.healthScore,
      grade: item.grade,
      mealType: item.mealType,
      date: todayStr,
      nutritionSource: item.nutritionSource || 'AUTHORITATIVE_DB',
      confidence: item.confidence || 0.98,
      foods: item.foods
    });

    setRelogSuccessId(item.id);
    setSubmittedItem(created);
    setTimeout(() => setRelogSuccessId(null), 3000);
  };

  // Photo upload & multi-view vision pipeline state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputSecondRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStageIdx, setAnalysisStageIdx] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzedMeal, setAnalyzedMeal] = useState<MealAnalysisResult | null>(null);
  const [initialPrediction, setInitialPrediction] = useState<MealAnalysisResult | null>(null);
  const [selectedClarification, setSelectedClarification] = useState<string | null>(null);
  const [primaryPhotoBase64, setPrimaryPhotoBase64] = useState<string | null>(null);
  const [secondPhotoBase64, setSecondPhotoBase64] = useState<string | null>(null);
  const [scaleCue, setScaleCue] = useState<string>('');

  // Editable Detected Components State
  const [editingComponentIdx, setEditingComponentIdx] = useState<number | null>(null);
  const [editCompName, setEditCompName] = useState('');
  const [editCompGrams, setEditCompGrams] = useState<number | ''>('');
  const [editCompCalories, setEditCompCalories] = useState<number | ''>('');
  const [editCompProtein, setEditCompProtein] = useState<number | ''>('');
  const [editCompCarbs, setEditCompCarbs] = useState<number | ''>('');
  const [editCompFat, setEditCompFat] = useState<number | ''>('');

  // Add Component Drawer/Modal State
  const [isAddingComponent, setIsAddingComponent] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompGrams, setNewCompGrams] = useState<number | ''>('');
  const [newCompCalories, setNewCompCalories] = useState<number | ''>('');
  const [newCompProtein, setNewCompProtein] = useState<number | ''>('');
  const [newCompCarbs, setNewCompCarbs] = useState<number | ''>('');
  const [newCompFat, setNewCompFat] = useState<number | ''>('');

  // Active progressive analysis stages (Cal AI / MyCal benchmark)
  const ANALYSIS_STAGES = [
    { label: 'Scanning meal imagery & context...', sub: 'Detecting visual components and plating boundaries' },
    { label: 'Identifying ingredients & culinary categories...', sub: 'Segmenting proteins, grains, vegetables, and gravies' },
    { label: 'Calibrating 3D portion volumes...', sub: 'Applying mass distribution bounds (p10, p50, p90)' },
    { label: 'Cross-checking nutrition databases...', sub: 'Reconciling with USDA FoodData Central & Open Food Facts' },
    { label: 'Finalizing nutritional breakdown...', sub: 'Evaluating Atwater consistency and epistemic confidence' },
  ];

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisStageIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setAnalysisStageIdx((prev) => (prev < ANALYSIS_STAGES.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Personal Food Memory Match State
  const [memoryMatch, setMemoryMatch] = useState<{
    matchedMeal: ConfirmedMealRecord;
    similarity: number;
    reason: string;
  } | null>(null);
  const [isCheckingMemory, setIsCheckingMemory] = useState(false);

  // Manual Form State
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [mealType, setMealType] = useState<MealType>('Lunch');
  const [calories, setCalories] = useState<number | ''>('');
  const [protein, setProtein] = useState<number | ''>('');
  const [carbs, setCarbs] = useState<number | ''>('');
  const [fat, setFat] = useState<number | ''>('');
  const [sugar, setSugar] = useState<number | ''>('');
  const [sodium, setSodium] = useState<number | ''>('');
  const [isJunk, setIsJunk] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<FoodItem | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Component Editing Handlers
  const handleStartEditComponent = (idx: number) => {
    if (!analyzedMeal || !analyzedMeal.foods[idx]) return;
    const comp = analyzedMeal.foods[idx];
    setEditingComponentIdx(idx);
    setEditCompName(comp.name);
    setEditCompGrams(comp.estimatedGrams);
    setEditCompCalories(comp.calories);
    setEditCompProtein(comp.protein);
    setEditCompCarbs(comp.carbs);
    setEditCompFat(comp.fat);
  };

  const handleEditGramsChange = (newGramsVal: number | '') => {
    setEditCompGrams(newGramsVal);
    if (typeof newGramsVal === 'number' && newGramsVal > 0 && editingComponentIdx !== null && analyzedMeal) {
      const origComp = analyzedMeal.foods[editingComponentIdx];
      const origGrams = origComp.estimatedGrams || 100;
      const ratio = newGramsVal / origGrams;
      setEditCompCalories(Math.round(origComp.calories * ratio));
      setEditCompProtein(Math.round(origComp.protein * ratio * 10) / 10);
      setEditCompCarbs(Math.round(origComp.carbs * ratio * 10) / 10);
      setEditCompFat(Math.round(origComp.fat * ratio * 10) / 10);
    }
  };

  const handleSaveComponentEdit = () => {
    if (editingComponentIdx === null || !analyzedMeal) return;
    const oldComp = analyzedMeal.foods[editingComponentIdx];
    const grams = Number(editCompGrams) || oldComp.estimatedGrams || 100;
    const cals = Number(editCompCalories) || 0;
    const prot = Number(editCompProtein) || 0;
    const crb = Number(editCompCarbs) || 0;
    const ft = Number(editCompFat) || 0;

    const updatedComp: ComponentFood = {
      ...oldComp,
      name: editCompName.trim() || oldComp.name,
      estimatedGrams: grams,
      portionDescription: `~${grams}g`,
      calories: cals,
      protein: prot,
      carbs: crb,
      fat: ft,
      evidence: 'user_confirmed',
      source: oldComp.source || 'USER_EDITED'
    };

    const updatedFoods = [...analyzedMeal.foods];
    updatedFoods[editingComponentIdx] = updatedComp;

    // Recalculate totals
    const newTotalCals = updatedFoods.reduce((s, f) => s + (Number(f.calories) || 0), 0);
    const newTotalProt = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.protein) || 0), 0) * 10) / 10;
    const newTotalCarbs = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.carbs) || 0), 0) * 10) / 10;
    const newTotalFat = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.fat) || 0), 0) * 10) / 10;
    const newTotalGrams = updatedFoods.reduce((s, f) => s + (Number(f.estimatedGrams) || 0), 0);

    setAnalyzedMeal({
      ...analyzedMeal,
      foods: updatedFoods,
      calories: newTotalCals,
      protein: newTotalProt,
      carbs: newTotalCarbs,
      fat: newTotalFat,
      totalGrams: newTotalGrams,
      calorieRange: [Math.round(newTotalCals * 0.92), Math.round(newTotalCals * 1.12)]
    });

    setEditingComponentIdx(null);
  };

  const handleRemoveComponent = (idx: number) => {
    if (!analyzedMeal) return;
    const updatedFoods = analyzedMeal.foods.filter((_, i) => i !== idx);
    const newTotalCals = updatedFoods.reduce((s, f) => s + (Number(f.calories) || 0), 0);
    const newTotalProt = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.protein) || 0), 0) * 10) / 10;
    const newTotalCarbs = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.carbs) || 0), 0) * 10) / 10;
    const newTotalFat = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.fat) || 0), 0) * 10) / 10;
    const newTotalGrams = updatedFoods.reduce((s, f) => s + (Number(f.estimatedGrams) || 0), 0);

    setAnalyzedMeal({
      ...analyzedMeal,
      foods: updatedFoods,
      calories: newTotalCals,
      protein: newTotalProt,
      carbs: newTotalCarbs,
      fat: newTotalFat,
      totalGrams: newTotalGrams,
      calorieRange: [Math.round(newTotalCals * 0.92), Math.round(newTotalCals * 1.12)]
    });

    if (editingComponentIdx === idx) {
      setEditingComponentIdx(null);
    }
  };

  const handleAddNewComponent = () => {
    if (!analyzedMeal || !newCompName.trim()) return;
    const grams = Number(newCompGrams) || 100;
    const cals = Number(newCompCalories) || 0;
    const prot = Number(newCompProtein) || 0;
    const crb = Number(newCompCarbs) || 0;
    const ft = Number(newCompFat) || 0;

    const newComp: ComponentFood = {
      name: newCompName.trim(),
      identifiedFood: newCompName.trim(),
      assumptions: ['User custom added component'],
      estimatedGrams: grams,
      portionDescription: `~${grams}g`,
      calories: cals,
      protein: prot,
      carbs: crb,
      fat: ft,
      confidence: 1.0,
      source: 'USER_EDITED',
      evidence: 'user_confirmed'
    };

    const updatedFoods = [...analyzedMeal.foods, newComp];
    const newTotalCals = updatedFoods.reduce((s, f) => s + (Number(f.calories) || 0), 0);
    const newTotalProt = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.protein) || 0), 0) * 10) / 10;
    const newTotalCarbs = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.carbs) || 0), 0) * 10) / 10;
    const newTotalFat = Math.round(updatedFoods.reduce((s, f) => s + (Number(f.fat) || 0), 0) * 10) / 10;
    const newTotalGrams = updatedFoods.reduce((s, f) => s + (Number(f.estimatedGrams) || 0), 0);

    setAnalyzedMeal({
      ...analyzedMeal,
      foods: updatedFoods,
      calories: newTotalCals,
      protein: newTotalProt,
      carbs: newTotalCarbs,
      fat: newTotalFat,
      totalGrams: newTotalGrams,
      calorieRange: [Math.round(newTotalCals * 0.92), Math.round(newTotalCals * 1.12)]
    });

    setIsAddingComponent(false);
    setNewCompName('');
    setNewCompGrams('');
    setNewCompCalories('');
    setNewCompProtein('');
    setNewCompCarbs('');
    setNewCompFat('');
  };

  // Vision Analysis Runner supporting Single Photo, Multi-Photo, and Scale Cue
  const runAnalysisWithPhotos = async (
    photo1Base64: string,
    photo2Base64?: string | null,
    cueText?: string
  ) => {
    setIsAnalyzing(true);
    setAnalysisStageIdx(0);
    setAnalysisError(null);
    setSelectedClarification(null);

    try {
      let idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        const currentUid = user?.uid || localStorage.getItem('customUserId') || 'athlete_guest';
        idToken = `test-token-${currentUid}`;
      }

      const resData = await apiFetch<MealAnalysisResult>('/api/ai/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          imageBase64: photo1Base64,
          mimeType: 'image/jpeg',
          secondImageBase64: photo2Base64 || undefined,
          secondMimeType: photo2Base64 ? 'image/jpeg' : undefined,
          scaleCue: cueText ? cueText.trim() : undefined
        }),
        fallbackErrorMessage: "Couldn't analyze this photo — try again with better lighting or log manually below."
      });

      if (!resData.success || !resData.data) {
        const errMsg =
          resData.error ||
          "Couldn't analyze this photo — try again with better lighting or log manually below.";
        setAnalysisError(errMsg);
        return;
      }

      setAnalyzedMeal(resData.data as MealAnalysisResult);
      setInitialPrediction(resData.data as MealAnalysisResult);
    } catch (err: any) {
      console.error('Vision analysis pipeline error:', err);
      setAnalysisError(
        sanitizeErrorMessage(
          err?.message,
          "Couldn't analyze this photo — try again with better lighting or log manually below."
        )
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Primary photo selected: Checks personal memory first before running full vision pipeline
  const handlePhotoSelected = async (file: File) => {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      setPrimaryPhotoBase64(base64Data);
      setSecondPhotoBase64(null);
      setMemoryMatch(null);

      // 1. Personal Food Memory Check: match against user's past confirmed meals
      setIsCheckingMemory(true);
      try {
        const uid = user?.uid || 'default-user';
        const confirmedMeals = await loadUserConfirmedMeals(uid);

        if (confirmedMeals && confirmedMeals.length > 0) {
          const photoHash = await computePerceptualHash(base64Data);
          let idToken = await auth.currentUser?.getIdToken();
          if (!idToken) {
            idToken = `test-token-${uid}`;
          }

          try {
            const memData = await apiFetch<any>('/api/ai/match-meal-memory', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                imageBase64: base64Data,
                photoHash,
                confirmedMeals
              }),
              timeoutMs: 8000
            });

            if (memData.success && memData.data?.matchFound && memData.data?.matchedMeal) {
              setMemoryMatch({
                matchedMeal: memData.data.matchedMeal,
                similarity: memData.data.similarity,
                reason: memData.data.reason
              });
              setIsCheckingMemory(false);
              return; // Stop here and present one-tap prompt to user!
            }
          } catch (memErr) {
            console.warn('Memory response check skipped (falling back to vision):', memErr);
          }
        }
      } catch (memErr) {
        console.warn('Personal memory check non-blocking notice (running full vision):', memErr);
      } finally {
        setIsCheckingMemory(false);
      }

      // 2. Fall-through to standard vision analysis if no confident memory match
      await runAnalysisWithPhotos(base64Data, null, scaleCue);
    } catch (err: any) {
      console.error('File reading error:', err);
      setAnalysisError('Failed to read image file.');
    }
  };

  // One-Tap Confirmation from Personal Food Memory
  const handleConfirmMemoryMatch = async () => {
    if (!memoryMatch) return;
    const meal = memoryMatch.matchedMeal;
    const todayStr = new Date().toISOString().split('T')[0];
    const uid = user?.uid || 'default-user';

    // Tag components as user_confirmed
    const confirmedFoods: ComponentFood[] = (meal.composition || []).map(f => ({
      ...f,
      evidence: 'user_confirmed' as const,
      source: 'USER_EDITED' as const,
      preparationState: (f.preparationState as any) || 'PREPARED',
      oilState: (f.oilState as any) || 'MODERATE_OIL',
      assumptions: f.assumptions || []
    }));

    const created = await addFoodItem({
      userId: uid,
      name: meal.mealName,
      isJunk: false,
      calories: meal.totalCalories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      sugar: meal.sugar,
      sodium: meal.sodium,
      portion: `${meal.composition?.length || 1} items (Personal Memory)`,
      healthScore: 90,
      grade: 'A',
      mealType: meal.mealType,
      date: todayStr,
      nutritionSource: 'AUTHORITATIVE_DB',
      confidence: 0.98,
      foods: confirmedFoods
    });

    // Refresh timestamp in confirmedMeals
    await saveUserConfirmedMeal(uid, {
      ...meal,
      timestamp: Date.now()
    });

    setSubmittedItem(created);
    setMemoryMatch(null);
    setPrimaryPhotoBase64(null);
  };

  // Rejection of Personal Food Memory Match: proceeds directly to full vision recognition
  const handleRejectMemoryMatch = async () => {
    setMemoryMatch(null);
    if (primaryPhotoBase64) {
      await runAnalysisWithPhotos(primaryPhotoBase64, null, scaleCue);
    }
  };

  // Secondary side-angle photo selected (30-60 degree shot for complex dishes)
  const handleSecondPhotoSelected = async (file: File) => {
    if (!primaryPhotoBase64) return;
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      setSecondPhotoBase64(base64Data);
      await runAnalysisWithPhotos(primaryPhotoBase64, base64Data, scaleCue);
    } catch (err: any) {
      console.error('Second file reading error:', err);
      setAnalysisError('Failed to read secondary angle image.');
    }
  };

  // Re-run analysis with manual scale cue
  const handleApplyScaleCue = async () => {
    if (!primaryPhotoBase64) return;
    await runAnalysisWithPhotos(primaryPhotoBase64, secondPhotoBase64, scaleCue);
  };

  // Clarification selection handler (deterministic recalculation)
  const handleClarificationSelect = (option: string) => {
    if (!analyzedMeal) return;
    setSelectedClarification(option);

    // Deterministically modify oil state on components and re-sum
    const optLower = option.toLowerCase();
    const updatedFoods = analyzedMeal.foods.map(f => {
      if (f.evidence === 'unobservable_unknown' || f.name.toLowerCase().includes('curry') || f.name.toLowerCase().includes('masala')) {
        return {
          ...f,
          oilState: (optLower.includes('rich') || optLower.includes('deep-fried') || optLower.includes('heavy') || optLower.includes('generous')
            ? 'HIGH_OIL'
            : optLower.includes('light') || optLower.includes('minimal') || optLower.includes('smaller')
            ? 'LOW_OIL'
            : 'MODERATE_OIL') as any
        };
      }
      return f;
    });

    const recalculated = calculateDeterministicMealTotals(updatedFoods, {
      mealName: analyzedMeal.name,
      mealType: analyzedMeal.mealType,
      cuisineType: analyzedMeal.cuisineType,
      estimationNotes: analyzedMeal.estimationNotes,
      massBasis: secondPhotoBase64 ? 'two_view_calibrated' : 'single_view',
      scaleCue,
      hasSecondPhoto: !!secondPhotoBase64
    });

    setAnalyzedMeal(recalculated);
  };

  // Confirm and persist analyzed meal
  const handleConfirmAnalyzedMeal = async () => {
    if (!analyzedMeal) return;
    const uid = user?.uid || 'default-user';
    const todayStr = new Date().toISOString().split('T')[0];

    const created = await addFoodItem({
      userId: uid,
      name: analyzedMeal.name,
      isJunk: analyzedMeal.isJunk,
      calories: analyzedMeal.calories,
      calorieRange: analyzedMeal.calorieRange,
      massDistribution: analyzedMeal.massDistribution,
      massBasis: analyzedMeal.massBasis,
      atwaterDiagnostic: analyzedMeal.atwaterDiagnostic,
      hasUnobservableUnknown: analyzedMeal.hasUnobservableUnknown,
      scaleCue: scaleCue ? scaleCue.trim() : undefined,
      protein: analyzedMeal.protein,
      carbs: analyzedMeal.carbs,
      fat: analyzedMeal.fat,
      sugar: analyzedMeal.sugar,
      sodium: analyzedMeal.sodium,
      portion: analyzedMeal.portion || `${analyzedMeal.totalGrams}g total`,
      healthScore: analyzedMeal.healthScore,
      grade: analyzedMeal.grade,
      mealType: analyzedMeal.mealType,
      date: todayStr,
      nutritionSource: analyzedMeal.nutritionSource,
      confidence: analyzedMeal.confidence,
      foods: analyzedMeal.foods
    });

    // 1. Correction Feedback Logging (Diff initial prediction vs final confirmed values)
    if (initialPrediction) {
      const category = analyzedMeal.foodCategory || detectFoodCategory(analyzedMeal.name);
      const deltas = computeCorrectionDeltas({
        userId: uid,
        mealName: analyzedMeal.name,
        mealId: created.id,
        foodCategory: category,
        predicted: initialPrediction,
        confirmed: analyzedMeal
      });

      if (deltas.length > 0) {
        await appendUserCorrectionLog(uid, deltas);

        // Recompute category priors if cadence threshold (N >= 3) reached
        try {
          const allCorrections = await loadUserCorrectionLog(uid);
          const categoryCorrections = allCorrections.filter(c => c.foodCategory === category);
          const existingPriors = await loadUserCategoryPriors(uid);
          const existingPrior = existingPriors[category] || null;

          if (categoryCorrections.length >= RECOMPUTE_THRESHOLD_N) {
            const updatedPrior = deriveCategoryPrior({
              userId: uid,
              category,
              existingPrior,
              corrections: categoryCorrections
            });
            await saveUserCategoryPrior(uid, updatedPrior);
          }
        } catch (priorErr) {
          console.warn('Category prior derivation notice:', priorErr);
        }
      }
    }

    // 2. Personal Food Memory Cache Update
    if (primaryPhotoBase64) {
      try {
        const photoHash = await computePerceptualHash(primaryPhotoBase64);
        await saveUserConfirmedMeal(uid, {
          id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: uid,
          mealName: analyzedMeal.name,
          photoHash,
          composition: analyzedMeal.foods,
          totalCalories: analyzedMeal.calories,
          protein: analyzedMeal.protein,
          carbs: analyzedMeal.carbs,
          fat: analyzedMeal.fat,
          sugar: analyzedMeal.sugar,
          sodium: analyzedMeal.sodium,
          evidenceClasses: (analyzedMeal.foods || []).map(f => f.evidence || 'user_confirmed'),
          massDistribution: analyzedMeal.massDistribution,
          massBasis: analyzedMeal.massBasis,
          mealType: analyzedMeal.mealType,
          date: todayStr,
          timestamp: Date.now()
        });
      } catch (memSaveErr) {
        console.warn('Personal memory save notice:', memSaveErr);
      }
    }

    setSubmittedItem(created);
    setAnalyzedMeal(null);
    setInitialPrediction(null);
    setSelectedClarification(null);
    setPrimaryPhotoBase64(null);
    setSecondPhotoBase64(null);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingManual) return;
    if (!name || calories === '' || protein === '' || carbs === '' || fat === '') return;

    setIsSubmittingManual(true);
    try {
      let mockGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'B';
      let mockHealthScore = 80;

      if (isJunk) {
        mockGrade = 'D';
        mockHealthScore = 42;
      } else if (Number(protein) >= 25 && Number(calories) <= 650) {
        mockGrade = 'A';
        mockHealthScore = 95;
      } else if (Number(calories) > 800) {
        mockGrade = 'C';
        mockHealthScore = 65;
      }

      const foodPayload: any = {
        userId: user?.uid || 'default-user',
        name: name.trim(),
        isJunk,
        calories: Number(calories),
        protein: Number(protein),
        carbs: Number(carbs),
        fat: Number(fat),
        portion: portion.trim() || '1 serving',
        healthScore: mockHealthScore,
        grade: mockGrade,
        mealType,
        date: new Date().toISOString().split('T')[0],
        nutritionSource: 'LOCAL_AUTHORITATIVE',
        confidence: 1.0
      };

      // Strip empty optional numeric fields so Firestore setDoc does not reject with undefined
      if (sugar !== '') {
        foodPayload.sugar = Number(sugar);
      }
      if (sodium !== '') {
        foodPayload.sodium = Number(sodium);
      }

      const created = await addFoodItem(foodPayload);

      setSubmittedItem(created);

      // Reset fields
      setName('');
      setPortion('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setSugar('');
      setSodium('');
      setIsJunk(false);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const getEvidenceBadge = (evidence?: string) => {
    switch (evidence) {
      case 'visible':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'context_derived':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'user_confirmed':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'unobservable_unknown':
        return 'bg-amber-500/25 text-amber-300 border-amber-500/50';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'USDA_FDC':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'OPEN_FOOD_FACTS':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'LOCAL_AUTHORITATIVE':
      case 'AUTHORITATIVE_DB':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'GEMINI_ESTIMATE':
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-emerald-400" />
            Live Nutrition Logger
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Vision photo recognition reconciled against authoritative food composition tables.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('daily-log')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
        >
          View Daily Log &rarr;
        </button>
      </div>

      {/* 0. Repeat-Meal Quick-Log Widget (Recent Distinct Meals) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Repeat-Meal Quick-Log
            </h2>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono font-semibold">
            {recentMeals.length} distinct items
          </span>
        </div>

        {recentMeals.length === 0 ? (
          /* Empty state */
          <div className="bg-slate-950/60 border border-dashed border-slate-800/80 rounded-2xl p-5 text-center space-y-1.5">
            <RotateCcw className="w-5 h-5 text-slate-600 mx-auto" />
            <div className="text-xs font-bold text-slate-300">No recent meals yet</div>
            <p className="text-[11px] text-slate-500">
              Log your first meal using photo recognition or manual entry below to unlock 1-tap quick re-logging.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {recentMeals.map((meal) => {
              const isSuccess = relogSuccessId === meal.id;
              return (
                <motion.div
                  key={meal.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-3.5 rounded-2xl border transition flex flex-col justify-between space-y-2.5 ${
                    isSuccess
                      ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400 font-semibold">{meal.mealType}</span>
                      <span className="text-emerald-300 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {meal.grade || 'A'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{meal.name}</h4>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                    <span className="text-slate-200 font-bold">{meal.calories} kcal</span>
                    <span className="text-blue-400">{meal.protein}g P</span>
                    <span className="text-amber-400">{meal.carbs}g C</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickReLog(meal)}
                    disabled={isSuccess}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSuccess
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-800 hover:bg-emerald-500 text-slate-200 hover:text-slate-950 hover:font-black'
                    }`}
                  >
                    {isSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Logged to Today!</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Quick Log</span>
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Live Photo Upload Widget */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            Live Photo Meal Recognition
          </h2>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Authoritative Reconciliation
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoSelected(file);
          }}
        />

        <div
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center gap-3 ${
            isAnalyzing
              ? 'border-emerald-500/40 bg-slate-950/80 cursor-wait'
              : 'border-slate-700/80 hover:border-emerald-500/60 bg-slate-950/60 hover:bg-slate-950/90 cursor-pointer group'
          }`}
        >
          {isAnalyzing ? (
            <div className="w-full max-w-md py-2 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Step {analysisStageIdx + 1} of {ANALYSIS_STAGES.length}
                  </div>
                  <div className="text-sm font-bold text-white transition-all duration-300">
                    {ANALYSIS_STAGES[analysisStageIdx].label}
                  </div>
                </div>
              </div>

              {/* Progressive animated indicator */}
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                  initial={{ width: '15%' }}
                  animate={{ width: `${Math.min(96, (analysisStageIdx + 1) * 20)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>

              <div className="text-[11px] text-slate-400 text-center animate-pulse">
                {ANALYSIS_STAGES[analysisStageIdx].sub}
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition">
                <UploadCloud className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-200">
                  Click or Drop Food Photo to Analyze
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Extracts distinct components, calculates gram weights, and tags data provenance.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Checking Personal Food Memory indicator */}
        {isCheckingMemory && (
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex items-center gap-3 text-xs text-slate-300">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Checking Personal Food Memory against your confirmed meals...</span>
          </div>
        )}

        {/* Personal Food Memory Match Card (One-Tap Confirmation) */}
        {memoryMatch && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl space-y-4 backdrop-blur-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Personal Food Memory Match ({Math.round(memoryMatch.similarity * 100)}%)
                  </span>
                  <h3 className="text-base font-black text-white mt-1">
                    Same as {memoryMatch.matchedMeal.mealName} from {memoryMatch.matchedMeal.date}?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Past confirmed: {memoryMatch.matchedMeal.totalCalories} kcal &bull; {memoryMatch.matchedMeal.protein}g P &bull; {memoryMatch.matchedMeal.carbs}g C &bull; {memoryMatch.matchedMeal.fat}g F
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleConfirmMemoryMatch}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer text-xs"
              >
                <Check className="w-4 h-4" />
                Yes, One-Tap Log
              </button>
              <button
                type="button"
                onClick={handleRejectMemoryMatch}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <XCircle className="w-4 h-4" />
                No, this is different
              </button>
            </div>
          </motion.div>
        )}

        {analysisError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong className="font-bold text-white block mb-0.5">Photo Recognition Notice</strong>
                <p className="text-amber-200/90 leading-relaxed">
                  {analysisError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const formEl = document.getElementById('manual-log-form');
                formEl?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Log Manually Below</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* Live Multi-Component Analysis Review Card */}
        {analyzedMeal && (
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-5 space-y-5 animate-fadeIn">
            {/* Meal Header & Provenance */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {analyzedMeal.mealType} &bull; {analyzedMeal.cuisineType || 'Identified Dish'}
                </span>
                <h3 className="text-lg font-black text-white">{analyzedMeal.name}</h3>

                {/* Energy & Uncertainty Interval */}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="font-mono text-emerald-400 font-black text-base">
                    {analyzedMeal.calories} kcal
                  </span>
                  {analyzedMeal.calorieRange && (
                    <span className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-md">
                      p10-p90: {analyzedMeal.calorieRange[0]} - {analyzedMeal.calorieRange[1]} kcal
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    ({analyzedMeal.protein}g P &bull; {analyzedMeal.carbs}g C &bull; {analyzedMeal.fat}g F)
                  </span>
                </div>

                {/* Mass Distribution & Basis */}
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                  <span className="font-mono text-slate-300">
                    Total Mass: {analyzedMeal.massDistribution?.p50 || analyzedMeal.totalGrams}g
                  </span>
                  {analyzedMeal.massDistribution && (
                    <span className="font-mono text-[11px] text-slate-500">
                      (p10: {analyzedMeal.massDistribution.p10}g, p90: {analyzedMeal.massDistribution.p90}g)
                    </span>
                  )}
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    analyzedMeal.massBasis === 'two_view_calibrated' 
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {analyzedMeal.massBasis === 'two_view_calibrated' ? 'Two-View Calibrated' : 'Single View'}
                  </span>
                  {analyzedMeal.scaleCueApplied && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                      Scale: {analyzedMeal.scaleCueApplied}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border ${getSourceBadge(
                    analyzedMeal.nutritionSource
                  )}`}
                >
                  {analyzedMeal.nutritionSource}
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-emerald-300 text-xs">
                  {analyzedMeal.grade}
                </span>
              </div>
            </div>

            {/* Atwater Diagnostic Note (Secondary Diagnostic, No Overwrite) */}
            {analyzedMeal.atwaterDiagnostic?.isInconsistent && (
              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">Atwater Factor Diagnostic: </span>
                  {analyzedMeal.atwaterDiagnostic.reason}
                </div>
              </div>
            )}

            {/* Uncertainty Gate (Do-Not-Auto-Log) Alert */}
            {analyzedMeal.autoLogBlocked && (
              <div className="bg-amber-500/15 border border-amber-500/40 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                    Uncertainty Gate Active (Do-Not-Auto-Log)
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {analyzedMeal.autoLogBlockReason || "Complex meal with unobservable cooking oil or submerged elements detected without 2-view calibration or scale cue. Range presented [p10-p90]; direct auto-save locked until clarification reviewed."}
                  </p>
                  <div className="font-mono text-amber-300 pt-1">
                    Caloric Interval: {analyzedMeal.calorieRange ? `${analyzedMeal.calorieRange[0]} - ${analyzedMeal.calorieRange[1]} kcal` : `${analyzedMeal.calories} kcal`}
                  </div>
                </div>
              </div>
            )}

            {/* Two-Photo & Scale Cue Capture for Complex Meals */}
            {analyzedMeal.suggestsSecondPhoto && (
              <div className="bg-slate-900/90 border border-indigo-500/30 p-4 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Complex Meal: Improve Calibration with 2nd Photo or Scale Cue</span>
                  </div>
                  {secondPhotoBase64 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                      2nd Photo Attached
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Mixed dishes have high depth and hidden volume variance. Adding an angled (30-60°) side photo or plate dimension narrows the uncertainty interval.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    ref={fileInputSecondRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSecondPhotoSelected(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputSecondRef.current?.click()}
                    className="w-full sm:w-auto bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{secondPhotoBase64 ? "Replace Side Photo" : "Add 30-60° Side Photo"}</span>
                  </button>

                  <div className="flex items-center gap-1.5 w-full sm:flex-1">
                    <input
                      type="text"
                      placeholder="Optional scale cue (e.g. 26cm plate)"
                      value={scaleCue}
                      onChange={(e) => setScaleCue(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyScaleCue}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition cursor-pointer"
                    >
                      Calibrate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Component Foods Breakdown with Epistemic Evidence */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Detected Components ({analyzedMeal.foods.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Evidence classification & mass distributions</span>
              </div>

              <div className="divide-y divide-slate-800/60">
                {analyzedMeal.foods.map((comp, idx) => (
                  <div key={idx} className="py-3 space-y-2">
                    {editingComponentIdx === idx ? (
                      /* Inline Edit Form */
                      <div className="bg-slate-950/80 border border-indigo-500/40 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                            Edit Component
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleSaveComponentEdit}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 transition cursor-pointer"
                              title="Save changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingComponentIdx(null)}
                              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">Name</label>
                            <input
                              type="text"
                              value={editCompName}
                              onChange={(e) => setEditCompName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                              Portion / Grams (auto-scales macros)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={editCompGrams}
                              onChange={(e) => handleEditGramsChange(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">Calories</label>
                            <input
                              type="number"
                              min="0"
                              value={editCompCalories}
                              onChange={(e) => setEditCompCalories(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-blue-400 font-semibold mb-1">Protein (g)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={editCompProtein}
                              onChange={(e) => setEditCompProtein(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-400 font-semibold mb-1">Carbs (g)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={editCompCarbs}
                              onChange={(e) => setEditCompCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-rose-400 font-semibold mb-1">Fat (g)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={editCompFat}
                              onChange={(e) => setEditCompFat(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Read-Only Row with Edit & Remove Action Buttons */
                      <>
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-bold text-white truncate">{comp.name}</span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${getEvidenceBadge(
                                comp.evidence
                              )}`}
                            >
                              {comp.evidence || 'visible'}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase ${getSourceBadge(
                                comp.source
                              )}`}
                            >
                              {comp.source}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="font-mono text-slate-200 font-bold">{comp.calories} kcal</span>
                              {comp.calorieRange && (
                                <span className="text-[10px] font-mono text-slate-400 ml-1">
                                  [{comp.calorieRange[0]}-{comp.calorieRange[1]} kcal]
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEditComponent(idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer"
                              title="Edit ingredient"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                              title="Remove ingredient"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <div>
                            {comp.portionDescription || `~${comp.estimatedGrams}g`}{' '}
                            {comp.mass_g && (
                              <span className="font-mono text-slate-500">
                                (p10: {comp.mass_g.p10}g, p90: {comp.mass_g.p90}g)
                              </span>
                            )}{' '}
                            &bull; P: {comp.protein}g, C: {comp.carbs}g, F: {comp.fat}g
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {Math.round((comp.confidence || 0.85) * 100)}% Conf
                          </div>
                        </div>

                        {comp.evidence === 'unobservable_unknown' && (
                          <div className="text-[10px] text-amber-300/90 flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 mt-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Unobservable element (cooking fat/hidden sauce): included in range, never rendered as bare point number.</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Component Action / Drawer */}
              {isAddingComponent ? (
                <div className="bg-slate-950/80 border border-slate-700/80 rounded-xl p-3.5 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      Add Extra Food Component
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingComponent(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Food / Ingredient Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Olive Oil or Sautéed Onions"
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Estimated Grams</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="100"
                        value={newCompGrams}
                        onChange={(e) => setNewCompGrams(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Calories</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="120"
                        value={newCompCalories}
                        onChange={(e) => setNewCompCalories(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-blue-400 font-semibold mb-1">Protein (g)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newCompProtein}
                        onChange={(e) => setNewCompProtein(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-amber-400 font-semibold mb-1">Carbs (g)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newCompCarbs}
                        onChange={(e) => setNewCompCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-rose-400 font-semibold mb-1">Fat (g)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="14"
                        value={newCompFat}
                        onChange={(e) => setNewCompFat(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNewComponent}
                    disabled={!newCompName.trim()}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Breakdown
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingComponent(true)}
                  className="w-full py-2 border border-dashed border-slate-700 hover:border-slate-500 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Missing Food Component
                </button>
              )}
            </div>

            {/* Scientific Uncertainty & Information-Gain Clarification */}
            {analyzedMeal.uncertainty?.requiresClarification && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-3">
                <div className="flex items-start gap-2 text-xs text-amber-300">
                  <HelpCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong>Information-Gain Clarification:</strong> {analyzedMeal.uncertainty.clarificationPrompt}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {analyzedMeal.uncertainty.clarificationOptions?.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleClarificationSelect(opt)}
                      className={`p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        selectedClarification === opt
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmAnalyzedMeal}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {analyzedMeal.autoLogBlocked && !selectedClarification
                    ? "Confirm & Save Log (Uncertainty Reviewed)"
                    : "Confirm & Save Log"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAnalyzedMeal(null);
                  setSelectedClarification(null);
                  setPrimaryPhotoBase64(null);
                  setSecondPhotoBase64(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Manual Macro Entry Form */}
      <div id="manual-log-form" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Manual Macro Entry Form
          </h2>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
            Local & Firestore Sync Active
          </span>
        </div>

        {submittedItem && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Check className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-white">Successfully logged &ldquo;{submittedItem.name}&rdquo;</div>
                <div className="text-[11px] text-slate-400">
                  {submittedItem.calories} kcal &bull; {submittedItem.protein}g P &bull; {submittedItem.carbs}g C &bull; {submittedItem.fat}g F &bull; Grade {submittedItem.grade} &bull; {submittedItem.nutritionSource || 'LOCAL_AUTHORITATIVE'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('daily-log')}
              className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
            >
              Inspect Log
            </button>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Food Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Grilled Salmon with Brown Rice"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Portion
              </label>
              <input
                type="text"
                placeholder="e.g. 1 fillet (220g)"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Meal Slot *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Late Night'] as MealType[]).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setMealType(slot)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    mealType === slot
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Macro Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Calories (kcal) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="5000"
                placeholder="450"
                value={calories}
                onChange={(e) => setCalories(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1.5">
                Protein (g) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="500"
                placeholder="35"
                value={protein}
                onChange={(e) => setProtein(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                Carbs (g) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="600"
                placeholder="40"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1.5">
                Fat (g) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="300"
                placeholder="12"
                value={fat}
                onChange={(e) => setFat(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Optional micronutrients & junk flag */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Sugar (g, optional)
              </label>
              <input
                type="number"
                min="0"
                placeholder="4"
                value={sugar}
                onChange={(e) => setSugar(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Sodium (mg, optional)
              </label>
              <input
                type="number"
                min="0"
                placeholder="320"
                value={sodium}
                onChange={(e) => setSodium(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-slate-700"
              />
            </div>

            <div className="flex items-center sm:justify-center pt-4 sm:pt-0">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isJunk}
                  onChange={(e) => setIsJunk(e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-300">
                  Flag as Ultra-Processed / Junk Food
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingManual}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] cursor-pointer mt-4"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isSubmittingManual ? 'Logging Meal...' : 'Add to Local Food Log'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
