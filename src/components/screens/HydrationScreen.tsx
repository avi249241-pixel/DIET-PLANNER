import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Droplets, Plus, Minus, RotateCcw, Award, CheckCircle, Info, Sparkles } from 'lucide-react';

export function HydrationScreen() {
  const { dailyStats, userProfile, incrementWater, decrementWater, resetWater } = useStore();

  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const currentGlasses = dailyStats.waterGlasses || 0;
  const goalGlasses = userProfile.waterGoal || 10;
  const percent = Math.min(150, Math.round((currentGlasses / goalGlasses) * 100));
  const currentLiters = (currentGlasses * 0.25).toFixed(2);
  const goalLiters = (goalGlasses * 0.25).toFixed(2);

  const handleReset = () => {
    resetWater();
    setResetNotice('Water count reset to 0. (Automated midnight cron/backend reset is Prompt 2 scope).');
    setTimeout(() => {
      setResetNotice(null);
    }, 4000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Droplets className="w-6 h-6 text-cyan-400" />
            Hydration & Fluid Balance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track daily water intake against personal biometric goals with real-time controls.
          </p>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400">Target Volume</div>
          <div className="text-sm font-black text-cyan-300 font-mono">
            {goalGlasses} Glasses ({goalLiters}L)
          </div>
        </div>
      </div>

      {resetNotice && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-2xl flex items-center gap-3 text-xs text-cyan-300 animate-fadeIn">
          <Info className="w-4 h-4 shrink-0 text-cyan-400" />
          <div>{resetNotice}</div>
        </div>
      )}

      {/* Main Hydration Tracker Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Circular / Fluid Visual */}
          <div className="relative w-44 h-44 rounded-full bg-slate-950 border-4 border-slate-800 flex flex-col items-center justify-center overflow-hidden shadow-inner shrink-0">
            {/* Fluid fill simulation */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600 via-teal-500 to-emerald-400 opacity-25 transition-all duration-700"
              style={{ height: `${Math.min(100, percent)}%` }}
            />
            <div className="relative z-10 text-center">
              <Droplets className="w-6 h-6 text-cyan-400 mx-auto animate-bounce mb-1" />
              <div className="text-3xl font-black text-white font-mono">{currentGlasses}</div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                / {goalGlasses} glasses
              </div>
              <div className="text-[11px] text-cyan-300 font-mono mt-0.5">{percent}% Goal</div>
            </div>
          </div>

          {/* Metric Details */}
          <div className="space-y-4 flex-1 text-center sm:text-left">
            <div>
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Current Volume</div>
              <div className="text-2xl font-black text-white font-mono mt-0.5">
                {currentLiters} <span className="text-sm font-normal text-slate-400">Liters logged</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] uppercase font-bold text-slate-400">Hydration Status</div>
              <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                {percent >= 100 ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Optimal Hydration Achieved!</span>
                  </>
                ) : percent >= 60 ? (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300">On Track — Steady Fluid Intake</span>
                  </>
                ) : (
                  <>
                    <Info className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300">Intake Needed to Meet Blueprint</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick +/- Stepper Controls */}
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={decrementWater}
                disabled={currentGlasses <= 0}
                className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold flex items-center justify-center border border-slate-700 transition cursor-pointer active:scale-95"
                title="Subtract 1 glass"
              >
                <Minus className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={incrementWater}
                className="flex-1 sm:max-w-[200px] h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>+1 Glass (250ml)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Add Presets */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Preset Increments</div>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                incrementWater();
              }}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-center transition cursor-pointer"
            >
              <div className="text-xs font-bold text-white">+1 Glass</div>
              <div className="text-[10px] text-slate-400">250 ml</div>
            </button>

            <button
              type="button"
              onClick={() => {
                incrementWater();
                incrementWater();
              }}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-center transition cursor-pointer"
            >
              <div className="text-xs font-bold text-white">+2 Glasses</div>
              <div className="text-[10px] text-slate-400">500 ml</div>
            </button>

            <button
              type="button"
              onClick={() => {
                incrementWater();
                incrementWater();
                incrementWater();
              }}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-center transition cursor-pointer"
            >
              <div className="text-xs font-bold text-white">+1 Bottle</div>
              <div className="text-[10px] text-slate-400">750 ml</div>
            </button>
          </div>
        </div>

        {/* Reset Action */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="text-slate-500 text-[11px]">
            Reset stub simulates beginning a fresh daily tracking cycle.
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-slate-400 hover:text-rose-400 flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-rose-500/10 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Daily Count</span>
          </button>
        </div>
      </div>
    </div>
  );
}
