import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { DietaryStyle, FoodItem } from '../../types';
import {
  Compass,
  CheckCircle2,
  Flame,
  Sparkles,
  Award,
  Shield,
  Sliders,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Clock,
  History,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateMifflinStJeor } from './ProfileScreen';
import { calculateAdaptiveRecalibration } from '../../lib/adaptiveRecalibration';

interface PlanDefinition {
  style: DietaryStyle;
  tagline: string;
  description: string;
  macroRatios: { protein: string; carbs: string; fat: string };
  bestFor: string;
  staples: string[];
}

const DIET_PLANS: PlanDefinition[] = [
  {
    style: 'High Protein Athletic',
    tagline: 'Maximum muscle recovery, satiety, and athletic output',
    description: 'Elevated protein intake (2.0–2.4g/kg) combined with complex carbohydrates to fuel demanding resistance training and preserve lean tissue.',
    macroRatios: { protein: '35%', carbs: '40%', fat: '25%' },
    bestFor: 'Strength athletes, bodybuilders, active fitness enthusiasts',
    staples: ['Chicken breast', 'Whey protein', 'Egg whites', 'Oats', 'Greek yogurt', 'Quinoa']
  },
  {
    style: 'Standard Balanced',
    tagline: 'Sustainable, flexible lifelong nutrition',
    description: 'Moderated macronutrient balance supporting daily metabolic health, cognitive focus, and active lifestyle without restrictive food groups.',
    macroRatios: { protein: '25%', carbs: '50%', fat: '25%' },
    bestFor: 'General wellness, sustainable maintenance, steady body recomposition',
    staples: ['Lean meats', 'Brown rice', 'Sweet potatoes', 'Whole eggs', 'Berries', 'Olive oil']
  },
  {
    style: 'Mediterranean',
    tagline: 'Cardiovascular longevity and natural unrefined foods',
    description: 'Heart-healthy fats from extra virgin olive oil, abundant wild seafood, vegetables, legumes, and unrefined grains backed by deep clinical evidence.',
    macroRatios: { protein: '20%', carbs: '45%', fat: '35%' },
    bestFor: 'Long-term cardiovascular health, anti-inflammatory lifestyle',
    staples: ['Salmon', 'Extra virgin olive oil', 'Avocado', 'Walnuts', 'Lentils', 'Spinach']
  },
  {
    style: 'Keto / Low Carb',
    tagline: 'Ketogenic fat adaptation and insulin sensitivity',
    description: 'Ultra-low carbohydrate (<50g/day) protocol transitioning metabolic substrate to ketone bodies. Reduces blood sugar volatility and appetite spikes.',
    macroRatios: { protein: '25%', carbs: '5%', fat: '70%' },
    bestFor: 'Rapid fat loss, blood glucose stability, appetite control',
    staples: ['Grass-fed beef', 'Avocado oil', 'Pecan nuts', 'Butter/Ghee', 'Cauliflower', 'Eggs']
  },
  {
    style: 'Vegetarian',
    tagline: 'Plant-forward nutrition with dairy and eggs',
    description: 'Plant-focused diet omitting meat and poultry while incorporating high-quality vegetarian protein sources like eggs, dairy, and legumes.',
    macroRatios: { protein: '25%', carbs: '50%', fat: '25%' },
    bestFor: 'Eco-conscious athletes, cholesterol moderation, ethical nutrition',
    staples: ['Cottage cheese', 'Tofu/Tempeh', 'Eggs', 'Chickpeas', 'Hemp seeds', 'Lentils']
  },
  {
    style: 'Vegan',
    tagline: '100% plant-derived vitality and ethical sustenance',
    description: 'Exclusively plant-based eating designed to supply complete amino acid profiles through diverse legumes, grains, nuts, and fortified staples.',
    macroRatios: { protein: '20%', carbs: '55%', fat: '25%' },
    bestFor: 'Plant-exclusive lifestyle, ethical dietary choices',
    staples: ['Seitan', 'Edamame', 'Lentils', 'Chia seeds', 'Nutritional yeast', 'Tempeh']
  },
  {
    style: 'Pescatarian',
    tagline: 'Marine omega-3 density paired with vegetarian staples',
    description: 'Combines the health benefits of plant-based eating with high-protein, omega-3 rich fish and shellfish for superior micronutrient density.',
    macroRatios: { protein: '30%', carbs: '45%', fat: '25%' },
    bestFor: 'High-protein pesco-vegetarian lifestyle with clean lipids',
    staples: ['Wild salmon', 'Tuna', 'Cod', 'Shrimp', 'Quinoa', 'Asparagus']
  },
  {
    style: 'Intermittent Fasting',
    tagline: 'Time-restricted feeding for metabolic autophagy',
    description: 'Concentrates daily nutritional intake into a compressed eating window (e.g. 16:8) to encourage cellular repair and simplify deficit adherence.',
    macroRatios: { protein: '30%', carbs: '45%', fat: '25%' },
    bestFor: 'Simplified meal timing, stubborn fat loss, metabolic flexibility',
    staples: ['High-satiety proteins', 'Fiber-dense greens', 'Hydrating fluids', 'Healthy fats']
  }
];

