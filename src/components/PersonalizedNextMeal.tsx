import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { FoodItem, PersonalizedCoachBriefing, PersonalizedMealOption } from '../types';
import { Bot, Sparkles, RefreshCw, Zap, ChefHat, Store, Check, Plus, AlertCircle, Clock, ChevronDown, ChevronUp, Flame } from 'lucide-react';

interface PersonalizedNextMealProps {
  todayLogs: FoodItem[];
  currentDateStr: string;
  onMealAutoLogged?: () => void;
}

export const PersonalizedNextMeal: React.FC<PersonalizedNextMealProps> = ({
  todayLogs,
  currentDateStr,
  onMealAutoLogged
}) => {
  const { user, profile } = useAuth();
  const [briefing, setBriefing] = useState<PersonalizedCoachBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedMealNames, setLoggedMealNames] = useState<string[]>([]);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [expandedOption, setExpandedOption] = useState<number | null>(null);
  const lastFetchKeyRef = React.useRef<string>('');

  const consumedCalories = (todayLogs || []).reduce((acc, l) => acc + (l.calories || 0), 0);
  const consumedProtein = (todayLogs || []).reduce((acc, l) => acc + (l.protein || 0), 0);
  const targetProtein = profile?.targetProtein || 140;
  const proteinShortage = Math.max(0, targetProtein - consumedProtein);

  const fetchRecommendations = async () => {
    if (!profile) return;

    const fetchKey = `${profile.targetCalories}-${consumedCalories}-${todayLogs.length}-${new Date().getHours()}`;
    
    if (lastFetchKeyRef.current === fetchKey && briefing) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/personalized-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          todayLogs,
          currentHour: new Date().getHours()
        })
      });

      const resData = await res.json();
      if (!resData.success) {
        throw new Error(resData.error || 'Failed to fetch recommendations');
      }
      lastFetchKeyRef.current = fetchKey;
      setBriefing(resData.data);
    } catch (err: any) {
      console.error('Error getting personalized meals:', err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        setError('AI coach rate limit reached. Click Refresh in a moment.');
      } else {
        setError('Unable to load coach recommendations right now.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.automationPreferences?.autoSuggestNextMeal !== false) {
      const timer = setTimeout(() => {
        fetchRecommendations();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [profile?.updatedAt, todayLogs.length]);

  const handleAutoLog = async (meal: PersonalizedMealOption, index: number) => {
    if (!user) return;
    setLoggingId(meal.name);
    try {
      const logId = `auto-${Date.now()}`;
      const foodItemData = {
        id: logId,
        userId: user.uid,
        name: meal.name,
        isJunk: false,
        calories: Number(meal.calories),
        protein: Number(meal.protein),
        carbs: Number(meal.carbs),
        fat: Number(meal.fat),
        sugar: Number(meal.sugar || 2),
        sodium: Number(meal.sodium || 280),
        portion: meal.prepTime ? `1 serving (${meal.prepTime})` : '1 standard serving',
        healthScore: Number(meal.healthScore || 94),
        mealType: (briefing?.currentSlot as any) || (new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 16 ? 'Lunch' : 'Dinner'),
        category: 'healthy' as const,
        date: currentDateStr,
        createdAt: Date.now(),
        verdict: meal.matchReason || 'AI recommended coach whole food athletic option'
      };

      try {
        const cached = localStorage.getItem(`foodLogs_${user.uid}_${currentDateStr}`);
        const existing = cached ? JSON.parse(cached) : [];
        localStorage.setItem(`foodLogs_${user.uid}_${currentDateStr}`, JSON.stringify([foodItemData, ...existing]));

        const cachedWeekly = localStorage.getItem(`weeklyFoodLogs_${user.uid}`);
        const existingWeekly = cachedWeekly ? JSON.parse(cachedWeekly) : [];
        localStorage.setItem(`weeklyFoodLogs_${user.uid}`, JSON.stringify([foodItemData, ...existingWeekly]));
      } catch {}

      try {
        await addDoc(collection(db, 'users', user.uid, 'foodLogs'), foodItemData);
      } catch (err) {
        console.warn('Firestore auto-log notice:', err);
      }

      setLoggedMealNames(prev => [...prev, meal.name]);
      if (onMealAutoLogged) {
        onMealAutoLogged();
      }
    } catch (err: any) {
      console.warn('Error auto logging meal:', err);
    } finally {
      setLoggingId(null);
    }
  };

  const primaryMeal = briefing?.recommendations?.[0];
  const alternativeMeals = briefing?.recommendations?.slice(1) || [];

  return (
    <div className="bg-[#111928] border border-slate-700/60 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
      {/* Coach Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-emerald-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-300">Your Coach</h3>
              <span className="text-[10px] bg-purple-500/15 border border-purple-500/30 text-purple-200 font-bold px-2 py-0.5 rounded-full">
                {briefing?.currentSlot || 'Next Meal'}
              </span>
            </div>
            <p className="text-sm font-bold text-white tracking-tight mt-0.5">
              {proteinShortage > 20 
                ? `You're ${proteinShortage}g short on protein today.`
                : briefing?.coachInsight || "You're nicely on track with your nutritional budget."}
            </p>
          </div>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={loading}
          title="Refresh AI Recommendations"
          className="text-xs flex items-center gap-1.5 bg-[#0c1220] hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 transition font-medium disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          <span className="hidden sm:inline">{loading ? 'Analyzing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !briefing && (
        <div className="bg-[#0c1220] border border-slate-800 p-5 rounded-2xl animate-pulse space-y-3">
          <div className="h-4 bg-slate-800 rounded-md w-1/3"></div>
          <div className="h-6 bg-slate-800/60 rounded-lg w-3/4"></div>
          <div className="h-10 bg-slate-800/40 rounded-xl w-full"></div>
        </div>
      )}

      {/* Primary Hero Recommendation Card */}
      {primaryMeal && (
        <div className="bg-gradient-to-br from-[#0c1220] via-[#0f172a] to-purple-950/20 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Best Next Move</span>
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Grade {primaryMeal.grade}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 flex-1">
              <h4 className="text-base sm:text-lg font-black text-white leading-snug">
                {primaryMeal.name}
              </h4>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {primaryMeal.matchReason}
              </p>
            </div>

            {/* Macro Summary Pill */}
            <div className="flex items-center gap-2 bg-[#080d19] px-3 py-2 rounded-xl border border-slate-800 shrink-0 text-xs font-bold">
              <span className="text-white">{primaryMeal.calories} kcal</span>
              <span className="text-slate-500">•</span>
              <span className="text-blue-400">{primaryMeal.protein}g protein</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">{primaryMeal.carbs}g carbs</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-1 flex items-center gap-2.5">
            <button
              onClick={() => handleAutoLog(primaryMeal, 0)}
              disabled={loggedMealNames.includes(primaryMeal.name) || loggingId === primaryMeal.name}
              className={`flex-1 flex items-center justify-center gap-2 text-xs font-black py-3 px-4 rounded-xl transition shadow-md cursor-pointer ${
                loggedMealNames.includes(primaryMeal.name)
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-emerald-500/20 active:scale-95'
              }`}
            >
              {loggedMealNames.includes(primaryMeal.name) ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Logged to Today's Diary</span>
                </>
              ) : loggingId === primaryMeal.name ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Logging to Diary...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Log this meal</span>
                </>
              )}
            </button>

            {alternativeMeals.length > 0 && (
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="text-xs font-bold text-slate-300 hover:text-white bg-[#0c1220] hover:bg-slate-800 border border-slate-800 px-3.5 py-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{showAlternatives ? 'Hide Options' : `${alternativeMeals.length} More Options`}</span>
                {showAlternatives ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expandable Alternative Options */}
      {showAlternatives && alternativeMeals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-2">
          {alternativeMeals.map((meal, idx) => {
            const isLogged = loggedMealNames.includes(meal.name);
            const isLogging = loggingId === meal.name;
            return (
              <div
                key={idx}
                className="bg-[#0c1220] border border-slate-800 hover:border-slate-700 p-4 rounded-2xl flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-slate-400 font-bold uppercase">{meal.type}</span>
                    <span className="text-emerald-400 font-black">Grade {meal.grade}</span>
                  </div>
                  <h5 className="text-sm font-bold text-white line-clamp-1">{meal.name}</h5>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{meal.matchReason}</p>
                  <div className="mt-2 text-xs font-semibold text-slate-300">
                    <strong className="text-white">{meal.calories} kcal</strong> • <span className="text-blue-400">{meal.protein}g P</span> • <span className="text-emerald-400">{meal.carbs}g C</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAutoLog(meal, idx + 1)}
                  disabled={isLogged || isLogging}
                  className={`w-full text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isLogged 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  {isLogged ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{isLogged ? 'Logged' : isLogging ? 'Logging...' : 'Log this option'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

