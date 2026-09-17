import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { UserProfile, FitnessGoal, DietaryStyle, ActivityLevel } from '../../types';
import { Check, Flame, Heart, Droplets, Target, Shield, Sparkles, Scale, Dumbbell } from 'lucide-react';

export function calculateMifflinStJeor(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | 'other' = 'male',
  activityLevel: ActivityLevel = 'moderately_active',
  goal: FitnessGoal = 'Weight Loss',
  dietaryStyle: DietaryStyle = 'Standard Balanced'
) {
  // 1. Basal Metabolic Rate (BMR)
  const genderOffset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + genderOffset);

  // 2. Total Daily Energy Expenditure (TDEE) multipliers
  const activityMap: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    athlete: 1.9
  };
  const multiplier = activityMap[activityLevel] || 1.55;
  const tdee = Math.round(bmr * multiplier);

  // 3. Goal-based caloric adjustments
  let delta = 0;
  if (goal === 'Weight Loss') delta = -500;
  else if (goal === 'Muscle Gain') delta = 350;
  else if (goal === 'High Protein Athletic') delta = 200;
  else if (goal === 'Keto / Low Carb') delta = -300;
  else if (goal === 'Clean Maintenance') delta = 0;

  const targetCalories = Math.max(1200, tdee + delta);

  // 4. Macro Splits based on goal & dietary style
  let proteinRatio = 2.0; // g per kg
  if (goal === 'Muscle Gain' || goal === 'High Protein Athletic') {
    proteinRatio = 2.2;
  } else if (dietaryStyle === 'Keto / Low Carb') {
    proteinRatio = 2.0;
  } else if (goal === 'Clean Maintenance') {
    proteinRatio = 1.6;
  }

  const targetProtein = Math.round(weightKg * proteinRatio);
  
  let targetFat = 0;
  let targetCarbs = 0;

  if (dietaryStyle === 'Keto / Low Carb') {
    // 70% fat, 25% protein, 5% carbs
    targetFat = Math.round((targetCalories * 0.70) / 9);
    targetCarbs = Math.max(20, Math.round((targetCalories * 0.05) / 4));
  } else {
    // Balanced ~25% fat, remainder carbs
    targetFat = Math.round((targetCalories * 0.25) / 9);
    const caloriesLeft = targetCalories - (targetProtein * 4 + targetFat * 9);
    targetCarbs = Math.max(30, Math.round(caloriesLeft / 4));
  }

  // 5. Water Goal in 250ml glasses (33ml per kg bodyweight)
  const waterGoal = Math.max(6, Math.round((weightKg * 33) / 250));

  return {
    bmr,
    tdee,
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    waterGoal
  };
}

