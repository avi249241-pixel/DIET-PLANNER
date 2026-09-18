import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../AuthContext';
import { Mic, MicOff, Sparkles, X, Check, Activity, Volume2, AlertCircle, Utensils } from 'lucide-react';
import { parseMealDescriptionToComponents, calculateDeterministicMealTotals, ComponentFood } from '../lib/nutritionEngine';
import { MealType } from '../types';

interface VoiceMealLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

export function VoiceMealLoggerModal({ isOpen, onClose, onLogged }: VoiceMealLoggerModalProps) {
  const { user } = useAuth();
  const { addFoodItem } = useStore();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<MealType>('Lunch');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedMeal, setAnalyzedMeal] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check Web Speech API availability
  const hasSpeech = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );

  const startListening = () => {
    setError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please type your meal below.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition notice:', e);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setError('Microphone permission was denied. Please allow microphone access or type your meal.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      console.warn('Recognition start exception:', err);
      setIsListening(false);
      setError('Could not start microphone. You can type your meal description directly.');
    }
  };

  const handleAnalyzeTranscript = () => {
    if (!transcript.trim()) {
      setError('Please say or type a meal description first.');
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    try {
      const components = parseMealDescriptionToComponents(transcript);
      if (!components || components.length === 0) {
        setError('Could not identify specific food items. Try something like "2 scrambled eggs with toast and an apple".');
        setIsAnalyzing(false);
        return;
      }

      const mealTotals = calculateDeterministicMealTotals(components, {
        mealName: transcript.length > 35 ? `${transcript.slice(0, 32)}...` : transcript,
        mealType: selectedMealType
      });

      setAnalyzedMeal(mealTotals);
    } catch (err: any) {
      setError(err.message || 'Error parsing meal description.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!analyzedMeal) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await addFoodItem({
        userId: user?.uid || 'guest-user',
        name: analyzedMeal.name,
        isJunk: analyzedMeal.isJunk,
        calories: analyzedMeal.calories,
        protein: analyzedMeal.protein,
        carbs: analyzedMeal.carbs,
        fat: analyzedMeal.fat,
        sugar: analyzedMeal.sugar,
        sodium: analyzedMeal.sodium,
        portion: analyzedMeal.portion,
        healthScore: analyzedMeal.healthScore,
        grade: analyzedMeal.grade,
        mealType: analyzedMeal.mealType,
        date: todayStr,
        nutritionSource: 'LOCAL_AUTHORITATIVE',
        confidence: 0.95,
        foods: analyzedMeal.foods
      });

      if (onLogged) onLogged();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Error saving meal log.');
    }
  };

  const handleClose = () => {
    setTranscript('');
    setAnalyzedMeal(null);
    setIsListening(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition ${
            isListening ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">Voice Meal Logger</h3>
            <p className="text-xs text-slate-400 font-medium">Speak naturally to log calories & whole-food macros</p>
          </div>
        </div>

        {/* Voice Input Section */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {isListening ? 'Listening...' : 'Meal Description'}
            </span>
            <button
              type="button"
              onClick={isListening ? () => setIsListening(false) : startListening}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-bounce shadow-lg shadow-rose-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? 'Stop Mic' : 'Start Mic'}</span>
            </button>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="e.g., '1 cup oatmeal with blueberries, 2 boiled eggs, and a glass of orange juice'"
            rows={3}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition placeholder-slate-500 resize-none"
          />

          {/* Meal Type Picker */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-400">Meal:</span>
            {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as MealType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedMealType(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedMealType === t
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Analyzed Food Preview */}
        {analyzedMeal ? (
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white">{analyzedMeal.name}</h4>
                <p className="text-[11px] text-slate-400">{analyzedMeal.foods.length} items parsed</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-emerald-400">{analyzedMeal.calories} kcal</span>
                <div className="text-[10px] text-slate-400">
                  {analyzedMeal.protein}g P • {analyzedMeal.carbs}g C • {analyzedMeal.fat}g F
                </div>
              </div>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {analyzedMeal.foods.map((food: ComponentFood, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <span className="text-slate-300 font-medium truncate max-w-[200px]">{food.name}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{food.estimatedGrams}g • {food.calories} kcal</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveMeal}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Log to Food Diary</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAnalyzeTranscript}
            disabled={!transcript.trim() || isAnalyzing}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
          >
            {isAnalyzing ? <Activity className="w-4 h-4 animate-spin text-emerald-400" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
            <span>{isAnalyzing ? 'Decomposing Food Items...' : 'Calculate Macros & Calories'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
