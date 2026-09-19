import React, { useState, useEffect, useRef } from 'react';

import { useAuth } from '../AuthContext';
import { FoodItem, DailyStats } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';

import { Camera, LogOut, Trash2, Edit3, Utensils, AlertTriangle, Sparkles, Droplets, Plus, Minus, BrainCircuit, BarChart3, Trophy, BookOpen, Lightbulb, Flame, X, ShoppingCart, BookPlus, Award, Target, RefreshCw, Mic, MicOff, Settings, Sliders, Bot, Zap, CheckCircle2, ShieldAlert, ArrowRight, HeartPulse, Undo2, Download, FileSpreadsheet, FileJson, PieChart, MoreHorizontal, ChevronDown } from 'lucide-react';



import { LogFoodModal } from './LogFoodModal';
import { RecipeBuilder } from './RecipeBuilder';
import { SmartGroceryList } from './SmartGroceryList';
import { WeeklyAuditModal } from './WeeklyAuditModal';
import { PersonalizedNextMeal } from './PersonalizedNextMeal';
import { ProfileSetup } from './ProfileSetup';
import { SystemDoctorModal } from './SystemDoctorModal';
import { seedTestData } from '../lib/mockDataSeeder';
import { apiFetch } from '../lib/apiFetch';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const MOCK_BLOGS = [
  { id: 1, title: 'The Power of Hydration', readTime: '3 min', excerpt: 'How drinking water boosts metabolism and speeds recovery.' },
  { id: 2, title: 'Navigating Sugar Cravings', readTime: '5 min', excerpt: 'Proven nutritional tactics to beat the afternoon dopamine dip.' },
  { id: 3, title: 'Protein-Packed Muscle Fuel', readTime: '4 min', excerpt: 'Optimal amino acid distribution for satiety and lean gains.' },
];

const GLOBAL_HEALTHY_TRENDS = [
  {
    rank: 1,
    name: 'Matcha Chia Seed Pudding',
    highlight: 'Trending Superfood',
    tag: 'High Fiber & Antioxidants',
    calories: 220,
    healthScore: 98,
    grade: 'A',
  },
  {
    rank: 2,
    name: 'High-Protein Cottage Cheese Bowl',
    highlight: 'Community Favorite',
    tag: 'Casein Protein & Probiotic',
    calories: 280,
    healthScore: 95,
    grade: 'A',
  },
  {
    rank: 3,
    name: 'Wild Salmon & Quinoa Power Salad',
    highlight: 'Clean Energy Staple',
    tag: 'Healthy Omega-3 Fats',
    calories: 340,
    healthScore: 96,
    grade: 'A',
  },
  {
    rank: 4,
    name: 'Organic Acai Protein Bowl',
    highlight: 'Metabolic Boost',
    tag: 'Rich in Anthocyanins & Micronutrients',
    calories: 260,
    healthScore: 94,
    grade: 'A',
  },
];

