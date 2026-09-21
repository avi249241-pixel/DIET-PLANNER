import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { FoodItem } from '../../types';
import {
  Utensils,
  Trash2,
  Plus,
  AlertTriangle,
  ArrowLeftRight,
  Sparkles,
  Check,
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
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'B':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'C':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'D':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'F':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getEvidenceBadge = (evidence?: string) => {
    switch (evidence) {
      case 'visible':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'context_derived':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
      case 'user_confirmed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
      default:
        return 'bg-slate-800/80 text-slate-400 border-slate-700/60';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Swap Success Toast */}
      {swapSuccessMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-lg shadow-emerald-500/10">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{swapSuccessMsg}</span>
        </div>
      )}

      {/* Hero Energy Budget & Macro Breakdown Card */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Daily Energy Budget
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-1">
              {totals.calories}{' '}
              <span className="text-base font-normal text-slate-500">/ {targetCal} kcal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-2xl text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Junk Calorie Ratio</div>
              <div className={`text-base font-black font-mono mt-0.5 ${junkPercent > maxJunk ? 'text-rose-400' : 'text-emerald-400'}`}>
                {junkPercent}% <span className="text-xs text-slate-500 font-normal">/ max {maxJunk}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calories Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-400">Total Consumption Progress</span>
            <span className="font-mono text-emerald-400">{calPercent}% of target</span>
          </div>
          <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/90 p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, calPercent)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                calPercent > 105 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
              }`}
            />
          </div>
        </div>

        {/* 3 Macro Cards (Protein, Carbs, Fat) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Protein */}
          <div className="bg-slate-950/80 border border-blue-500/20 p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-blue-400 uppercase tracking-wider">Protein</span>
              <span className="font-mono font-black text-white text-xs">
                {totals.protein}g <span className="text-slate-500 font-normal">/ {targetProt}g</span>
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${protPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
                className="h-full bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"
              />
            </div>
            <div className="text-[10px] text-blue-400 font-mono text-right font-semibold">{protPercent}% reached</div>
          </div>

          {/* Carbs */}
          <div className="bg-slate-950/80 border border-amber-500/20 p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-400 uppercase tracking-wider">Carbs</span>
              <span className="font-mono font-black text-white text-xs">
                {totals.carbs}g <span className="text-slate-500 font-normal">/ {targetCarb}g</span>
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${carbPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className="h-full bg-amber-500 rounded-full shadow-sm shadow-amber-500/50"
              />
            </div>
            <div className="text-[10px] text-amber-400 font-mono text-right font-semibold">{carbPercent}% reached</div>
          </div>

          {/* Fat */}
          <div className="bg-slate-950/80 border border-rose-500/20 p-4 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-rose-400 uppercase tracking-wider">Dietary Fat</span>
              <span className="font-mono font-black text-white text-xs">
                {totals.fat}g <span className="text-slate-500 font-normal">/ {targetFat}g</span>
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fatPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                className="h-full bg-rose-500 rounded-full shadow-sm shadow-rose-500/50"
              />
            </div>
            <div className="text-[10px] text-rose-400 font-mono text-right font-semibold">{fatPercent}% reached</div>
          </div>
        </div>
      </div>

      {/* Logged Foods List Card */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Today's Meal Ledger</h2>
              <p className="text-xs text-slate-400 font-medium">{foodItems.length} meals logged</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveScreen('main-log')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Meal by Photo</span>
          </button>
        </div>

        {/* Empty State */}
        {foodItems.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-slate-500 mx-auto flex items-center justify-center border border-slate-800">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-white">No meals logged today yet</div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Upload a photo of your plate to instantly extract whole-food macros and check if it's clean or junk.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('main-log')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Meal</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            <AnimatePresence initial={false}>
              {foodItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group hover:bg-slate-950/40 px-3 rounded-2xl transition">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{item.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-md border border-slate-700">
                          {item.mealType}
                        </span>
                        {item.nutritionSource && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                            item.nutritionSource === 'USDA_FDC'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : item.nutritionSource === 'OPEN_FOOD_FACTS'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                          }`}>
                            {item.nutritionSource}
                          </span>
                        )}
                        {item.isJunk && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-md border border-rose-500/30">
                            🚨 Junk
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>{item.portion || '1 serving'}</span>
                        <span>&bull;</span>
                        <span className="font-mono text-emerald-400 font-bold">{item.calories} kcal</span>
                        <span>&bull;</span>
                        <span className="font-mono text-blue-400 font-medium">{item.protein}g P</span>
                        <span>&bull;</span>
                        <span className="font-mono text-amber-400 font-medium">{item.carbs}g C</span>
                        <span>&bull;</span>
                        <span className="font-mono text-rose-400 font-medium">{item.fat}g F</span>
                      </div>

                      {/* Component Evidence Chips */}
                      {item.foods && item.foods.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {item.foods.map((comp, cIdx) => (
                            <span
                              key={cIdx}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getEvidenceBadge(comp.evidence)}`}
                              title={`Evidence: ${comp.evidence || 'visible'} • Mass: ~${comp.estimatedGrams}g`}
                            >
                              {comp.name}: {comp.evidence || 'visible'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-center">
                      {/* Health Score */}
                      {item.healthScore !== undefined && (
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-slate-500">Score</div>
                          <div className="text-xs font-bold text-slate-300 font-mono">{item.healthScore}/100</div>
                        </div>
                      )}

                      {/* Grade Badge */}
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-sm font-mono ${getGradeBadge(item.grade)}`}
                      >
                        {item.grade || 'A'}
                      </div>

                      {/* Meal Swap Button */}
                      <button
                        type="button"
                        onClick={() => setSwappingItemId(swappingItemId === item.id ? null : item.id)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          swappingItemId === item.id
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
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

                  {/* Expandable Meal Swap Alternatives */}
                  <AnimatePresence>
                    {swappingItemId === item.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="mb-4 bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                              Balanced Meal-Swap Alternatives
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Calibrated to {item.calories} kcal &bull; {item.protein}g protein
                          </span>
                        </div>

                        {(() => {
                          const swapData = getMealSwapSuggestions(item);
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              {swapData.alternatives.map((swap) => (
                                <div
                                  key={swap.id}
                                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl flex flex-col justify-between space-y-3 transition"
                                >
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] mb-1">
                                      <span className="text-emerald-400 font-bold uppercase">{swap.tag}</span>
                                      <span className="text-emerald-300 font-black px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
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

                                    <button
                                      type="button"
                                      onClick={() => handleExecuteSwap(item, swap)}
                                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-2 px-3 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Swap this meal</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