export function ProfileScreen() {
  const { userProfile, updateUserProfile, setActiveScreen } = useStore();

  const [formData, setFormData] = useState<UserProfile>({
    ...userProfile
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Live Deterministic Calculations
  const calculations = useMemo(() => {
    return calculateMifflinStJeor(
      formData.weightKg || 70,
      formData.heightCm || 175,
      formData.age || 25,
      formData.gender || 'male',
      formData.activityLevel || 'moderately_active',
      formData.goal || 'Weight Loss',
      formData.dietaryStyle || 'Standard Balanced'
    );
  }, [
    formData.weightKg,
    formData.heightCm,
    formData.age,
    formData.gender,
    formData.activityLevel,
    formData.goal,
    formData.dietaryStyle
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Partial<UserProfile> = {
      ...formData,
      targetCalories: calculations.targetCalories,
      targetProtein: calculations.targetProtein,
      targetCarbs: calculations.targetCarbs,
      targetFat: calculations.targetFat,
      waterGoal: calculations.waterGoal
    };
    updateUserProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setActiveScreen('daily-log');
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Scale className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Profile & Target Energy Setup</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Deterministic Mifflin-St Jeor formula calculates your BMR, TDEE, and optimal macro splits in real-time.
          </p>
        </div>
        <div className="text-right bg-slate-950/60 border border-slate-800/80 px-4 py-2.5 rounded-2xl">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Engine Status</div>
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Deterministic Local Math (Zero AI)
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Input Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Biometrics Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Biometric Measurements
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="100"
                  max="250"
                  required
                  value={formData.heightCm}
                  onChange={(e) => setFormData({ ...formData, heightCm: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  required
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  required
                  value={formData.desiredWeightKg}
                  onChange={(e) => setFormData({ ...formData, desiredWeightKg: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Age (years)
                </label>
                <input
                  type="number"
                  min="14"
                  max="100"
                  required
                  value={formData.age || 28}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Biological Sex (for BMR offset)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: g })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold capitalize transition ${
                      formData.gender === g
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity & Goal Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-emerald-400" />
              Activity Level & Objective
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Daily Activity Multiplier
              </label>
              <select
                value={formData.activityLevel || 'moderately_active'}
                onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value as ActivityLevel })}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="sedentary">Sedentary (Desk job, little to no exercise) — 1.2x</option>
                <option value="lightly_active">Lightly Active (Light exercise 1-3 days/week) — 1.375x</option>
                <option value="moderately_active">Moderately Active (Moderate workout 3-5 days/week) — 1.55x</option>
                <option value="very_active">Very Active (Hard training 6-7 days/week) — 1.725x</option>
                <option value="athlete">Elite Athlete (Intense physical training 2x/day) — 1.9x</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Primary Fitness Objective
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    'Weight Loss',
                    'Muscle Gain',
                    'Clean Maintenance',
                    'High Protein Athletic',
                    'Keto / Low Carb'
                  ] as FitnessGoal[]
                ).map((goalOption) => (
                  <button
                    key={goalOption}
                    type="button"
                    onClick={() => setFormData({ ...formData, goal: goalOption })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold text-left transition ${
                      formData.goal === goalOption
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {goalOption}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Max Allowed Junk Calorie Ceiling (% of daily target)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="1"
                  value={formData.maxJunkCaloriePercent || 15}
                  onChange={(e) => setFormData({ ...formData, maxJunkCaloriePercent: Number(e.target.value) })}
                  className="flex-1 accent-emerald-500 h-2 bg-slate-950 rounded-lg cursor-pointer"
                />
                <span className="text-sm font-bold text-emerald-400 w-12 text-right">
                  {formData.maxJunkCaloriePercent || 15}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Deterministic Calculations Display */}
        <div className="space-y-6">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-6 sticky top-24">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Live Deterministic Math
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                Mifflin-St Jeor
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">Basal Metabolic Rate (BMR)</div>
                  <div className="text-xs text-slate-500">Resting metabolism</div>
                </div>
                <div className="text-lg font-black text-white font-mono">{calculations.bmr} <span className="text-xs font-normal text-slate-400">kcal</span></div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">Maintenance TDEE</div>
                  <div className="text-xs text-slate-500">Activity factored</div>
                </div>
                <div className="text-lg font-black text-white font-mono">{calculations.tdee} <span className="text-xs font-normal text-slate-400">kcal</span></div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-xs text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-4 h-4 text-emerald-400" />
                    Target Daily Intake
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Adjusted for {formData.goal}</div>
                </div>
                <div className="text-2xl font-black text-emerald-300 font-mono">
                  {calculations.targetCalories}
                  <span className="text-xs font-medium text-emerald-400 ml-1">kcal</span>
                </div>
              </div>
            </div>

            {/* Target Macro Breakdown */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Macro Blueprint</div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-bold text-blue-400">Protein</div>
                  <div className="text-base font-black text-white font-mono mt-0.5">{calculations.targetProtein}g</div>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-bold text-amber-400">Carbs</div>
                  <div className="text-base font-black text-white font-mono mt-0.5">{calculations.targetCarbs}g</div>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-[10px] uppercase font-bold text-rose-400">Fat</div>
                  <div className="text-base font-black text-white font-mono mt-0.5">{calculations.targetFat}g</div>
                </div>
              </div>

              <div className="bg-cyan-950/20 border border-cyan-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  Hydration Target
                </span>
                <span className="font-mono font-bold text-cyan-200">
                  {calculations.waterGoal} Glasses ({calculations.waterGoal * 0.25}L)
                </span>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Profile Applied!</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Save Profile & Targets</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