export function DietPlanScreen() {
  const { userProfile, updateUserProfile, foodItems, setActiveScreen } = useStore();
  const [justSelected, setJustSelected] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [simulatedDays, setSimulatedDays] = useState<number | null>(null);
  const [recalibrationSuccess, setRecalibrationSuccess] = useState<string | null>(null);

  // Generate simulated test datasets when testing 13-day vs 14-day scenarios
  const effectiveFoodItems = React.useMemo(() => {
    if (simulatedDays === null) return foodItems;
    const items: FoodItem[] = [];
    const base = new Date();
    for (let i = 0; i < simulatedDays; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      items.push({
        id: `sim-${i}`,
        userId: 'sim-user',
        name: `Day ${i + 1} Balanced Log`,
        isJunk: false,
        calories: 1980,
        protein: 155,
        carbs: 195,
        fat: 60,
        grade: 'A',
        mealType: 'Lunch',
        date: dateStr,
        createdAt: d.getTime()
      });
    }
    return items;
  }, [foodItems, simulatedDays]);

  const recalibration = calculateAdaptiveRecalibration(userProfile, effectiveFoodItems, 14);

  const handleApplyRecalibration = () => {
    if (!recalibration.suggestedTargets) return;
    const prevCal = userProfile.targetCalories || 2000;
    const newCal = recalibration.suggestedTargets.calories;

    const historyEntry = {
      date: new Date().toISOString().split('T')[0],
      previousCalories: prevCal,
      newCalories: newCal,
      reason: recalibration.rationale || 'Adaptive rolling-window trend recalibration'
    };

    updateUserProfile({
      targetCalories: newCal,
      targetProtein: recalibration.suggestedTargets.protein,
      targetCarbs: recalibration.suggestedTargets.carbs,
      targetFat: recalibration.suggestedTargets.fat,
      recalibrationHistory: [historyEntry, ...(userProfile.recalibrationHistory || [])]
    });

    setRecalibrationSuccess(`Targets recalibrated from ${prevCal} to ${newCal} kcal based on 14-day metabolic data.`);
    setIsDismissed(true);
    setTimeout(() => setRecalibrationSuccess(null), 5000);
  };

  const handleSelectPlan = (plan: PlanDefinition) => {
    // Recalculate macros with new dietary style deterministically
    const recalculated = calculateMifflinStJeor(
      userProfile.weightKg || 75,
      userProfile.heightCm || 175,
      userProfile.age || 28,
      userProfile.gender || 'male',
      userProfile.activityLevel || 'moderately_active',
      userProfile.goal || 'Weight Loss',
      plan.style
    );

    updateUserProfile({
      dietaryStyle: plan.style,
      targetCalories: recalculated.targetCalories,
      targetProtein: recalculated.targetProtein,
      targetCarbs: recalculated.targetCarbs,
      targetFat: recalculated.targetFat
    });

    setJustSelected(plan.style);
    setTimeout(() => {
      setJustSelected(null);
    }, 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-400" />
            Diet Plan & Macro Blueprint Selector
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Choose your target dietary framework. Selecting a plan automatically updates your active macro targets.
          </p>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400">Current Plan</div>
          <div className="text-sm font-black text-emerald-400 font-mono">
            {userProfile.dietaryStyle || 'Standard Balanced'}
          </div>
        </div>
      </div>

      {justSelected && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            Switched dietary framework to <strong className="text-white font-bold">{justSelected}</strong>. Targets updated in local store!
          </div>
        </div>
      )}

      {recalibrationSuccess && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-xs text-emerald-200 animate-fadeIn shadow-lg">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <strong className="text-white">Adaptive Recalibration Applied:</strong> {recalibrationSuccess}
          </div>
        </div>
      )}

      {/* 1. ADAPTIVE TARGET RECALIBRATION SECTION */}
      <AnimatePresence>
        {recalibration.canRecalibrate && !isDismissed ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-br from-[#0e1726] via-slate-900 to-purple-950/30 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden"
          >
            {/* Top Tag & Dismiss */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <span>Adaptive Target Recalibration Available</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-200 font-bold px-2 py-0.5 rounded-full border border-purple-500/30 uppercase">
                      14-Day Trend
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Deterministic adjustment based on your last {recalibration.daysLogged} days of actual intake data.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Dismiss Notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
              {/* Calories */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Daily Calories</div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs line-through text-slate-500 font-mono">{userProfile.targetCalories}</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {recalibration.suggestedTargets?.calories} kcal
                  </span>
                </div>
                <div className="text-[10px] font-bold font-mono text-purple-300">
                  {recalibration.deltaCalories && recalibration.deltaCalories > 0 ? `+${recalibration.deltaCalories}` : recalibration.deltaCalories} kcal shift
                </div>
              </div>

              {/* Protein */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-blue-400">Protein</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs line-through text-slate-500 font-mono">{userProfile.targetProtein}g</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {recalibration.suggestedTargets?.protein}g
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Target protein ratio</div>
              </div>

              {/* Carbs */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-amber-400">Carbohydrates</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs line-through text-slate-500 font-mono">{userProfile.targetCarbs}g</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {recalibration.suggestedTargets?.carbs}g
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Energy substrate</div>
              </div>

              {/* Fat */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-rose-400">Dietary Fat</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs line-through text-slate-500 font-mono">{userProfile.targetFat}g</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {recalibration.suggestedTargets?.fat}g
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Lipid budget</div>
              </div>
            </div>

            {/* Transparent Rationale Box */}
            <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-purple-200">
              <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Why this changed:</strong> {recalibration.rationale}
              </div>
            </div>

            {/* Explicit Actions */}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleApplyRecalibration}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-xs px-5 py-3 rounded-xl shadow-lg shadow-purple-500/25 transition cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Apply Adaptive Targets</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs px-4 py-3 rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Dismiss for Now
              </button>
            </div>
          </motion.div>
        ) : (
          /* FAILURE MODE: Insufficient Data (<14 days) Progress Indicator */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Adaptive Target Recalibration</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono font-bold">
                      {recalibration.daysLogged} / 14 Days
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Requires 14 days minimum of diary data to prevent premature or unstable target changes.
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono font-bold text-emerald-400 text-right">
                {recalibration.progressPercent}% of required baseline
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${recalibration.progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Scenario Simulator Controls (Required by SCENARIO SIMULATION spec) */}
      <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-semibold text-slate-300">Scenario Simulation:</span>
          <span>Test the 13 vs 14 day threshold</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSimulatedDays(null);
              setIsDismissed(false);
            }}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              simulatedDays === null
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Live Data ({foodItems.length} items)
          </button>
          <button
            type="button"
            onClick={() => {
              setSimulatedDays(13);
              setIsDismissed(false);
            }}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              simulatedDays === 13
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300'
            }`}
          >
            Test 13 Days (Does Not Fire)
          </button>
          <button
            type="button"
            onClick={() => {
              setSimulatedDays(14);
              setIsDismissed(false);
            }}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              simulatedDays === 14
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-purple-300'
            }`}
          >
            Test 14 Days (Fires Recalibration)
          </button>
        </div>
      </div>

      {/* Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DIET_PLANS.map((plan) => {
          const isActive = userProfile.dietaryStyle === plan.style;

          return (
            <div
              key={plan.style}
              className={`bg-slate-900/90 rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-5 relative ${
                isActive
                  ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                  : 'border-slate-800 hover:border-slate-700/80 shadow-lg'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">{plan.style}</h2>
                    <p className="text-xs text-emerald-400/90 font-medium mt-0.5">{plan.tagline}</p>
                  </div>
                  {isActive && (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>

                {/* Macro Split Badge */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Target Ratio</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900/80 py-1.5 rounded-lg">
                      <div className="text-[10px] text-blue-400 font-bold">Protein</div>
                      <div className="text-xs font-black text-white font-mono">{plan.macroRatios.protein}</div>
                    </div>
                    <div className="bg-slate-900/80 py-1.5 rounded-lg">
                      <div className="text-[10px] text-amber-400 font-bold">Carbs</div>
                      <div className="text-xs font-black text-white font-mono">{plan.macroRatios.carbs}</div>
                    </div>
                    <div className="bg-slate-900/80 py-1.5 rounded-lg">
                      <div className="text-[10px] text-rose-400 font-bold">Fat</div>
                      <div className="text-xs font-black text-white font-mono">{plan.macroRatios.fat}</div>
                    </div>
                  </div>
                </div>

                {/* Staples */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Recommended Staples</div>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.staples.map((staple) => (
                      <span
                        key={staple}
                        className="text-[11px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800"
                      >
                        {staple}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectPlan(plan)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-slate-300 border border-slate-700 cursor-default'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-500/10 active:scale-[0.99]'
                }`}
              >
                {isActive ? (
                  <span>Selected & Configured</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Select {plan.style}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
