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
    switch (grade) {
      case 'A':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'D':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'F':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getEvidenceBadge = (evidence?: string) => {
    switch (evidence) {
      case 'visible':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'context_derived':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'user_confirmed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'unobservable_unknown':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn text-slate-800">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 text-emerald-600" />
            Daily Nutrition Breakdown
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time macro composition, health scores, and caloric intake from in-memory meal entries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('main-log')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Meal</span>
        </button>
      </div>

      {/* Swap Success Banner */}
      {swapSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 animate-fadeIn shadow-xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <strong className="text-slate-900">Meal Replaced:</strong> {swapSuccessMsg}
          </div>
        </div>
      )}

      {/* Macro Composition Summary Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Energy Budget</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5">
              {totals.calories}{' '}
              <span className="text-sm font-normal text-slate-400">/ {targetCal} kcal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Junk Calorie Ratio</div>
              <div className={`text-sm font-bold font-mono ${junkPercent > maxJunk ? 'text-rose-600' : 'text-emerald-600'}`}>
                {junkPercent}% <span className="text-xs text-slate-400 font-normal">/ max {maxJunk}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calories Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-600">Caloric Progress</span>
            <span className="font-mono text-emerald-700 font-bold">{calPercent}% of target</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, calPercent)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                calPercent > 105 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
            />
          </div>
        </div>

        {/* Macros 3-Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Protein */}
          <div className="bg-blue-50/60 border border-blue-100/90 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-blue-700 uppercase tracking-wider">Protein</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {totals.protein}g / {targetProt}g
              </span>
            </div>
            <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${protPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
            <div className="text-[11px] text-blue-600 font-mono text-right">{protPercent}% reached</div>
          </div>

          {/* Carbs */}
          <div className="bg-amber-50/60 border border-amber-100/90 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-800 uppercase tracking-wider">Carbohydrates</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {totals.carbs}g / {targetCarb}g
              </span>
            </div>
            <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${carbPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className="h-full bg-amber-600 rounded-full"
              />
            </div>
            <div className="text-[11px] text-amber-700 font-mono text-right">{carbPercent}% reached</div>
          </div>

          {/* Fat */}
          <div className="bg-rose-50/60 border border-rose-100/90 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-rose-700 uppercase tracking-wider">Dietary Fat</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
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
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Logged Food Items</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono font-medium">
              {foodItems.length} items
            </span>
          </h2>
        </div>

        {/* Empty State */}
        {foodItems.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">No food logged yet today</div>
              <div className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Your daily log is currently empty. Use the Quick Log screen to add a meal or test mock entries.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('main-log')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Meal</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {foodItems.map((item) => (
              <React.Fragment key={item.id}>
                <div
                  className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group hover:bg-slate-50/70 px-2 rounded-xl transition"
                >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{item.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                      {item.mealType}
                    </span>
                    {item.nutritionSource && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                        item.nutritionSource === 'USDA_FDC'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.nutritionSource === 'OPEN_FOOD_FACTS'
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                          : item.nutritionSource === 'LOCAL_AUTHORITATIVE' || item.nutritionSource === 'AUTHORITATIVE_DB'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {item.nutritionSource}
                      </span>
                    )}
                    {item.massBasis === 'two_view_calibrated' && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
                        2-View Calibrated
                      </span>
                    )}
                    {(item.hasUnobservableUnknown || item.foods?.some(f => f.evidence === 'unobservable_unknown')) && (
                      <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Cooking Oil/Sauce: Unknown, in range</span>
                      </span>
                    )}
                    {item.atwaterDiagnostic?.isInconsistent && (
                      <span 
                        className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md border border-blue-200 cursor-help"
                        title={item.atwaterDiagnostic.reason}
                      >
                        Atwater &Delta; {item.atwaterDiagnostic.delta} kcal (Diagnostic)
                      </span>
                    )}
                    {item.isJunk && (
                      <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-md border border-rose-200">
                        Junk
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>{item.portion || '1 serving'}</span>
                    <span>&bull;</span>
                    <span className="font-mono text-slate-900 font-bold">{item.calories} kcal</span>
                    {item.calorieRange && (
                      <span className="font-mono text-[11px] text-slate-500">
                        [p10-p90: {item.calorieRange[0]} - {item.calorieRange[1]} kcal]
                      </span>
                    )}
                    <span>&bull;</span>
                    <span className="font-mono text-blue-600 font-medium">{item.protein}g P</span>
                    <span>&bull;</span>
                    <span className="font-mono text-amber-600 font-medium">{item.carbs}g C</span>
                    <span>&bull;</span>
                    <span className="font-mono text-rose-600 font-medium">{item.fat}g F</span>
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
                      <div className="text-[10px] uppercase font-bold text-slate-400">Health Score</div>
                      <div className="text-xs font-bold text-slate-800 font-mono">{item.healthScore}/100</div>
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
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200'
                    }`}
                    title="Suggest balanced meal swaps"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">{swappingItemId === item.id ? 'Close' : 'Swap'}</span>
                  </button>

                  {/* Delete Item */}
                  <button
                    type="button"
                    onClick={() => removeFoodItem(item.id)}
                    title="Remove item"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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
                    className="mb-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Meal-Swap Alternatives
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Matched to {item.calories} kcal &bull; {item.protein}g protein
                      </span>
                    </div>

                    {/* Alternatives Grid with Graceful Degradation */}
                    {(() => {
                      const swapData = getMealSwapSuggestions(item);
                      return (
                        <>
                          {swapData.isDegraded && (
                            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                              <Info className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>{swapData.explanation}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            {swapData.alternatives.map((swap) => (
                              <div
                                key={swap.id}
                                className="bg-white border border-slate-200 hover:border-emerald-400 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-xs transition"
                              >
                                <div>
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="text-emerald-700 font-bold uppercase">{swap.tag}</span>
                                    <span className="text-emerald-800 font-black px-1.5 py-0.5 rounded bg-emerald-100/70 border border-emerald-200">
                                      Grade {swap.grade}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-bold text-slate-900 leading-snug">{swap.name}</h5>
                                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                    {swap.reason}
                                  </p>
                                </div>

                                <div className="space-y-2 pt-1">
                                  <div className="flex items-center justify-between text-[11px] font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                    <span className="text-slate-900 font-bold">{swap.calories} kcal</span>
                                    <span className="text-blue-600">{swap.protein}g P</span>
                                    <span className="text-amber-600">{swap.carbs}g C</span>
                                    <span className="text-rose-600">{swap.fat}g F</span>
                                  </div>

                                  <div className="text-[10px] font-bold text-center">
                                    <span className={swap.calorieDelta <= 0 ? 'text-emerald-700' : 'text-slate-500'}>
                                      {swap.calorieDelta <= 0
                                        ? `${Math.abs(swap.calorieDelta)} kcal saved`
                                        : `+${swap.calorieDelta} kcal`}
                                    </span>
                                    <span className="text-slate-400 mx-1">&bull;</span>
                                    <span className={swap.proteinDelta >= 0 ? 'text-blue-700' : 'text-slate-500'}>
                                      {swap.proteinDelta >= 0
                                        ? `+${swap.proteinDelta}g protein`
                                        : `${swap.proteinDelta}g protein`}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleExecuteSwap(item, swap)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
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
