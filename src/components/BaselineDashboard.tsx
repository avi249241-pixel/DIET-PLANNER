import React, { useState } from 'react';
import { useStore, ScreenType } from '../context/StoreContext';
import { useAuth } from '../AuthContext';
import {
  Scale,
  Camera,
  Utensils,
  Droplets,
  LogOut,
  Target,
  Sparkles,
  Flame,
  Shield,
  ChefHat,
  ShoppingCart,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProfileScreen } from './screens/ProfileScreen';
import { MainLogScreen } from './screens/MainLogScreen';
import { DailyLogScreen } from './screens/DailyLogScreen';
import { DietPlanScreen } from './screens/DietPlanScreen';
import { HydrationScreen } from './screens/HydrationScreen';
import { StreakCalendarView } from './StreakCalendarView';
import { RecipeBuilder } from './RecipeBuilder';
import { SmartGroceryList } from './SmartGroceryList';
import { ApiKeyModal } from './ApiKeyModal';
import { calculateStreak } from '../lib/streakEngine';
import { hasGeminiApiKey } from '../lib/geminiClient';

export function BaselineDashboard() {
  const { user, logOut } = useAuth();
  const { activeScreen, setActiveScreen, foodItems, dailyStats, userProfile } = useStore();
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const streakAnalysis = calculateStreak(foodItems);

  const primaryNavItems = [
    { id: 'main-log' as ScreenType, label: 'Log Meal', icon: Camera, highlight: true },
    { id: 'daily-log' as ScreenType, label: 'Daily Ledger', icon: Utensils, badge: foodItems.length > 0 ? `${foodItems.length}` : undefined },
    { id: 'hydration' as ScreenType, label: 'Hydration', icon: Droplets, badge: `${dailyStats.waterGlasses} gl` },
    { id: 'history' as ScreenType, label: 'Streaks', icon: Flame, badge: `${streakAnalysis.currentStreak}d` },
    { id: 'profile' as ScreenType, label: 'Profile', icon: Scale },
  ];

  const secondaryNavItems = [
    { id: 'recipes' as ScreenType, label: 'Recipes', icon: ChefHat },
    { id: 'grocery' as ScreenType, label: 'Grocery', icon: ShoppingCart },
    { id: 'diet-plan' as ScreenType, label: 'Plan', icon: Compass },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative z-10 selection:bg-emerald-500/30 selection:text-emerald-300 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-2xl border-b border-slate-800/80 shadow-xl shadow-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveScreen('main-log')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition">
              <Target className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>VibeDiet 3D</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  AI
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                3D Vision Nutrition Engine
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/90 p-1.5 rounded-2xl shadow-inner">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Extra tools dropdown / pill */}
            <div className="h-4 w-px bg-slate-800 mx-1" />
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action: User Auth, Target, Key */}
          <div className="flex items-center gap-3">
            {/* Streak Quick-Pill */}
            <button
              type="button"
              onClick={() => setActiveScreen('history')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 transition cursor-pointer"
              title="View Streak & Adherence Calendar"
            >
              <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-xs font-black font-mono">{streakAnalysis.currentStreak}d</span>
              {streakAnalysis.isGraceActive && (
                <span title="Grace Period Active">
                  <Shield className="w-3 h-3 text-amber-400" />
                </span>
              )}
            </button>

            {/* Gemini AI Key Quick Config */}
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                hasGeminiApiKey()
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={hasGeminiApiKey() ? 'Gemini AI Studio Connected' : 'Set Gemini AI Key'}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-mono">
                {hasGeminiApiKey() ? 'AI Active' : 'AI Key'}
              </span>
              <span className={`w-2 h-2 rounded-full ${hasGeminiApiKey() ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400'}`} />
            </button>

            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-white leading-tight">
                {user?.displayName || 'Active Athlete'}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-medium">
                {userProfile.targetCalories} kcal goal
              </span>
            </div>

            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt="avatar"
                className="w-9 h-9 rounded-xl border border-slate-700 object-cover bg-slate-900"
              />
            )}

            <button
              type="button"
              onClick={logOut}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed, never overflows or clips) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveScreen(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                isActive
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-emerald-400' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 mb-20 md:mb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {activeScreen === 'main-log' && <MainLogScreen />}
            {activeScreen === 'daily-log' && <DailyLogScreen />}
            {activeScreen === 'history' && <StreakCalendarView />}
            {activeScreen === 'profile' && <ProfileScreen />}
            {activeScreen === 'hydration' && <HydrationScreen />}
            {activeScreen === 'recipes' && (
              <RecipeBuilder onFoodLogged={() => setActiveScreen('daily-log')} />
            )}
            {activeScreen === 'grocery' && <SmartGroceryList />}
            {activeScreen === 'diet-plan' && <DietPlanScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
