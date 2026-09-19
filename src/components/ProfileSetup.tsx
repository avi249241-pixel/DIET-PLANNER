import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Activity, Target, Flame, Sparkles, Check, ChevronRight, Settings, Utensils, X, Bot, RefreshCw, Sliders, ShieldCheck } from 'lucide-react';
import { FitnessGoal, DietaryStyle, ActivityLevel, UserProfile } from '../types';
import { apiFetch } from '../lib/apiFetch';

const GOAL_OPTIONS: Array<{ id: FitnessGoal; label: string; desc: string; icon: string }> = [
  { id: 'Weight Loss', label: 'Weight Loss & Fat Cut', desc: 'Caloric deficit, high satiety, controlled carbs', icon: '🔥' },
  { id: 'Muscle Gain', label: 'Muscle Gain / Hypertrophy', desc: 'High protein surplus, energetic clean carbs', icon: '💪' },
  { id: 'Clean Maintenance', label: 'Clean Maintenance & Vitality', desc: 'Balanced whole-food lifestyle & sustained energy', icon: '🥗' },
  { id: 'High Protein Athletic', label: 'High Protein Athletic', desc: 'Maximized recovery for intense gym & sports', icon: '⚡' },
  { id: 'Keto / Low Carb', label: 'Keto / Low Carb', desc: 'High healthy fats, moderate protein, ultra-low carb', icon: '🥑' },
];

const DIETARY_STYLES: DietaryStyle[] = [
  'Standard Balanced',
  'High Protein Athletic',
  'Keto / Low Carb',
  'Mediterranean',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Intermittent Fasting'
];

const CUISINE_OPTIONS = [
  'Mediterranean',
  'Asian / Japanese',
  'Mexican / Bowls',
  'Indian Whole Foods',
  'Italian Clean',
  'American Whole Foods',
  'Middle Eastern',
  'Thai / Southeast Asian'
];

const ALLERGY_OPTIONS = [
  'Dairy / Lactose',
  'Gluten / Wheat',
  'Peanuts & Tree Nuts',
  'Shellfish / Seafood',
  'Eggs',
  'Soy',
  'Refined White Sugar'
];

interface ProfileSetupProps {
  onClose?: () => void;
  isEditing?: boolean;
}

