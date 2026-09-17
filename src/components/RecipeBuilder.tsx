import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

import { Recipe, FoodItem } from '../types';
import { Utensils, Plus, Trash2, Sparkles, Activity, Check, ChevronRight, BookOpen, Clock, Flame, AlertCircle } from 'lucide-react';

interface RecipeBuilderProps {
  onFoodLogged?: () => void;
}

export const RecipeBuilder: React.FC<RecipeBuilderProps> = ({ onFoodLogged }) => {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`customRecipes_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [recipeName, setRecipeName] = useState('');
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState<Array<{ name: string; amount: string }>>([
    { name: 'Chicken Breast', amount: '300g' },
    { name: 'Olive Oil', amount: '1 tbsp (14g)' },
    { name: 'Brown Rice', amount: '1 cup cooked (195g)' },
    { name: 'Broccoli Florets', amount: '150g' }
  ]);

  // Analyzed Preview State
  const [analyzedRecipe, setAnalyzedRecipe] = useState<Recipe | null>(null);

  // Real-time listener for saved recipes
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'recipes');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Recipe)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRecipes(items);
      try {
        localStorage.setItem(`customRecipes_${user.uid}`, JSON.stringify(items));
      } catch {}
    }, (err) => {
      console.warn('Recipe listener notice:', err);
    });

    return unsubscribe;
  }, [user]);

  const addIngredientField = () => {
    setIngredients([...ingredients, { name: '', amount: '1 portion' }]);
  };

  const removeIngredientField = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, field: 'name' | 'amount', value: string) => {
    const next = [...ingredients];
    next[index][field] = value;
    setIngredients(next);
  };

  const handleAnalyzeRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim() || ingredients.some(i => !i.name.trim())) {
      setError('Please provide a recipe title and valid ingredients.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeName,
          servings: Number(servings),
          ingredients
        })
      });

      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error || 'Failed to analyze recipe');

      const data = resData.data;
      const recipeObj: Recipe = {
        id: `recipe-${Date.now()}`,
        userId: user?.uid || '',
        name: data.name || recipeName,
        servings: Number(servings),
        ingredients,
        caloriesPerServing: Number(data.caloriesPerServing) || 0,
        proteinPerServing: Number(data.proteinPerServing) || 0,
        carbsPerServing: Number(data.carbsPerServing) || 0,
        fatPerServing: Number(data.fatPerServing) || 0,
        sugarPerServing: Number(data.sugarPerServing) || 0,
        sodiumPerServing: Number(data.sodiumPerServing) || 0,
        healthScore: Number(data.healthScore) || 90,
        isJunk: Boolean(data.isJunk),
        grade: data.grade || 'A',
        instructions: data.prepTips || 'Mix ingredients, season to taste, and cook until golden.',
        createdAt: Date.now()
      };

      setAnalyzedRecipe(recipeObj);
    } catch (err: any) {
      console.warn('Recipe analyze notice:', err);
      setError(err.message || 'Failed to analyze recipe');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!user || !analyzedRecipe) return;
    setError(null);
    try {
      const updated = [analyzedRecipe, ...recipes.filter(r => r.id !== analyzedRecipe.id)];
      setRecipes(updated);
      try {
        localStorage.setItem(`customRecipes_${user.uid}`, JSON.stringify(updated));
      } catch {}

      try {
        await setDoc(doc(db, 'users', user.uid, 'recipes', analyzedRecipe.id), analyzedRecipe);
      } catch (e) {
        console.warn('Firestore recipe sync notice (saved locally):', e);
      }

      setSuccessMessage(`"${analyzedRecipe.name}" saved to your cookbook!`);
      setAnalyzedRecipe(null);
      setIsCreating(false);
      setRecipeName('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.warn('Recipe save notice:', err);
      setError('Failed to save recipe');
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!user) return;
    setRecipes(prev => prev.filter(r => r.id !== id));
    try {
      const remaining = recipes.filter(r => r.id !== id);
      localStorage.setItem(`customRecipes_${user.uid}`, JSON.stringify(remaining));
      await deleteDoc(doc(db, 'users', user.uid, 'recipes', id));
    } catch (err) {
      console.warn('Error deleting recipe:', err);
    }
  };

  const handleLogRecipeServing = async (recipe: Recipe) => {
    if (!user) return;
    setError(null);
    try {
      const logId = `food-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      let mealType = 'Lunch';
      if (hour < 11) mealType = 'Breakfast';
      else if (hour < 16) mealType = 'Lunch';
      else if (hour < 21) mealType = 'Dinner';
      else mealType = 'Late Night';

      const foodItem: FoodItem = {
        id: logId,
        userId: user.uid,
        name: `${recipe.name} (1 serving)`,
        isJunk: recipe.isJunk,
        calories: recipe.caloriesPerServing,
        protein: recipe.proteinPerServing,
        carbs: recipe.carbsPerServing,
        fat: recipe.fatPerServing,
        sugar: recipe.sugarPerServing || 0,
        sodium: recipe.sodiumPerServing || 0,
        date: today,
        mealType,
        grade: recipe.grade || 'A',
        healthScore: recipe.healthScore || 90,
        portion: `1 of ${recipe.servings} servings`,
        verdict: `Home-cooked meal: ${recipe.name}`,
        createdAt: Date.now()
      };

      try {
        const cachedRaw = localStorage.getItem(`foodLogs_${user.uid}_${today}`);
        const existing = cachedRaw ? JSON.parse(cachedRaw) : [];
        localStorage.setItem(`foodLogs_${user.uid}_${today}`, JSON.stringify([foodItem, ...existing]));
      } catch {}

      try {
        await setDoc(doc(db, 'users', user.uid, 'foodLogs', logId), foodItem);
      } catch (e) {
        console.warn('Firestore log sync notice (saved locally):', e);
      }

      setSuccessMessage(`Logged 1 serving of "${recipe.name}"!`);
      if (onFoodLogged) onFoodLogged();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.warn('Recipe log error:', err);
      setError('Failed to log recipe serving');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Smart Recipe Builder</h3>
            <p className="text-xs text-slate-400">Compose custom multi-ingredient dishes with auto-calculated macros</p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsCreating(!isCreating);
            setAnalyzedRecipe(null);
          }}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreating ? 'View Cookbook' : 'New Recipe'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode 1: Recipe Creation Form */}
      {isCreating && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Compose Custom Dish</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-semibold">Gemini AI Macro Calibration</span>
          </div>

          <form onSubmit={handleAnalyzeRecipe} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Recipe Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., High-Protein Chicken Teriyaki Bowl"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Servings</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={servings}
                  onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Ingredients & Portions</label>
                <span className="text-[10px] text-slate-500">e.g. 200g, 1 cup, 2 tbsp</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Ingredient (e.g. Olive Oil)"
                      value={ing.name}
                      onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="Amount"
                      value={ing.amount}
                      onChange={(e) => handleIngredientChange(idx, 'amount', e.target.value)}
                      className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    {ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredientField(idx)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addIngredientField}
                className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              {isAnalyzing ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Computing Macro Yield & Nutrition Score...</span>
                </>
              ) : (
                <>
                  <span>Calculate Nutritional Analysis</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Analysis Preview */}
          {analyzedRecipe && (
            <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{analyzedRecipe.name}</h4>
                  <p className="text-xs text-slate-400">1 of {analyzedRecipe.servings} Servings</p>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                  ['A','B'].includes(analyzedRecipe.grade || 'A') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  Grade {analyzedRecipe.grade} • Score {analyzedRecipe.healthScore}/100
                </div>
              </div>

              {/* Macro Tiles */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-center">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase">Per Serv</span>
                  <span className="text-sm font-black text-white">{analyzedRecipe.caloriesPerServing}</span>
                  <span className="text-[9px] text-slate-500 block">kcal</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-center">
                  <span className="text-[9px] text-blue-400 font-bold block uppercase">Protein</span>
                  <span className="text-sm font-black text-blue-400">{analyzedRecipe.proteinPerServing}g</span>
                  <span className="text-[9px] text-slate-500 block">macro</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-center">
                  <span className="text-[9px] text-yellow-400 font-bold block uppercase">Carbs</span>
                  <span className="text-sm font-black text-yellow-400">{analyzedRecipe.carbsPerServing}g</span>
                  <span className="text-[9px] text-slate-500 block">macro</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-center">
                  <span className="text-[9px] text-red-400 font-bold block uppercase">Fat</span>
                  <span className="text-sm font-black text-red-400">{analyzedRecipe.fatPerServing}g</span>
                  <span className="text-[9px] text-slate-500 block">macro</span>
                </div>
              </div>

              {analyzedRecipe.prepTips && (
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs text-slate-300">
                  <p><strong className="text-emerald-400">Chef & Nutritionist Tip:</strong> {analyzedRecipe.prepTips}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveRecipe}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Check className="w-4 h-4" />
                <span>Save Recipe to Cookbook</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Saved Recipes Gallery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Custom Cookbook ({recipes.length})</h4>
          <span className="text-[10px] text-slate-500">Tap "Log 1 Serving" to track instantly</span>
        </div>

        {recipes.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 border-dashed p-8 rounded-2xl text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-400">No saved recipes yet</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Create and save your favorite homemade meal preps, protein smoothies, or family dinners.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {recipes.map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md flex flex-col gap-3 hover:border-slate-700 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{r.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        r.isJunk ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {r.isJunk ? 'High Calorie' : 'Clean Prep'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Yields {r.servings} servings • {r.ingredients?.length || 0} ingredients</p>
                  </div>

                  <button
                    onClick={() => handleDeleteRecipe(r.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Per serving breakdown */}
                <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-white">{r.caloriesPerServing} kcal</span>
                    <span className="text-blue-400 font-semibold">P: {r.proteinPerServing}g</span>
                    <span className="text-yellow-400 font-semibold">C: {r.carbsPerServing}g</span>
                    <span className="text-red-400 font-semibold">F: {r.fatPerServing}g</span>
                  </div>

                  <button
                    onClick={() => handleLogRecipeServing(r)}
                    className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition border border-emerald-500/20"
                  >
                    Log 1 Serving
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
