import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { FoodItem, MealType } from '../../types';
import {
  Utensils,
  Trash2,
  Plus,
  Flame,
  Heart,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ArrowLeftRight,
  Sparkles,
  Check,
  X,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getMealSwapSuggestions, MealSwapOption } from '../../lib/mealSwapEngine';

export function DailyLogScreen() {
  const { foodItems, userProfile, updateFoodItem, removeFoodItem, setActiveScreen } = useStore();
  const [swappingItemId, setSwappingItemId] = useState<string | null>(null);
  const [swapSuccessMsg, setSwapSuccessMsg] = useState<string | null>(null);

  const handleExecuteSwap = async (originalItem: FoodItem, swapOption: MealSwapOption) => {
    await updateFoodItem(originalItem.id, {
      name: swapOption.name,
      calories: swapOption.calories,
      protein: swapOption.protein,
      carbs: swapOption.carbs,
      fat: swapOption.fat,
      sugar: swapOption.sugar,
      sodium: swapOption.sodium,
      portion: swapOption.portion,
      healthScore: swapOption.healthScore,
      grade: swapOption.grade,
      isJunk: swapOption.isJunk,
      swapSuggestion: `Swapped from "${originalItem.name}". ${swapOption.reason}`
    });

    setSwapSuccessMsg(`Swapped "${originalItem.name}" for "${swapOption.name}"!`);
    setSwappingItemId(null);
    setTimeout(() => setSwapSuccessMsg(null), 4000);
  };

  // Aggregate totals
  const totals = foodItems.reduce(
    (acc, item) => {
      acc.calories += item.calories || 0;
      acc.protein += item.protein || 0;
      acc.carbs += item.carbs || 0;
      acc.fat += item.fat || 0;
      if (item.isJunk) {
        acc.junkCalories += item.calories || 0;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, junkCalories: 0 }
  );

  const targetCal = userProfile.targetCalories || 2000;
  const targetProt = userProfile.targetProtein || 150;
  const targetCarb = userProfile.targetCarbs || 200;
  const targetFat = userProfile.targetFat || 65;

  const calPercent = Math.min(100, Math.round((totals.calories / targetCal) * 100));
  const protPercent = Math.min(100, Math.round((totals.protein / targetProt) * 100));
  const carbPercent = Math.min(100, Math.round((totals.carbs / targetCarb) * 100));
  const fatPercent = Math.min(100, Math.round((totals.fat / targetFat) * 100));

  const junkPercent = totals.calories > 0 ? Math.round((totals.junkCalories / totals.calories) * 100) : 0;
  const maxJunk = userProfile.maxJunkCaloriePercent || 15;

  const getGradeBadge = (grade: string) => {
    switch (grade?.toUpperCase()) {
      case 'A':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'B':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'C':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'D':
      case 'F':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 text-emerald-400" />
            Daily Nutrition Breakdown
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time macro composition, health scores, and caloric intake from in-memory meal entries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('main-log')}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Meal</span>
        </button>
      </div>

      {/* Swap Success Banner */}
      {swapSuccessMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-xs text-emerald-200 animate-fadeIn shadow-lg">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <strong className="text-white">Meal Replaced:</strong> {swapSuccessMsg}
          </div>
        </div>
      )}

      {/* Macro Composition Summary Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Energy Budget</div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-0.5">
              {totals.calories}{' '}
              <span className="text-sm font-normal text-slate-400">/ {targetCal} kcal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Junk Calorie Ratio</div>
              <div className={`text-sm font-bold font-mono ${junkPercent > maxJunk ? 'text-rose-400' : 'text-emerald-400'}`}>
                {junkPercent}% <span className="text-xs text-slate-500 font-normal">/ max {maxJunk}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calories Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">Caloric Progress</span>
            <span className="font-mono text-emerald-400">{calPercent}% of target</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, calPercent)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                calPercent > 105 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
            />
          </div>
        </div>

        {/* Macros 3-Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Protein */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-blue-400 uppercase tracking-wider">Protein</span>
              <span className="font-mono font-bold text-white text-xs">
                {totals.protein}g / {targetProt}g
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${protPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
                className="h-full bg-blue-500 rounded-full"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono text-right">{protPercent}% reached</div>
          </div>

          {/* Carbs */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-400 uppercase tracking-wider">Carbohydrates</span>
              <span className="font-mono font-bold text-white text-xs">
                {totals.carbs}g / {targetCarb}g
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${carbPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className="h-full bg-amber-500 rounded-full"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono text-right">{carbPercent}% reached</div>
          </div>

          {/* Fat */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-rose-400 uppercase tracking-wider">Dietary Fat</span>
              <span className="font-mono font-bold text-white text-xs">
                {totals.fat}g / {targetFat}g
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fatPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                className="h-full bg-rose-500 rounded-full"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono text-right">{fatPercent}% reached</div>
          </div>
        </div>
      </div>

      {/* Logged Foods List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Logged Food Items</span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-mono">
              {foodItems.length} items
            </span>
          </h2>
        </div>

        {/* Empty State */}
        {foodItems.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 mx-auto flex items-center justify-center">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-white">No food logged yet today</div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Your daily log is currently empty. Use the Quick Log screen to add a meal or test mock entries.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('main-log')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Meal</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {foodItems.map((item) => (
              <React.Fragment key={item.id}>
                <div
                  className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group hover:bg-slate-800/20 px-2 rounded-xl transition"
                >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{item.name}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-md border border-slate-700">
                      {item.mealType}
                    </span>
                    {item.nutritionSource && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                        item.nutritionSource === 'USDA_FDC'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : item.nutritionSource === 'OPEN_FOOD_FACTS'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : item.nutritionSource === 'LOCAL_AUTHORITATIVE' || item.nutritionSource === 'AUTHORITATIVE_DB'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {item.nutritionSource}
                      </span>
                    )}
                    {item.massBasis === 'two_view_calibrated' && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
                        2-View Calibrated
                      </span>
                    )}
                    {(item.hasUnobservableUnknown || item.foods?.some(f => f.evidence === 'unobservable_unknown')) && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Cooking Oil/Sauce: Unknown, in range</span>
                      </span>
                    )}
                    {item.atwaterDiagnostic?.isInconsistent && (
                      <span 
                        className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-500/30 cursor-help"
                        title={item.atwaterDiagnostic.reason}
                      >
                        Atwater &Delta; {item.atwaterDiagnostic.delta} kcal (Diagnostic)
                      </span>
                    )}
                    {item.isJunk && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-md border border-rose-500/30">
                        Junk
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{item.portion || '1 serving'}</span>
                    <span>&bull;</span>
                    <span className="font-mono text-slate-200 font-bold">{item.calories} kcal</span>
                    {item.calorieRange && (
                      <span className="font-mono text-[11px] text-slate-400">
                        [p10-p90: {item.calorieRange[0]} - {item.calorieRange[1]} kcal]
                      </span>
                    )}
                    <span>&bull;</span>
                    <span className="font-mono text-blue-400">{item.protein}g P</span>
                    <span>&bull;</span>
                    <span className="font-mono text-amber-400">{item.carbs}g C</span>
                    <span>&bull;</span>
                    <span className="font-mono text-rose-400">{item.fat}g F</span>
                  </div>

                  {/* Component Evidence Chips */}
                  {item.foods && item.foods.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {item.foods.map((comp, cIdx) => (
                        <span
                          key={cIdx}
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getEvidenceBadge(
                            comp.evidence
                          )}`}
                          title={`Evidence: ${comp.evidence || 'visible'} • Mass: ~${comp.estimatedGrams}g`}
                        >
                          {comp.name}: {comp.evidence || 'visible'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  {/* Health Score Badge */}
                  {item.healthScore !== undefined && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Health Score</div>
                      <div className="text-xs font-bold text-slate-200 font-mono">{item.healthScore}/100</div>
                    </div>
                  )}

                  {/* Grade Badge */}
                  <div
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-sm font-mono ${getGradeBadge(
                      item.grade
                    )}`}
                  >
                    {item.grade || 'A'}
                  </div>

                  {/* Meal-Swap Suggestion Trigger */}
                  <button
                    type="button"
                    onClick={() => setSwappingItemId(swappingItemId === item.id ? null : item.id)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      swappingItemId === item.id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-slate-700/80'
                    }`}
                    title="Suggest balanced meal swaps"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{swappingItemId === item.id ? 'Close' : 'Swap'}</span>
                  </button>

                  {/* Delete Item */}
                  <button
                    type="button"
                    onClick={() => removeFoodItem(item.id)}
                    title="Remove item"
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expandable Meal Swap Suggestions Drawer */}
              <AnimatePresence>
                {swappingItemId === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="mb-4 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">
                          Meal-Swap Alternatives
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Matched to {item.calories} kcal &bull; {item.protein}g protein
                      </span>
                    </div>

                    {/* Alternatives Grid with Graceful Degradation */}
                    {(() => {
                      const swapData = getMealSwapSuggestions(item);
                      return (
                        <>
                          {swapData.isDegraded && (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                              <Info className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>{swapData.explanation}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            {swapData.alternatives.map((swap) => (
                              <div
                                key={swap.id}
                                className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl flex flex-col justify-between space-y-3 transition"
                              >
                                <div>
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="text-emerald-400 font-bold uppercase">{swap.tag}</span>
                                    <span className="text-emerald-300 font-black px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                                      Grade {swap.grade}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-bold text-white leading-snug">{swap.name}</h5>
                                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                                    {swap.reason}
                                  </p>
                                </div>

                                <div className="space-y-2 pt-1">
                                  <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                    <span className="text-white font-bold">{swap.calories} kcal</span>
                                    <span className="text-blue-400">{swap.protein}g P</span>
                                    <span className="text-amber-400">{swap.carbs}g C</span>
                                    <span className="text-rose-400">{swap.fat}g F</span>
                                  </div>

                                  <div className="text-[10px] font-bold text-center">
                                    <span className={swap.calorieDelta <= 0 ? 'text-emerald-400' : 'text-slate-400'}>
                                      {swap.calorieDelta <= 0
                                        ? `${Math.abs(swap.calorieDelta)} kcal saved`
                                        : `+${swap.calorieDelta} kcal`}
                                    </span>
                                    <span className="text-slate-500 mx-1">&bull;</span>
                                    <span className={swap.proteinDelta >= 0 ? 'text-blue-400' : 'text-slate-400'}>
                                      {swap.proteinDelta >= 0
                                        ? `+${swap.proteinDelta}g protein`
                                        : `${swap.proteinDelta}g protein`}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleExecuteSwap(item, swap)}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-2 px-3 rounded-lg shadow-sm shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Swap this meal</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