export const ProfileSetup = ({ onClose, isEditing }: ProfileSetupProps) => {
  const { user, profile, refreshProfile } = useAuth();

  const [activeStep, setActiveStep] = useState<number>(1);
  const [heightCm, setHeightCm] = useState(profile?.heightCm || 175);
  const [weightKg, setWeightKg] = useState(profile?.weightKg || 75);
  const [desiredWeightKg, setDesiredWeightKg] = useState(profile?.desiredWeightKg || 70);
  const [age, setAge] = useState(profile?.age || 28);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(profile?.gender || 'male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel || 'moderately_active');
  const [goal, setGoal] = useState<FitnessGoal>(profile?.goal || 'Weight Loss');
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle>(profile?.dietaryStyle || 'Standard Balanced');
  
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(
    profile?.favoriteCuisines || ['Mediterranean', 'Asian / Japanese']
  );
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(
    profile?.allergiesOrDislikes || []
  );

  const [autoSuggestNextMeal, setAutoSuggestNextMeal] = useState(
    profile?.automationPreferences?.autoSuggestNextMeal ?? true
  );
  const [proactiveNudges, setProactiveNudges] = useState(
    profile?.automationPreferences?.proactiveNudges ?? true
  );
  const [smartGroceryAutoSync, setSmartGroceryAutoSync] = useState(
    profile?.automationPreferences?.smartGroceryAutoSync ?? true
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom macro overrides after AI calculation
  const [planGenerated, setPlanGenerated] = useState(false);
  const [targetCalories, setTargetCalories] = useState(profile?.targetCalories || 2000);
  const [maxJunkPercent, setMaxJunkPercent] = useState(profile?.maxJunkCaloriePercent || 12);
  const [targetProtein, setTargetProtein] = useState(profile?.targetProtein || 130);
  const [targetCarbs, setTargetCarbs] = useState(profile?.targetCarbs || 200);
  const [targetFat, setTargetFat] = useState(profile?.targetFat || 60);
  const [waterGoal, setWaterGoal] = useState(profile?.waterGoal || 8);
  const [planExplanation, setPlanExplanation] = useState('');

  const toggleCuisine = (c: string) => {
    setSelectedCuisines(prev => 
      prev.includes(c) ? prev.filter(item => item !== c) : [...prev, c]
    );
  };

  const toggleAllergy = (a: string) => {
    setSelectedAllergies(prev => 
      prev.includes(a) ? prev.filter(item => item !== a) : [...prev, a]
    );
  };

  const calculatePlan = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const resData = await apiFetch<any>('/api/ai/calculate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heightCm,
          weightKg,
          desiredWeightKg,
          goal,
          age,
          gender,
          activityLevel,
          dietaryStyle,
          favoriteCuisines: selectedCuisines,
          allergiesOrDislikes: selectedAllergies
        })
      });
      
      if (!resData.success) throw new Error(resData.error || "Failed to calculate profile");
      
      const data = resData.data;
      setTargetCalories(data.targetCalories || 2000);
      setMaxJunkPercent(data.maxJunkCaloriePercent || 12);
      setTargetProtein(data.targetProtein || 130);
      setTargetCarbs(data.targetCarbs || 190);
      setTargetFat(data.targetFat || 55);
      setWaterGoal(data.waterGoal || 8);
      setPlanExplanation(data.explanation || 'Personalized calorie and macro plan calibrated for your goal and dietary style.');
      setPlanGenerated(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred calculating plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveFinalProfile = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profileData: UserProfile = {
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        desiredWeightKg: Number(desiredWeightKg),
        targetCalories: Number(targetCalories),
        maxJunkCaloriePercent: Number(maxJunkPercent),
        goal,
        age: Number(age),
        gender,
        activityLevel,
        dietaryStyle,
        favoriteCuisines: selectedCuisines,
        allergiesOrDislikes: selectedAllergies,
        targetProtein: Number(targetProtein),
        targetCarbs: Number(targetCarbs),
        targetFat: Number(targetFat),
        waterGoal: Number(waterGoal),
        autoLoggingEnabled: true,
        automationPreferences: {
          autoSuggestNextMeal,
          proactiveNudges,
          smartGroceryAutoSync
        },
        updatedAt: Date.now()
      };
      
      try {
        localStorage.setItem(`customUserProfile_${user.uid}`, JSON.stringify(profileData));
      } catch {}

      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      await refreshProfile();
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      console.warn("Profile save notice:", err);
      await refreshProfile();
      if (onClose) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${isEditing ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811]/80 backdrop-blur-xl overflow-y-auto' : 'min-h-screen bg-gradient-to-b from-[#0b1120] to-[#040711] flex flex-col items-center justify-center p-4 py-10'}`}>
      <div className="max-w-2xl w-full bg-[#111928] p-6 sm:p-8 rounded-3xl border border-slate-700/60 space-y-6 shadow-2xl my-auto relative text-slate-200">
        {isEditing && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            <Sparkles className="w-6 h-6 font-black" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {isEditing ? 'Personalize Nutrition & Automation' : 'Configure Your AI Nutrition Engine'}
          </h2>
          <p className="text-slate-400 text-xs mt-1">Calibrated to your metabolism, activity level, and meal habits.</p>
        </div>

        {/* Step Indicator Tabs */}
        {!planGenerated && (
          <div className="flex items-center justify-center gap-2 border-b border-slate-800/80 pb-3">
            {[
              { num: 1, label: 'Goal & Style' },
              { num: 2, label: 'Physical Stats' },
              { num: 3, label: 'Preferences' }
            ].map(step => (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(step.num)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeStep === step.num
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                  activeStep === step.num ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {step.num}
                </span>
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-3 rounded-xl text-xs text-center font-medium">
            {error}
          </div>
        )}

        {!planGenerated ? (
          <div className="space-y-6">
            {/* STEP 1: Goal & Dietary Style */}
            {activeStep === 1 && (
              <div className="space-y-5 animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                    1. Select Primary Fitness Goal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {GOAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setGoal(opt.id)}
                        className={`text-left p-3.5 rounded-2xl border transition-all flex items-start justify-between ${
                          goal === opt.id
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl shrink-0 mt-0.5">{opt.icon}</span>
                          <div>
                            <h4 className="text-xs font-bold text-white">{opt.label}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                          </div>
                        </div>
                        {goal === opt.id && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                    2. Dietary Style
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DIETARY_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setDietaryStyle(style)}
                        className={`p-2.5 rounded-xl border text-center transition text-xs font-bold ${
                          dietaryStyle === style
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md"
                  >
                    <span>Next: Physical Stats</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Physical Stats & Activity */}
            {activeStep === 2 && (
              <div className="space-y-5 animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                    Physical Body Metrics
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Height (cm)</label>
                      <input
                        type="number"
                        min="100"
                        max="250"
                        value={heightCm}
                        onChange={(e) => setHeightCm(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-black text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Wt (kg)</label>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        value={weightKg}
                        onChange={(e) => setWeightKg(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-black text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Goal Wt (kg)</label>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        value={desiredWeightKg}
                        onChange={(e) => setDesiredWeightKg(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-black text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age</label>
                      <input
                        type="number"
                        min="14"
                        max="100"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-black text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Gender</label>
                      <select
                        value={gender}
                        onChange={(e: any) => setGender(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Daily Activity Level</label>
                      <select
                        value={activityLevel}
                        onChange={(e: any) => setActivityLevel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="sedentary">Sedentary (Desk Job)</option>
                        <option value="lightly_active">Light (1-2 workouts/wk)</option>
                        <option value="moderately_active">Moderate (3-5 workouts/wk)</option>
                        <option value="very_active">Heavy (Daily intense training)</option>
                        <option value="athlete">Athlete / 2x Daily</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 rounded-xl transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md"
                  >
                    <span>Next: Preferences</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Cuisines, Allergies & AI Automation */}
            {activeStep === 3 && (
              <div className="space-y-5 animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Favorite Cuisines for AI Meal Suggestions
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_OPTIONS.map((c) => {
                      const isSelected = selectedCuisines.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCuisine(c)}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition font-medium ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Allergies & Strictly Avoided Foods
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGY_OPTIONS.map((a) => {
                      const isSelected = selectedAllergies.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleAllergy(a)}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition font-medium ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{a}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AI Automation Switches */}
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Nutrition Automation</h4>
                  </div>

                  <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                    <div>
                      <span className="font-bold text-white block">Auto-Suggest Next Meals</span>
                      <span className="text-[11px] text-slate-400">Recommends breakfast, lunch, dinner tailored to remaining macros</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoSuggestNextMeal}
                      onChange={(e) => setAutoSuggestNextMeal(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer py-1 border-t border-slate-800/80 pt-2">
                    <div>
                      <span className="font-bold text-white block">Smart Grocery Auto-Sync</span>
                      <span className="text-[11px] text-slate-400">Automatically adds ingredients from planned recipes to shopping list</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={smartGroceryAutoSync}
                      onChange={(e) => setSmartGroceryAutoSync(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="pt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 rounded-xl transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={calculatePlan}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>AI Calculating Metabolic Profile...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Calculate Optimal AI Targets</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Generated Plan Review & Macro Customization */
          <div className="space-y-5 animate-in fade-in">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">AI Nutrition Calibration Complete</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {planExplanation}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Daily Calories</span>
                <input
                  type="number"
                  value={targetCalories}
                  onChange={(e) => setTargetCalories(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-black text-white text-base mt-1"
                />
                <span className="text-[10px] text-slate-500">kcal/day</span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] font-bold text-blue-400 uppercase block">Protein</span>
                <input
                  type="number"
                  value={targetProtein}
                  onChange={(e) => setTargetProtein(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-black text-blue-400 text-base mt-1"
                />
                <span className="text-[10px] text-slate-500">grams/day</span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">Carbs</span>
                <input
                  type="number"
                  value={targetCarbs}
                  onChange={(e) => setTargetCarbs(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-black text-emerald-400 text-base mt-1"
                />
                <span className="text-[10px] text-slate-500">grams/day</span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] font-bold text-amber-400 uppercase block">Fats</span>
                <input
                  type="number"
                  value={targetFat}
                  onChange={(e) => setTargetFat(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-black text-amber-400 text-base mt-1"
                />
                <span className="text-[10px] text-slate-500">grams/day</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Max Junk Cap</span>
                  <span className="text-xs text-slate-300 font-medium">Daily allowance</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={maxJunkPercent}
                    onChange={(e) => setMaxJunkPercent(Number(e.target.value))}
                    className="w-14 bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-black text-amber-400 text-sm"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Hydration Goal</span>
                  <span className="text-xs text-slate-300 font-medium">Water intake</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={waterGoal}
                    onChange={(e) => setWaterGoal(Number(e.target.value))}
                    className="w-14 bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-black text-blue-400 text-sm"
                  />
                  <span className="text-xs text-slate-400">glasses</span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPlanGenerated(false)}
                className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                Re-adjust Inputs
              </button>

              <button
                type="button"
                onClick={handleSaveFinalProfile}
                disabled={isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-7 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                <Check className="w-4 h-4 font-black" />
                <span>Save & Launch Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
