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
import { ApiKeyModal } from '../ApiKeyModal';

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
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

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

  // Quick sample photo trigger for instant zero-friction testing
  const handleSampleMealAnalysis = () => {
    // 100x100 1-pixel transparent PNG data URI converted to base64
    const sampleBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    setPrimaryPhotoBase64(sampleBase64);
    runAnalysisWithPhotos(sampleBase64, null, '26cm ceramic plate');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800/90 backdrop-blur-md p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Visual Meal Logger
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Photo recognition decomposed into whole ingredients and verified against USDA FoodData Central.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('daily-log')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Daily Ledger</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. HERO: Live Photo Upload & AI Vision Pipeline */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Photo Meal Recognition
            </h2>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Authoritative USDA Pipeline
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

        {/* Hero Dropzone */}
        <div
          id="photo-dropzone"
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition flex flex-col items-center justify-center gap-4 ${
            isAnalyzing
              ? 'border-emerald-500/60 bg-emerald-950/20 cursor-wait motion-stage-pulse'
              : 'border-slate-800 hover:border-emerald-500/60 bg-slate-950/60 hover:bg-emerald-950/10 cursor-pointer group shadow-inner'
          }`}
        >
          {isAnalyzing ? (
            <div className="w-full max-w-md py-4 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/30">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
                <div className="text-left overflow-hidden min-h-[48px] flex flex-col justify-center">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Stage {analysisStageIdx + 1} of {ANALYSIS_STAGES.length}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={analysisStageIdx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="text-base font-black text-white"
                    >
                      {ANALYSIS_STAGES[analysisStageIdx].label}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Progressive animated indicator with shimmer flow */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                <motion.div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                  initial={{ width: '15%' }}
                  animate={{ width: `${Math.min(96, (analysisStageIdx + 1) * 20)}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              <div className="min-h-[22px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={analysisStageIdx}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-xs text-slate-400 text-center font-medium"
                  >
                    {ANALYSIS_STAGES[analysisStageIdx].sub}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 group-hover:border-emerald-500/40 transition duration-300 shadow-xl shadow-emerald-950/20 text-emerald-400">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="text-base font-black text-white group-hover:text-emerald-300 transition">
                  Drop meal photo or click to browse
                </div>
                <div className="text-xs text-slate-400 max-w-md mx-auto">
                  Automatically decomposes your meal into verified ingredients, calculates gram weights, and applies Atwater thermodynamic consistency.
                </div>
              </div>

              {/* Sample meal quick-test buttons for friction-free verification */}
              <div className="pt-2 flex items-center gap-2.5 flex-wrap justify-center">
                <span className="text-[11px] font-mono text-slate-400">Quick Test:</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSampleMealAnalysis();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/40 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Analyze Sample Plate</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Checking Personal Food Memory indicator */}
        {isCheckingMemory && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center gap-3 text-xs text-slate-300">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Checking Personal Food Memory against your confirmed meals...</span>
          </div>
        )}

        {/* Personal Food Memory Match Card (One-Tap Confirmation) */}
        <AnimatePresence>
          {memoryMatch && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-emerald-950/30 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-300">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Personal Food Memory Match ({Math.round(memoryMatch.similarity * 100)}%)
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">
                      Same as {memoryMatch.matchedMeal.mealName} from {memoryMatch.matchedMeal.date}?
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Past confirmed: {memoryMatch.matchedMeal.totalCalories} kcal &bull; {memoryMatch.matchedMeal.protein}g P &bull; {memoryMatch.matchedMeal.carbs}g C &bull; {memoryMatch.matchedMeal.fat}g F
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirmMemoryMatch}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <Check className="w-4 h-4" />
                  Yes, One-Tap Log
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRejectMemoryMatch}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <XCircle className="w-4 h-4" />
                  No, this is different
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {analysisError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-950/40 border border-amber-500/40 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-amber-200"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong className="font-bold text-white block mb-0.5">Recognition Notice</strong>
                <p className="text-amber-200/90 leading-relaxed">
                  {analysisError}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {(analysisError.includes('Gemini API key') || analysisError.includes('free key') || analysisError.includes('free Gemini')) && (
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Enter Free Key</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const formEl = document.getElementById('manual-log-form');
                  formEl?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Manual Entry</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Live Multi-Component Analysis Review Card */}
        {analyzedMeal && (
          <div className="bg-slate-950 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl animate-fadeIn">
            {/* Meal Header & Provenance */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {analyzedMeal.mealType} &bull; {analyzedMeal.cuisineType || 'Identified Dish'}
                  </span>
                  <span
                    className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${getSourceBadge(
                      analyzedMeal.nutritionSource
                    )}`}
                  >
                    {analyzedMeal.nutritionSource}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">{analyzedMeal.name}</h3>

                {/* Energy & Uncertainty Interval */}
                <div className="flex items-center gap-3 flex-wrap mt-2">
                  <span className="font-mono text-emerald-400 font-black text-2xl">
                    {analyzedMeal.calories} <span className="text-sm font-sans font-bold text-slate-400">kcal</span>
                  </span>
                  {analyzedMeal.calorieRange && (
                    <span className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                      p10-p90: {analyzedMeal.calorieRange[0]} - {analyzedMeal.calorieRange[1]} kcal
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-blue-400 font-bold">{analyzedMeal.protein}g P</span>
                    <span className="text-amber-400 font-bold">{analyzedMeal.carbs}g C</span>
                    <span className="text-rose-400 font-bold">{analyzedMeal.fat}g F</span>
                  </div>
                </div>

                {/* Mass Distribution & Basis */}
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 flex-wrap">
                  <span className="font-mono text-slate-300 font-medium">
                    Total Mass: {analyzedMeal.massDistribution?.p50 || analyzedMeal.totalGrams}g
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    analyzedMeal.massBasis === 'two_view_calibrated' 
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                      : 'bg-slate-800 text-slate-300 border-slate-700'
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

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center font-mono">
                  <span className="text-[9px] uppercase font-bold text-slate-400">GRADE</span>
                  <span className="text-base font-black text-emerald-400">{analyzedMeal.grade || 'A'}</span>
                </div>
              </div>
            </div>

            {/* Interactive Clarification Questions (3-4 high-value visual chips) */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 space-y-3.5">
              <div className="flex items-start gap-2.5 text-xs text-amber-200">
                <HelpCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-white font-bold block">
                    Clarify Preparation & Cooking Fat:
                  </strong>
                  <span className="text-slate-300">
                    {analyzedMeal.uncertainty?.clarificationPrompt || 'Visual models cannot observe hidden fats. Select the preparation style to calibrate calories accurately:'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(analyzedMeal.uncertainty?.clarificationOptions || [
                  'Light Olive Oil / Non-Stick Spray (~40 kcal)',
                  'Standard Cooking Butter/Oil 1 tbsp (~120 kcal)',
                  'Restaurant Rich / Heavy Sauté (~220 kcal)'
                ]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleClarificationSelect(opt)}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left cursor-pointer flex flex-col justify-between gap-1.5 ${
                      selectedClarification === opt
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-950/30 ring-1 ring-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-white'
                    }`}
                  >
                    <span>{opt}</span>
                    <span className="text-[10px] font-mono opacity-80">
                      {selectedClarification === opt ? '✓ Selected (applied)' : 'Click to apply'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Component Foods Breakdown with Epistemic Evidence */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Detected Components ({analyzedMeal.foods.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Reconciled with USDA FDC</span>
              </div>

              <div className="divide-y divide-slate-800/80">
                {analyzedMeal.foods.map((comp, idx) => (
                  <div key={idx} className="py-3 space-y-2">
                    {editingComponentIdx === idx ? (
                      /* Inline Edit Form */
                      <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                            Edit Component Details
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleSaveComponentEdit}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 transition cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingComponentIdx(null)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1">Name</label>
                            <input
                              type="text"
                              value={editCompName}
                              onChange={(e) => setEditCompName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
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
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
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
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
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
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
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
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
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
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Read-Only Row */
                      <>
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-bold text-white truncate">{comp.name}</span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${getEvidenceBadge(
                                comp.evidence
                              )}`}
                            >
                              {comp.evidence || 'visible'}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${getSourceBadge(
                                comp.source
                              )}`}
                            >
                              {comp.source}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="font-mono text-emerald-400 font-bold">{comp.calories} kcal</span>
                              {comp.calorieRange && (
                                <span className="text-[10px] font-mono text-slate-400 ml-1">
                                  [{comp.calorieRange[0]}-{comp.calorieRange[1]}]
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEditComponent(idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
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
                            &bull; P: <span className="text-blue-400">{comp.protein}g</span>, C: <span className="text-amber-400">{comp.carbs}g</span>, F: <span className="text-rose-400">{comp.fat}g</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {Math.round((comp.confidence || 0.85) * 100)}% Conf
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Component Action / Drawer */}
              {isAddingComponent ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Food / Ingredient Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Avocado or Olive Oil"
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNewComponent}
                    disabled={!newCompName.trim()}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Breakdown
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingComponent(true)}
                  className="w-full py-2.5 border border-dashed border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Missing Food Component
                </button>
              )}
            </div>

            {/* Action Buttons: Confirm & Discard */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                id="confirm-analyzed-meal-btn"
                onClick={handleConfirmAnalyzedMeal}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 px-5 rounded-2xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-[0.99] cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Save to Daily Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAnalyzedMeal(null);
                  setSelectedClarification(null);
                  setPrimaryPhotoBase64(null);
                  setSecondPhotoBase64(null);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-bold py-3.5 px-5 rounded-2xl text-xs transition cursor-pointer border border-slate-800"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Repeat-Meal Quick-Log Widget (Recent Distinct Meals) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Repeat-Meal Quick-Log
            </h2>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono font-semibold">
            {recentMeals.length} distinct logged
          </span>
        </div>

        {recentMeals.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2">
            <RotateCcw className="w-5 h-5 text-slate-400 mx-auto" />
            <div className="text-xs font-bold text-slate-300">No previous meals recorded yet</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Once you log meals with photo recognition, your frequent items appear here for instant 1-tap re-logging.
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
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                    isSuccess
                      ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1.5">
                      <span className="text-slate-400 font-medium">{meal.mealType}</span>
                      <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        {meal.grade || 'A'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{meal.name}</h4>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="text-white font-bold">{meal.calories} kcal</span>
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
                        : 'bg-slate-800 hover:bg-emerald-500 text-slate-200 hover:text-slate-950'
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

      {/* 3. Manual Macro Entry Form */}
      <div id="manual-log-form" className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            Manual Macro Entry Form
          </h2>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
            Offline & Firestore Sync
          </span>
        </div>

        {submittedItem && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Check className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-white">Successfully logged &ldquo;{submittedItem.name}&rdquo;</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {submittedItem.calories} kcal &bull; {submittedItem.protein}g P &bull; {submittedItem.carbs}g C &bull; {submittedItem.fat}g F &bull; Grade {submittedItem.grade}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('daily-log')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
            >
              View Daily Ledger &rarr;
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
                placeholder="e.g. Grilled Chicken Breast with Sweet Potato"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Portion
              </label>
              <input
                type="text"
                placeholder="e.g. 200g serving"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
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
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    mealType === slot
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-slate-600"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-slate-600"
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
                  Ultra-Processed / Junk Food
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingManual}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-[0.99] cursor-pointer mt-4 uppercase tracking-wider text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isSubmittingManual ? 'Logging Meal...' : 'Save to Food Ledger'}</span>
          </button>
        </form>
      </div>

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />
    </div>
  );
}