export const Dashboard = ({ logOut }: { logOut: () => void }) => {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [logs, setLogs] = useState<FoodItem[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`foodLogs_${user.uid}_${today}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [weeklyLogs, setWeeklyLogs] = useState<FoodItem[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`weeklyFoodLogs_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [dailyStats, setDailyStats] = useState<DailyStats | null>(() => {
    if (!user) return null;
    try {
      const cached = localStorage.getItem(`dailyStats_${user.uid}_${today}`);
      return cached ? JSON.parse(cached) : { waterGlasses: 0, updatedAt: Date.now() };
    } catch {
      return { waterGlasses: 0, updatedAt: Date.now() };
    }
  });

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logModalInitialTab, setLogModalInitialTab] = useState<'camera' | 'search' | 'barcode' | 'presets' | 'recipe'>('camera');
  const [historyFilter, setHistoryFilter] = useState<'today' | 'all'>('today');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<{ text: string, isWarning: boolean } | null>(null);


  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [needsWaterReminder, setNeedsWaterReminder] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'recipes' | 'grocery' | 'history'>('overview');
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccessMsg, setSeedSuccessMsg] = useState<string | null>(null);

  // Magic Quick-Log & Zero-Friction Automation State
  const [magicInput, setMagicInput] = useState('');
  const [isMagicLogging, setIsMagicLogging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [magicToast, setMagicToast] = useState<{ name: string; calories: number; protein: number; isJunk: boolean } | null>(null);

  const QUICK_STAPLES = [
    { name: 'Whey Protein Shake', calories: 160, protein: 30, carbs: 4, fat: 2, isJunk: false, icon: '🥛' },
    { name: '2 Scrambled Eggs & Toast', calories: 380, protein: 24, carbs: 28, fat: 18, isJunk: false, icon: '🍳' },
    { name: 'Oatmeal & Fresh Berries', calories: 310, protein: 12, carbs: 55, fat: 5, isJunk: false, icon: '🥣' },
    { name: 'Grilled Chicken & Rice', calories: 520, protein: 45, carbs: 58, fat: 10, isJunk: false, icon: '🍗' },
    { name: 'Greek Yogurt & Honey', calories: 220, protein: 20, carbs: 24, fat: 3, isJunk: false, icon: '🥑' },
    { name: 'Black Coffee / Americano', calories: 5, protein: 0, carbs: 1, fat: 0, isJunk: false, icon: '☕' },
  ];

  const handleMagicQuickLog = async (textToLog?: string) => {
    const text = (typeof textToLog === 'string' ? textToLog : magicInput).trim();
    if (!text || !user) return;
    setIsMagicLogging(true);

    try {
      let idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        const currentUid = user?.uid || localStorage.getItem('customUserId') || 'athlete_guest';
        idToken = `test-token-${currentUid}`;
      }

      const data = await apiFetch<any>('/api/ai/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ description: text }),
        fallbackErrorMessage: 'Food analysis service is temporarily unavailable. Please try again or log manually.'
      });
      
      if (!data.success || !data.data) {
        alert(data.error || "Food analysis failed. Please try again or log manually.");
        return;
      }

      const item = data.data;
      const newLogId = `magic-${Date.now()}`;
      const newFoodItem: FoodItem = {
        id: newLogId,
        userId: user.uid,
        name: item.name || text,
        isJunk: Boolean(item.isJunk),
        calories: Math.round(Number(item.calories)),
        protein: Math.round(Number(item.protein) * 10) / 10,
        carbs: Math.round(Number(item.carbs) * 10) / 10,
        fat: Math.round(Number(item.fat) * 10) / 10,
        sugar: Math.round(Number(item.sugar || 0) * 10) / 10,
        sodium: Math.round(Number(item.sodium || 0)),
        portion: item.portion || '1 standard serving',
        healthScore: Number(item.healthScore) || (item.isJunk ? 40 : 85),
        grade: item.grade || (item.isJunk ? 'D' : 'A'),
        mealType: item.mealType || (new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner'),
        category: item.category || (item.isJunk ? 'junk' : 'healthy'),
        date: today,
        verdict: item.verdict || (item.isJunk ? 'Ultra-processed food detected' : 'Clean whole food logged'),
        createdAt: Date.now(),
        foods: item.foods || [],
        confidence: Number(item.confidence) || 0.9,
        nutritionSource: item.nutritionSource || 'GEMINI_ESTIMATE',
        estimationNotes: item.estimationNotes || [],
        energyCheckDelta: item.energyCheckDelta || 0
      };

      // Optimistic local state & storage update
      setLogs(prev => [newFoodItem, ...prev]);
      setWeeklyLogs(prev => [newFoodItem, ...prev]);
      try {
        const cached = localStorage.getItem(`foodLogs_${user.uid}_${today}`);
        const existing = cached ? JSON.parse(cached) : [];
        localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify([newFoodItem, ...existing]));

        const cachedWeekly = localStorage.getItem(`weeklyFoodLogs_${user.uid}`);
        const existingWeekly = cachedWeekly ? JSON.parse(cachedWeekly) : [];
        localStorage.setItem(`weeklyFoodLogs_${user.uid}`, JSON.stringify([newFoodItem, ...existingWeekly]));
      } catch {}

      // Trigger visual success toast
      setMagicToast({
        name: newFoodItem.name,
        calories: newFoodItem.calories,
        protein: newFoodItem.protein,
        isJunk: newFoodItem.isJunk
      });
      setTimeout(() => setMagicToast(null), 4000);

      setMagicInput('');

      // Persist to Firestore
      try {
        await addDoc(collection(db, 'users', user.uid, 'foodLogs'), newFoodItem);
      } catch (err) {
        console.warn('Firestore magic log sync notice:', err);
      }
    } catch (err: any) {
      console.error('Magic quick log error:', err);
      alert(err.message || 'Failed to process meal input. Please try again.');
    } finally {
      setIsMagicLogging(false);
    }
  };

  const handleLogStaple = async (staple: typeof QUICK_STAPLES[0]) => {
    if (!user) return;
    const newLogId = `staple-${Date.now()}`;
    const newFoodItem: FoodItem = {
      id: newLogId,
      userId: user.uid,
      name: staple.name,
      isJunk: staple.isJunk,
      calories: staple.calories,
      protein: staple.protein,
      carbs: staple.carbs,
      fat: staple.fat,
      sugar: 2,
      sodium: 200,
      portion: '1 standard serving',
      healthScore: staple.isJunk ? 45 : 95,
      grade: staple.isJunk ? 'D' : 'A',
      mealType: new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner',
      category: staple.isJunk ? 'junk' : 'healthy',
      date: today,
      verdict: staple.isJunk ? 'Preset fast selection logged.' : 'Preset nutrient-dense staple logged.',
      createdAt: Date.now(),
      nutritionSource: 'AUTHORITATIVE_DB',
      confidence: 1.0
    };

    setLogs(prev => [newFoodItem, ...prev]);
    setWeeklyLogs(prev => [newFoodItem, ...prev]);
    try {
      const cached = localStorage.getItem(`foodLogs_${user.uid}_${today}`);
      const existing = cached ? JSON.parse(cached) : [];
      localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify([newFoodItem, ...existing]));

      const cachedWeekly = localStorage.getItem(`weeklyFoodLogs_${user.uid}`);
      const existingWeekly = cachedWeekly ? JSON.parse(cachedWeekly) : [];
      localStorage.setItem(`weeklyFoodLogs_${user.uid}`, JSON.stringify([newFoodItem, ...existingWeekly]));
    } catch {}

    setMagicToast({
      name: staple.name,
      calories: staple.calories,
      protein: staple.protein,
      isJunk: staple.isJunk
    });
    setTimeout(() => setMagicToast(null), 3000);

    try {
      await addDoc(collection(db, 'users', user.uid, 'foodLogs'), newFoodItem);
    } catch (err) {
      console.warn('Staple sync notice:', err);
    }
  };

  const handleVoiceListen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your meal in the quick-log bar.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMagicInput(transcript);
        handleMagicQuickLog(transcript);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  const photoInputRef = useRef<HTMLInputElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsToolsMenuOpen(false);
      }
    };
    if (isToolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isToolsMenuOpen]);


  const handlePhotoQuickLog = async (file: File) => {

    if (!file || !user) return;
    setIsMagicLogging(true);

    try {
      // 1. Client-Side Canvas Compression (Instant 800px max JPEG)
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
              reject(new Error('Failed to create canvas'));
            }
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Google Gemini Multimodal Vision Analysis
      let idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        const currentUid = user?.uid || localStorage.getItem('customUserId') || 'athlete_guest';
        idToken = `test-token-${currentUid}`;
      }

      const data = await apiFetch<any>('/api/ai/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ imageBase64: base64String, mimeType: 'image/jpeg' }),
        fallbackErrorMessage: 'Image analysis service is temporarily unavailable. Please try again or log manually.'
      });

      if (!data.success || !data.data) {
        alert(data.error || "Image analysis failed. Please try again or log manually.");
        return;
      }

      const item = data.data;
      const newLogId = `photo-${Date.now()}`;
      const newFoodItem: FoodItem = {
        id: newLogId,
        userId: user.uid,
        name: item.name || 'Analyzed Meal Photo',
        isJunk: Boolean(item.isJunk),
        calories: Math.round(Number(item.calories)),
        protein: Math.round(Number(item.protein) * 10) / 10,
        carbs: Math.round(Number(item.carbs) * 10) / 10,
        fat: Math.round(Number(item.fat) * 10) / 10,
        sugar: Math.round(Number(item.sugar || 0) * 10) / 10,
        sodium: Math.round(Number(item.sodium || 0)),
        portion: item.portion || '1 plate',
        healthScore: Number(item.healthScore) || (item.isJunk ? 40 : 85),
        grade: item.grade || (item.isJunk ? 'D' : 'A'),
        mealType: item.mealType || (new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner'),
        category: item.category || (item.isJunk ? 'junk' : 'healthy'),
        date: today,
        imageUrl: base64String,
        verdict: item.verdict || (item.isJunk ? 'Ultra-processed food detected in photo' : 'Clean nutritious meal identified'),
        createdAt: Date.now(),
        foods: item.foods || [],
        confidence: Number(item.confidence) || 0.9,
        nutritionSource: item.nutritionSource || 'GEMINI_ESTIMATE',
        estimationNotes: item.estimationNotes || [],
        energyCheckDelta: item.energyCheckDelta || 0
      };

      setLogs(prev => [newFoodItem, ...prev]);
      setWeeklyLogs(prev => [newFoodItem, ...prev]);
      try {
        const cached = localStorage.getItem(`foodLogs_${user.uid}_${today}`);
        const existing = cached ? JSON.parse(cached) : [];
        localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify([newFoodItem, ...existing]));

        const cachedWeekly = localStorage.getItem(`weeklyFoodLogs_${user.uid}`);
        const existingWeekly = cachedWeekly ? JSON.parse(cachedWeekly) : [];
        localStorage.setItem(`weeklyFoodLogs_${user.uid}`, JSON.stringify([newFoodItem, ...existingWeekly]));
      } catch {}

      setMagicToast({
        name: newFoodItem.name,
        calories: newFoodItem.calories,
        protein: newFoodItem.protein,
        isJunk: newFoodItem.isJunk
      });
      setTimeout(() => setMagicToast(null), 4000);

      try {
        await addDoc(collection(db, 'users', user.uid, 'foodLogs'), newFoodItem);
      } catch (err) {
        console.warn('Firestore photo log notice:', err);
      }
    } catch (err: any) {
      console.error('Photo quick log failed:', err);
      alert(err.message || 'Failed to process meal photo. Please try again.');
    } finally {
      setIsMagicLogging(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };



  const handleQuickSeed = async () => {
    if (!user) return;
    setIsSeeding(true);
    setSeedSuccessMsg(null);
    try {
      const result = await seedTestData(user.uid);
      if (result.success) {
        setSeedSuccessMsg(`Loaded 7-day dataset: ${result.logsCount} meals, recipes, hydration & smart groceries!`);
        setTimeout(() => setSeedSuccessMsg(null), 5000);
      } else {
        alert(result.error || 'Failed to seed data');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error seeding dataset');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (!dailyStats) return;
    const checkHydration = () => {
      const now = Date.now();
      const lastUpdated = dailyStats.updatedAt || now;
      const hoursSince = (now - lastUpdated) / (1000 * 60 * 60);
      const targetW = profile?.waterGoal || 8;
      
      if (hoursSince > 2 && dailyStats.waterGlasses < targetW) {
        setNeedsWaterReminder(true);
      } else {
        setNeedsWaterReminder(false);
      }
    };
    
    checkHydration();
    const interval = setInterval(checkHydration, 60000);
    return () => clearInterval(interval);
  }, [dailyStats, profile]);

  // Today's logs listener - safe query without composite index
  useEffect(() => {
    if (!user) return;
    const logsRef = collection(db, 'users', user.uid, 'foodLogs');
    const q = query(
      logsRef,
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as FoodItem)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLogs(items);
      try {
        localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify(items));
      } catch {}
    }, (error) => {
      console.warn('Food logs listener notice:', error);
    });

    return unsubscribe;
  }, [user, today]);

  // Daily stats listener
  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'users', user.uid, 'dailyStats', today);
    const unsubscribe = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DailyStats;
        setDailyStats(data);
        try {
          localStorage.setItem(`dailyStats_${user.uid}_${today}`, JSON.stringify(data));
        } catch {}
      } else {
        const defaultStat = { waterGlasses: 0, updatedAt: Date.now() };
        setDailyStats(defaultStat);
      }
    }, (err) => {
      console.warn('Daily stats listener notice:', err);
    });
    return unsubscribe;
  }, [user, today]);

  // Weekly logs listener (30-day window)
  useEffect(() => {
    if (!user) return;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    const logsRef = collection(db, 'users', user.uid, 'foodLogs');
    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as FoodItem)
        .filter(l => l.date >= pastDateStr)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWeeklyLogs(items);
      try {
        localStorage.setItem(`weeklyFoodLogs_${user.uid}`, JSON.stringify(items));
      } catch {}
    }, (error) => {
      console.warn('Weekly logs listener notice:', error);
    });

    return unsubscribe;
  }, [user]);

  const updateWater = async (delta: number) => {
    if (!user) return;
    const currentCount = dailyStats?.waterGlasses || 0;
    const newCount = Math.max(0, currentCount + delta);
    const updatedStats: DailyStats = {
      waterGlasses: newCount,
      updatedAt: Date.now()
    };
    setDailyStats(updatedStats);
    try {
      localStorage.setItem(`dailyStats_${user.uid}_${today}`, JSON.stringify(updatedStats));
      await setDoc(doc(db, 'users', user.uid, 'dailyStats', today), updatedStats, { merge: true });
    } catch (err) {
      console.warn("Water update notice (cached locally):", err);
    }
  };


  const analyzeHabits = async () => {
    if (!user || logs.length === 0) return;
    setIsAnalyzing(true);
    try {
      const data = await apiFetch<any>('/api/ai/analyze-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs, dailyStats, profile })
      });
      if (data.success && data.data) {
        setAiInsight(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5-Second Undo Delete Buffer State
  const [deletedItemUndo, setDeletedItemUndo] = useState<FoodItem | null>(null);
  const undoTimeoutRef = useRef<any>(null);

  // Interactive Meal Editing State
  const [editingMeal, setEditingMeal] = useState<FoodItem | null>(null);

  const handleSaveEditedMeal = async (updated: FoodItem) => {
    if (!user) return;
    
    // Optimistic UI updates
    setLogs(prev => prev.map(l => l.id === updated.id ? updated : l));
    setWeeklyLogs(prev => prev.map(l => l.id === updated.id ? updated : l));
    
    try {
      const todayLogs = logs.map(l => l.id === updated.id ? updated : l);
      localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify(todayLogs));
      await setDoc(doc(db, 'users', user.uid, 'foodLogs', updated.id), updated);
    } catch (err) {
      console.warn("Save edited meal notice (saved locally):", err);
    }
    
    setEditingMeal(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const itemToDelete = logs.find(l => l.id === id) || weeklyLogs.find(l => l.id === id);
    
    // 1. Optimistic removal from UI state
    setLogs(prev => prev.filter(l => l.id !== id));
    setWeeklyLogs(prev => prev.filter(l => l.id !== id));

    if (itemToDelete) {
      setDeletedItemUndo(itemToDelete);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      
      // Delay permanent deletion by 5 seconds to allow undo
      undoTimeoutRef.current = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'foodLogs', id));
        } catch (err) {
          console.warn('Delete log notice:', err);
        }
        setDeletedItemUndo(null);
      }, 5000);
    } else {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'foodLogs', id));
      } catch (err) {
        console.warn('Delete log notice:', err);
      }
    }
  };

  const handleUndoDelete = async () => {
    if (!deletedItemUndo || !user) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    const item = deletedItemUndo;
    setDeletedItemUndo(null);

    // Restore to UI state & local cache
    if (item.date === today) {
      setLogs(prev => [item, ...prev.filter(l => l.id !== item.id)]);
    }
    setWeeklyLogs(prev => [item, ...prev.filter(l => l.id !== item.id)]);
    
    try {
      await setDoc(doc(db, 'users', user.uid, 'foodLogs', item.id), item);
    } catch (err) {
      console.warn('Undo restore notice:', err);
    }
  };

  // 1-Click Diary Export Handlers
  const handleExportCSV = () => {
    if (weeklyLogs.length === 0) {
      alert('No food logs available to export. Log some meals first!');
      return;
    }
    const headers = ['Date', 'Time', 'Meal Type', 'Name', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Sugar (g)', 'Sodium (mg)', 'Is Junk', 'Grade', 'Health Score'];
    const rows = weeklyLogs.map(log => [
      log.date,
      new Date(log.createdAt).toLocaleTimeString(),
      `"${log.mealType}"`,
      `"${(log.name || '').replace(/"/g, '""')}"`,
      log.calories,
      log.protein,
      log.carbs,
      log.fat,
      log.sugar || 0,
      log.sodium || 0,
      log.isJunk ? 'YES' : 'NO',
      log.grade || 'N/A',
      log.healthScore || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nutrition_diary_${user?.uid || 'export'}_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (weeklyLogs.length === 0) {
      alert('No food logs available to export. Log some meals first!');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(weeklyLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `nutrition_diary_${user?.uid || 'export'}_${today}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics Calculations
  const dailyJunkCount = logs.filter(l => l.isJunk).length;
  const totalCalories = logs.reduce((acc, log) => acc + log.calories, 0);
  const totalProtein = logs.reduce((acc, log) => acc + (log.protein || 0), 0);
  const totalCarbs = logs.reduce((acc, log) => acc + (log.carbs || 0), 0);
  const totalFat = logs.reduce((acc, log) => acc + (log.fat || 0), 0);

  // Macro Calorie Split Percentages
  const totalProteinCal = totalProtein * 4;
  const totalCarbCal = totalCarbs * 4;
  const totalFatCal = totalFat * 9;
  const totalMacroCal = totalProteinCal + totalCarbCal + totalFatCal || 1;
  const proteinPercent = totalCalories > 0 ? Math.round((totalProteinCal / totalMacroCal) * 100) : 0;
  const carbPercent = totalCalories > 0 ? Math.round((totalCarbCal / totalMacroCal) * 100) : 0;
  const fatPercent = totalCalories > 0 ? Math.max(0, 100 - proteinPercent - carbPercent) : 0;

  const junkCalories = logs.filter(l => l.isJunk).reduce((acc, log) => acc + log.calories, 0);
  const junkPercent = totalCalories > 0 ? Math.round((junkCalories / totalCalories) * 100) : 0;

  
  const targetCal = profile?.targetCalories || 2000;
  const calorieProgress = Math.min((totalCalories / targetCal) * 100, 100);
  const overCalorie = totalCalories > targetCal;
  const overJunk = junkPercent > (profile?.maxJunkCaloriePercent || 15);
  const waterGlasses = dailyStats?.waterGlasses || 0;
  const targetWater = profile?.waterGoal || 8;

  const chartData = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let weeklyHealthyCal = 0;
  let weeklyJunkCal = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    const dayLogs = weeklyLogs.filter(l => l.date === dateStr);
    const junkCal = dayLogs.filter(l => l.isJunk).reduce((acc, log) => acc + log.calories, 0);
    const healthyCal = dayLogs.filter(l => !l.isJunk).reduce((acc, log) => acc + log.calories, 0);
    
    weeklyHealthyCal += healthyCal;
    weeklyJunkCal += junkCal;

    chartData.push({
      name: i === 0 ? 'Today' : days[d.getDay()],
      healthy: healthyCal,
      junk: junkCal,
    });
  }

  // Gamification logic
  const hydrationBonus = waterGlasses > targetWater ? (waterGlasses - targetWater) * 10 : 0;
  const healthPoints = Math.max(0, Math.floor((weeklyHealthyCal / 100) * 10 - (weeklyJunkCal / 100) * 5 + (waterGlasses * 5) + hydrationBonus));
  const currentLevel = Math.floor(healthPoints / 100) + 1;
  const pointsToNext = 100 - (healthPoints % 100);

  const ranks = ['Novice Eater', 'Bronze Scavenger', 'Silver Tracker', 'Gold Nutritionist', 'Diamond Health Master', 'Elite Guard'];
  const rankName = ranks[Math.min(currentLevel - 1, ranks.length - 1)];

  let habitStreak = 0;
  for (let i = 0; i <= 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = weeklyLogs.filter(l => l.date === dateStr);
    
    if (dayLogs.length === 0) {
      if (i === 0) continue;
      break;
    }
    
    const dayCalories = dayLogs.reduce((acc, log) => acc + log.calories, 0);
    if (dayCalories <= targetCal * 1.05) {
      habitStreak++;
    } else {
      break;
    }
  }

  // Dynamic recommendations
  const getRecommendations = () => {
    const recs = [];
    if (waterGlasses < targetWater / 2) recs.push(`Drink more water! Aim for at least ${targetWater} glasses to optimize metabolic recovery.`);
    if (junkPercent > (profile?.maxJunkCaloriePercent || 15)) recs.push(`You've exceeded your ${profile?.maxJunkCaloriePercent}% junk food allowance! Keep upcoming meals clean.`);
    if (dailyJunkCount >= 1) recs.push("You've logged your 1 allowed junk meal for today. All remaining meals should be whole foods!");
    if (totalProtein < (profile?.targetProtein || 120) * 0.5 && new Date().getHours() > 14) recs.push("Protein intake is behind schedule. Consider a high-protein snack like Greek yogurt or grilled chicken.");
    if (totalCalories > targetCal * 0.9) recs.push("You're close to your caloric ceiling. Opt for high-volume leafy greens and fibrous veggies.");
    if (recs.length === 0) recs.push("You're on track with clean nutrition! Keep up the momentum.");
    return recs;
  };

  const recommendations = getRecommendations();

  // Smart Reminder Logic
  const currentHour = new Date().getHours();
  let smartReminder = null;
  if (currentHour >= 19 && currentHour <= 21 && !logs.some(l => l.mealType === 'Dinner')) {
    smartReminder = "Based on your habits, you usually eat Dinner around 8 PM. Time to log your evening meal!";
  } else if (currentHour >= 7 && currentHour <= 10 && !logs.some(l => l.mealType === 'Breakfast')) {
    smartReminder = "Good morning! Log your breakfast to ignite your metabolic rate for the day.";
  }

  const [selectedBlog, setSelectedBlog] = useState<typeof MOCK_BLOGS[0] | null>(null);

  const userName = user?.displayName ? user.displayName.split(' ')[0] : 'Avi';
  const timeGreeting = currentHour < 12 ? 'GOOD MORNING' : currentHour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const caloriesRemaining = Math.max(0, targetCal - totalCalories);
  const targetProtein = profile?.targetProtein || 140;
  const targetCarbs = profile?.targetCarbs || 220;
  const targetFat = profile?.targetFat || 65;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#080c14] via-[#0b101c] to-[#040711] pb-24 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* A. PERSONAL HEADER */}
      <header className="bg-[#0b101c]/95 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User Avatar"} 
                className="w-10 h-10 rounded-2xl border-2 border-emerald-500/40 object-cover shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/20 shrink-0" 
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center font-black text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.25)] shrink-0">
                {userName.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">Google's Junk Guard</h1>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {profile?.goal || 'Weight Loss'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {profile?.dietaryStyle || 'Balanced'} • <strong className="text-slate-300">{targetCal.toLocaleString()} kcal</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Streak Badge */}
            <div className="bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-black text-amber-300 shadow-sm shrink-0">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400/30" />
              <span>{habitStreak > 0 ? `${habitStreak} day streak` : '1 day streak'}</span>
            </div>

            {/* Personalize Button */}
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              title="Personalize AI Nutrition Plan"
              aria-label="Settings and plan preferences"
              className="text-xs font-bold text-slate-300 hover:text-white bg-[#111928] hover:bg-slate-800 border border-slate-700/70 px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Tools Menu Button */}
            <button 
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              title="Tools & Diagnostics Menu"
              aria-label="More tools and diagnostics"
              className="text-slate-300 hover:text-white p-2 rounded-xl bg-[#111928] hover:bg-slate-800 border border-slate-700/70 transition flex items-center justify-center cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Tools Dropdown Menu */}
            {isToolsMenuOpen && (
              <div 
                ref={toolsMenuRef}
                className="absolute right-0 top-12 w-60 bg-[#111928] border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 text-xs space-y-1"
              >
                <button
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    handleQuickSeed();
                  }}
                  disabled={isSeeding}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/80 text-amber-300 hover:text-amber-200 transition flex items-center gap-2.5 font-bold cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{isSeeding ? 'Loading Test Data...' : 'Load 7-Day Test Data'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    setIsDoctorModalOpen(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/80 text-emerald-300 hover:text-emerald-200 transition flex items-center gap-2.5 font-bold cursor-pointer"
                >
                  <HeartPulse className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                  <span>System Doctor Diagnostics</span>
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    logOut();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition flex items-center gap-2.5 font-bold cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {seedSuccessMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-300 px-4 py-2.5 text-xs font-bold flex items-center justify-between sticky top-[61px] z-30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{seedSuccessMsg}</span>
          </div>
          <button onClick={() => setSeedSuccessMsg(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <nav className="bg-[#0b101c]/80 backdrop-blur-md border-b border-slate-800 sticky top-[61px] z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'overview' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Today
          </button>
          <button 
            onClick={() => setActiveTab('insights')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'insights' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Insights & Audit</span>
          </button>
          <button 
            onClick={() => setActiveTab('recipes')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'recipes' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookPlus className="w-3.5 h-3.5" />
            <span>Cookbook</span>
          </button>
          <button 
            onClick={() => setActiveTab('grocery')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'grocery' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Grocery Planner</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'history' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Food Logs ({logs.length})
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* TAB 1: TODAY (FOCUSED DAILY COMMAND CENTER) */}
        {activeTab === 'overview' && (
          <>
            {/* ⚡ Instant Magic Toast */}
            {magicToast && (
              <div className="bg-emerald-950/90 border border-emerald-500/50 p-3.5 rounded-2xl text-xs font-bold text-white flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span>Logged <strong className="text-emerald-300">{magicToast.name}</strong></span>
                    <span className="text-slate-400 ml-2">({magicToast.calories} kcal • {magicToast.protein}g Protein)</span>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase ${magicToast.isJunk ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {magicToast.isJunk ? 'Junk' : 'Clean'}
                </span>
              </div>
            )}

            {/* B. GREETING & TODAY'S STATUS HERO */}
            <div className="space-y-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase">
                  {timeGreeting}, {userName.toUpperCase()}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {totalCalories <= targetCal 
                    ? "You're on track today." 
                    : "You've reached your daily calorie cap."}
                </h2>
              </div>

              {/* Status Hero Card */}
              <div className="bg-[#111928] border border-slate-700/70 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Calorie Budget</span>
                    <div className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-baseline gap-2 mt-0.5">
                      <span>{caloriesRemaining.toLocaleString()}</span>
                      <span className="text-sm font-bold text-slate-400">kcal remaining</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-400">
                    <strong className="text-white">{totalCalories.toLocaleString()}</strong> / {targetCal.toLocaleString()} kcal consumed
                  </div>
                </div>

                {/* Main Calorie Progress Bar */}
                <div className="h-3 w-full bg-[#080d19] rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      overCalorie ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${calorieProgress}%` }}
                  />
                </div>

                {/* Macro Split Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {/* Protein (Visually Emphasized) */}
                  <div className="bg-[#0c1220] p-3 rounded-2xl border border-blue-500/30 text-center">
                    <span className="text-[10px] font-bold text-blue-400 uppercase block">Protein</span>
                    <div className="text-sm sm:text-base font-black text-white mt-0.5">
                      {totalProtein} <span className="text-[11px] text-slate-400 font-normal">/ {targetProtein}g</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, (totalProtein / targetProtein) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Carbs */}
                  <div className="bg-[#0c1220] p-3 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-yellow-400 uppercase block">Carbs</span>
                    <div className="text-sm sm:text-base font-black text-white mt-0.5">
                      {totalCarbs} <span className="text-[11px] text-slate-400 font-normal">/ {targetCarbs}g</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${Math.min(100, (totalCarbs / targetCarbs) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Fat */}
                  <div className="bg-[#0c1220] p-3 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-red-400 uppercase block">Fat</span>
                    <div className="text-sm sm:text-base font-black text-white mt-0.5">
                      {totalFat} <span className="text-[11px] text-slate-400 font-normal">/ {targetFat}g</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min(100, (totalFat / targetFat) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Hydration */}
                  <div className="bg-[#0c1220] p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400 uppercase block">Water</span>
                      <div className="text-xs sm:text-sm font-black text-white mt-0.5">
                        {waterGlasses} <span className="text-[10px] text-slate-400 font-normal">/ {targetWater} gl</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => updateWater(-1)} 
                        aria-label="Decrease water"
                        className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <button 
                        onClick={() => updateWater(1)} 
                        aria-label="Increase water"
                        className="w-6 h-6 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* C. PRIMARY FOOD LOGGING EXPERIENCE */}
            <div className="space-y-2">
              <span className="text-[11px] font-black tracking-widest text-slate-300 uppercase block px-1">
                WHAT DID YOU EAT?
              </span>
              
              <div className="bg-[#111928] border-2 border-emerald-500/60 hover:border-emerald-400 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/20 rounded-3xl p-3 sm:p-4 shadow-2xl transition-all duration-300">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  
                  <input
                    type="text"
                    value={magicInput}
                    onChange={(e) => setMagicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isMagicLogging) {
                        handleMagicQuickLog();
                      }
                    }}
                    disabled={isMagicLogging}
                    placeholder="Tell me what you ate..."
                    aria-label="Describe what you ate"
                    className="bg-transparent text-sm sm:text-base text-white placeholder-slate-400 outline-none flex-1 font-medium disabled:opacity-50"
                  />

                  {/* Hidden Photo Capture */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={photoInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoQuickLog(file);
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={handleVoiceListen}
                    title="Voice input"
                    aria-label="Speak meal description"
                    className={`p-2.5 rounded-xl transition flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer ${
                      isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#0c1220] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                    <span className="hidden sm:inline">{isListening ? 'Listening' : 'Voice'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLogModalInitialTab('camera');
                      setIsLogModalOpen(true);
                    }}
                    title="Snap or upload photo"
                    aria-label="Snap food photo"
                    className="p-2.5 rounded-xl bg-[#0c1220] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLogModalInitialTab('search');
                      setIsLogModalOpen(true);
                    }}
                    title="Scan barcode or manual modal entry"
                    aria-label="Scan or manual entry"
                    className="p-2.5 rounded-xl bg-[#0c1220] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    <Utensils className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMagicQuickLog()}
                    disabled={isMagicLogging || !magicInput.trim()}
                    aria-label="Log meal"
                    className="bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-black px-4 sm:px-5 py-2.5 rounded-2xl text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    {isMagicLogging ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Log</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* D. QUICK LOG (COMPACT HORIZONTAL CHIPS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black tracking-widest text-slate-300 uppercase">
                  QUICK LOG
                </span>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">1-tap fast add</span>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
                {QUICK_STAPLES.map((staple, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLogStaple(staple)}
                    className="bg-[#111928] hover:bg-[#162236] border border-slate-700/70 hover:border-emerald-500/60 px-3.5 py-2.5 rounded-2xl transition flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white shrink-0 shadow-sm cursor-pointer active:scale-95"
                  >
                    <span className="text-base">{staple.icon}</span>
                    <span>+ {staple.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({staple.calories} kcal)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* E. AI NUTRITION COACH */}
            <PersonalizedNextMeal
              todayLogs={logs}
              currentDateStr={today}
            />

            {/* F. TODAY'S FOOD TIMELINE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black tracking-widest text-slate-300 uppercase">
                  TODAY
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {logs.length} items • <strong className="text-white">{totalCalories} kcal</strong>
                </span>
              </div>

              <div className="bg-[#111928] border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-4">
                {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const).map((slot) => {
                  const slotLogs = logs.filter(l => slot === 'Snacks' ? ['Snack', 'Snacks', 'Other'].includes(l.mealType) : l.mealType === slot);
                  const slotCal = slotLogs.reduce((acc, l) => acc + l.calories, 0);

                  return (
                    <div key={slot} className="border-b border-slate-800/80 last:border-0 pb-3.5 last:pb-0 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                            slotLogs.length > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'border border-slate-700 text-slate-500'
                          }`}>
                            {slotLogs.length > 0 ? '✓' : '○'}
                          </span>
                          <h4 className="font-bold text-white uppercase tracking-wider text-xs">{slot}</h4>
                        </div>

                        <div className="flex items-center gap-2">
                          {slotLogs.length > 0 ? (
                            <span className="font-black text-slate-200">{slotCal} kcal</span>
                          ) : (
                            <button
                              onClick={() => setIsLogModalOpen(true)}
                              className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                            >
                              — Not logged (+ Add)
                            </button>
                          )}
                        </div>
                      </div>

                      {slotLogs.length > 0 && (
                        <div className="space-y-1.5 pl-6">
                          {slotLogs.map(log => (
                            <div 
                              key={log.id} 
                              onClick={() => setEditingMeal(log)}
                              className="bg-[#0c1220] hover:bg-[#131d31] p-3 rounded-2xl border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between text-xs group transition cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-bold text-white truncate group-hover:text-emerald-300 transition">{log.name}</span>
                                {log.isJunk ? (
                                  <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded border border-amber-500/30 shrink-0">Junk</span>
                                ) : (
                                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">Clean</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-slate-400 font-medium">
                                  <strong className="text-slate-200">{log.calories} kcal</strong> • <span className="text-blue-400">{log.protein}g P</span>
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingMeal(log);
                                  }}
                                  className="text-slate-500 hover:text-emerald-400 transition p-1 cursor-pointer"
                                  title="Edit meal & portions"
                                  aria-label={`Edit ${log.name}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(log.id);
                                  }} 
                                  className="text-slate-500 hover:text-red-400 transition p-1 cursor-pointer"
                                  title="Delete meal"
                                  aria-label={`Delete ${log.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: INSIGHTS & CLINICAL AUDIT */}
        {activeTab === 'insights' && (
          <>
            {/* Weekly Audit Hero Card */}
            <div className="bg-gradient-to-br from-emerald-950/70 via-[#111928] to-teal-950/70 border border-emerald-500/40 p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Weekly AI Nutritionist Audit</h3>
                  <p className="text-xs text-slate-300 mt-0.5">Clinical performance review, scorecards & next-week game plans</p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/20 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>View Full Audit</span>
              </button>
            </div>

            {/* Global Trends Widget */}
            <div className="bg-[#111928] border border-slate-700/60 p-5 rounded-3xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Global Healthy Trends</h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  100% Healthy
                </span>
              </div>
              <div className="space-y-2.5">
                {GLOBAL_HEALTHY_TRENDS.map((item) => (
                  <div key={item.rank} className="bg-[#0c1220] p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center hover:border-emerald-500/30 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 shrink-0">
                        #{item.rank}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          {item.name}
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            Score {item.healthScore}/100
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">{item.highlight} • <span className="text-emerald-400">{item.tag}</span></p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-400 block">{item.calories} kcal</span>
                      <span className="text-[10px] font-semibold text-slate-400">Grade {item.grade}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Calorie Stacked Chart */}
            <div className="bg-[#111928] border border-slate-700/60 p-5 rounded-3xl shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-indigo-400 drop-shadow-sm" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Weekly Calorie Composition</h3>
              </div>
              <div className="h-56 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...chartData].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#1e293b' }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '14px', border: '1px solid #334155', color: '#fff' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="healthy" name="Clean Food" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="junk" name="Junk Food" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Habit AI Engine */}
            <div className="bg-[#111928] border border-slate-700/60 p-5 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 relative z-10">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-emerald-400" />
                  <span>Real-Time Habits Analysis</span>
                </h3>
                <button 
                  onClick={analyzeHabits}
                  disabled={isAnalyzing || logs.length === 0}
                  className="text-xs bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-3.5 py-1.5 rounded-xl transition shadow-md cursor-pointer"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Generate Insight'}
                </button>
              </div>
              
              <div className="relative z-10">
                {aiInsight ? (
                  <div className={`p-4 rounded-2xl text-xs font-medium leading-relaxed border ${aiInsight.isWarning ? 'bg-amber-950/40 text-amber-200 border-amber-500/30' : 'bg-emerald-950/40 text-emerald-200 border-emerald-500/30'}`}>
                    {aiInsight.text}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-5 bg-[#0c1220] rounded-2xl border border-slate-800 border-dashed">
                    Log meals and water intake to generate real-time AI behavioral insights.
                  </p>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-[#111928] border border-slate-700/60 p-5 rounded-3xl shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400 drop-shadow-sm" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Dietary Recommendations</h3>
              </div>
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300 bg-[#0c1220] p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-emerald-400 font-black">•</span>
                    <span className="leading-relaxed font-medium">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Nutrition Hub & Blogs */}
            <div className="bg-[#111928] border border-slate-700/60 p-5 rounded-3xl shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400 drop-shadow-sm" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Nutrition Science Hub</h3>
              </div>
              <div className="space-y-2.5">
                {MOCK_BLOGS.map((blog) => (
                  <div key={blog.id} onClick={() => setSelectedBlog(blog)} className="group cursor-pointer bg-[#0c1220] p-4 rounded-2xl border border-slate-800 hover:border-blue-500/40 hover:bg-[#101828] transition flex items-center justify-between shadow-sm">
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition">{blog.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{blog.excerpt}</p>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded-lg shrink-0 ml-3 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition">
                      {blog.readTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB 3: RECIPES BUILDER & COOKBOOK */}
        {activeTab === 'recipes' && (
          <RecipeBuilder onFoodLogged={() => {}} />
        )}

        {/* TAB 4: SMART GROCERY LIST */}
        {activeTab === 'grocery' && (
          <SmartGroceryList />
        )}

        {/* TAB 5: LOGS HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    {historyFilter === 'today' ? `Today's Food Journal (${logs.length})` : `30-Day Food History (${weeklyLogs.length})`}
                  </h2>
                  <span className="text-xs text-slate-300 font-semibold">
                    • {historyFilter === 'today' ? totalCalories : weeklyLogs.reduce((acc, l) => acc + (l.calories || 0), 0)} total kcal
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any logged meal to view verified component breakdowns & nutrition provenance.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented Filter */}
                <div className="flex bg-[#0c1220] p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('today')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      historyFilter === 'today' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Today ({logs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      historyFilter === 'all' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Past 30 Days ({weeklyLogs.length})
                  </button>
                </div>

                <button
                  onClick={handleExportCSV}
                  title="Download Nutrition Diary as CSV spreadsheet"
                  className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  title="Download Raw JSON Food Diary Backup"
                  className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-sm cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Export JSON</span>
                </button>
              </div>
            </div>

            {/* Displayed Logs List */}
            <div className="space-y-3">
              {(historyFilter === 'today' ? logs : weeklyLogs).length === 0 ? (
                <div className="text-center py-12 bg-[#111928] rounded-3xl border-2 border-slate-800 border-dashed space-y-3">
                  <Utensils className="w-10 h-10 text-slate-600 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-slate-300">
                      {historyFilter === 'today' ? 'No meals logged today yet' : 'No historical logs recorded'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Use the photo scanner or quick-log bar to track your first meal.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLogModalInitialTab('camera');
                      setIsLogModalOpen(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Log a Meal Now</span>
                  </button>
                </div>
              ) : (
                (historyFilter === 'today' ? logs : weeklyLogs).map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <div 
                      key={log.id} 
                      className="bg-[#111928] rounded-3xl border border-slate-700/60 shadow-lg relative overflow-hidden group hover:border-slate-600 transition"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${log.isJunk ? 'bg-amber-500' : 'bg-emerald-500'} transition-colors duration-300`} />
                      
                      <div 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-4 flex gap-3.5 items-center cursor-pointer select-none"
                      >
                        {log.imageUrl ? (
                          <img src={log.imageUrl} alt={log.name} className="w-14 h-14 rounded-2xl object-cover shrink-0 bg-[#080d19] border border-slate-800 shadow-inner" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-[#080d19] border border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                            <Utensils className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-bold text-white truncate drop-shadow-sm">{log.name}</h3>
                            {log.isJunk && (
                              <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-500/30">Junk</span>
                            )}
                            {log.nutritionSource && (
                              <span className="bg-slate-800/80 text-emerald-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-slate-700">
                                {log.nutritionSource === 'USDA_FDC' ? 'USDA' : log.nutritionSource === 'BARCODE' ? 'Barcode' : 'Cloud AI'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] bg-[#080d19] text-slate-300 border border-slate-800 px-1.5 py-0.2 rounded font-bold uppercase">{log.mealType}</span>
                            <span className="text-[10px] font-medium text-slate-400">{log.date} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className="flex items-center gap-2.5 mt-1.5 text-[11px] font-medium text-slate-300 flex-wrap">
                            <span className="bg-emerald-500/10 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/20 font-bold">
                              {log.calories} kcal
                              {log.minCal && log.maxCal ? ` [${log.minCal}–${log.maxCal}]` : ''}
                            </span>
                            <span>P: {log.protein}g</span>
                            <span>C: {log.carbs}g</span>
                            <span>F: {log.fat}g</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {log.grade && (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-sm ${
                              ['A','B'].includes(log.grade) ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                              log.grade === 'C' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' :
                              'bg-red-500/10 text-red-300 border-red-500/30'
                            }`}>
                              {log.grade}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMeal(log);
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition cursor-pointer"
                            title="Edit meal"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(log.id);
                            }} 
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                            title="Delete meal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Component Breakdown Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-800 bg-[#0c1220]/90 p-4 space-y-2.5 text-xs animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Component Foods & Provenance</span>
                            <span>{Array.isArray(log.foods) ? `${log.foods.length} items` : '1 item'}</span>
                          </div>

                          {Array.isArray(log.foods) && log.foods.length > 0 ? (
                            <div className="space-y-1.5">
                              {log.foods.map((food, fIdx) => (
                                <div key={fIdx} className="bg-[#111928] p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-white">
                                      <span>{food.name}</span>
                                      {food.preparationState && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                          {food.preparationState === 'COOKED' ? '🍳 Cooked' : food.preparationState === 'RAW' ? '🌱 Raw' : '🥣 Prepared'}
                                        </span>
                                      )}
                                      {food.oilState && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          {food.oilState === 'HIGH_OIL' ? '🧈 High Oil' : food.oilState === 'MODERATE_OIL' ? '🍳 Mod Oil' : '💧 Light Oil'}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {food.portionDescription || `${food.estimatedGrams}g`}
                                      {food.minGrams && food.maxGrams ? ` [${food.minGrams}–${food.maxGrams}g]` : ''}
                                    </p>
                                  </div>
                                  <div className="text-right font-medium">
                                    <span className="font-bold text-white block">{food.calories} kcal</span>
                                    <span className="text-[10px] text-slate-400">{food.protein}g P • {food.carbs}g C • {food.fat}g F</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400">Single whole food item logged.</p>
                          )}

                          {log.verdict && (
                            <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                              <strong className="text-white">Verdict:</strong> {log.verdict}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>


      {/* Floating Action Button for Manual/Camera Food Modal */}
      <div className="fixed bottom-6 right-6 z-30 pointer-events-none">
        <button
          onClick={() => {
            setLogModalInitialTab('camera');
            setIsLogModalOpen(true);
          }}
          title="Open Advanced Meal Logger & Scanner"
          className="pointer-events-auto bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black p-3.5 sm:px-5 sm:py-3 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center gap-2 transition active:scale-95 text-xs cursor-pointer border border-emerald-300/30"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">Log Meal</span>
        </button>
      </div>


      {/* Modals */}
      <LogFoodModal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        dailyJunkCount={dailyJunkCount}
        initialTab={logModalInitialTab}
      />

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl my-auto">
            <ProfileSetup isEditing={true} onClose={() => setIsProfileModalOpen(false)} />
          </div>
        </div>
      )}

      <WeeklyAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={weeklyLogs}
        dailyStats={dailyStats}
      />

      {/* Blog Flashcard Modal */}
      {selectedBlog && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative p-6 sm:p-8">
             <button onClick={() => setSelectedBlog(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full transition">
               <X className="w-5 h-5" />
             </button>
             <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 mb-4 border border-blue-500/20">
                <BookOpen className="w-5 h-5" />
             </div>
             <h2 className="text-xl font-black text-white mb-1.5 leading-tight">{selectedBlog.title}</h2>
             <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">{selectedBlog.readTime} Read</p>
             <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
               <p>{selectedBlog.excerpt}</p>
               <p>Here is an in-depth scientific look at this nutritional topic. The key to sustainable body composition is regular progressive habit compounding. Stay hydrated, eat sufficient leucine-rich protein, and keep ultra-processed snacks within your 1-meal daily cap.</p>
               <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl mt-4">
                 <h4 className="font-bold text-white text-xs mb-1">Key Takeaway</h4>
                 <p className="text-slate-400 text-[11px]">Small daily wins compound into dramatic health results. Keep logging consistently.</p>
               </div>
             </div>
             <div className="mt-6">
               <button onClick={() => setSelectedBlog(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition text-xs">
                 Close
               </button>
             </div>
           </div>
        </div>
      )}
      {/* Interactive Meal Edit Modal */}
      {editingMeal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Logged Meal</h3>
                  <span className="text-[10px] text-slate-400">Updates daily totals deterministically</span>
                </div>
              </div>
              <button
                onClick={() => setEditingMeal(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meal Name & Portion Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Meal Name</label>
                <input
                  type="text"
                  value={editingMeal.name}
                  onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Portion / Serving</label>
                <input
                  type="text"
                  value={editingMeal.portion || ''}
                  onChange={(e) => setEditingMeal({ ...editingMeal, portion: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Meal Timing Slot Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Meal Slot</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setEditingMeal({ ...editingMeal, mealType: slot })}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      editingMeal.mealType === slot ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean vs Junk Toggle */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Classification</span>
                <span className="text-xs font-bold text-white">
                  {editingMeal.isJunk ? '🚨 Junk Food' : '🥗 Clean Fuel'}
                </span>
              </div>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMeal({ ...editingMeal, isJunk: false, category: 'healthy' })}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                    !editingMeal.isJunk ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Clean
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMeal({ ...editingMeal, isJunk: true, category: 'junk' })}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                    editingMeal.isJunk ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Junk
                </button>
              </div>
            </div>

            {/* Editable Macro Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Calories</p>
                <input
                  type="number"
                  value={editingMeal.calories}
                  onChange={(e) => setEditingMeal({ ...editingMeal, calories: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-white py-1 mt-1 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[9px] text-slate-500 block">kcal</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                <p className="text-[10px] font-bold text-blue-400 uppercase">Protein</p>
                <input
                  type="number"
                  value={editingMeal.protein}
                  onChange={(e) => setEditingMeal({ ...editingMeal, protein: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-blue-400 py-1 mt-1 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[9px] text-slate-500 block">g</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                <p className="text-[10px] font-bold text-yellow-400 uppercase">Carbs</p>
                <input
                  type="number"
                  value={editingMeal.carbs}
                  onChange={(e) => setEditingMeal({ ...editingMeal, carbs: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-yellow-400 py-1 mt-1 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[9px] text-slate-500 block">g</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                <p className="text-[10px] font-bold text-red-400 uppercase">Fat</p>
                <input
                  type="number"
                  value={editingMeal.fat}
                  onChange={(e) => setEditingMeal({ ...editingMeal, fat: Number(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg text-center text-sm font-black text-red-400 py-1 mt-1 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[9px] text-slate-500 block">g</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const id = editingMeal.id;
                  setEditingMeal(null);
                  handleDelete(id);
                }}
                className="w-1/3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveEditedMeal(editingMeal)}
                className="w-2/3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autonomous System Doctor Modal */}
      <SystemDoctorModal
        isOpen={isDoctorModalOpen}
        onClose={() => setIsDoctorModalOpen(false)}
      />

      {/* 5-Second Undo Toast Banner */}
      {deletedItemUndo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-slate-700 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-4 backdrop-blur-md">
          <div className="text-xs">
            <span>Deleted <strong className="text-emerald-300">{deletedItemUndo.name}</strong></span>
            <span className="text-slate-400 text-[10px] block">Auto-purges permanently in 5 seconds</span>
          </div>
          <button
            onClick={handleUndoDelete}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}
    </div>
  );
};

