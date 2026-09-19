import React, { useState } from 'react';
import { useStore, ScreenType } from '../context/StoreContext';
import { useAuth } from '../AuthContext';
import {
  Scale,
  PlusCircle,
  Utensils,
  Compass,
  Droplets,
  Barcode,
  Mic,
  ChefHat,
  ShoppingCart,
  LogOut,
  Target,
  Sparkles,
  ShieldCheck,
  Flame,
  Shield
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
import { VoiceMealLoggerModal } from './VoiceMealLoggerModal';
import { LogFoodModal } from './LogFoodModal';
import { ApiKeyModal } from './ApiKeyModal';
import { calculateStreak } from '../lib/streakEngine';
import { hasGeminiApiKey } from '../lib/geminiClient';

export function BaselineDashboard() {
  const { user, logOut } = useAuth();
  const { activeScreen, setActiveScreen, foodItems, dailyStats, userProfile } = useStore();

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const streakAnalysis = calculateStreak(foodItems);

  const navItems = [
    { id: 'daily-log' as ScreenType, label: 'Daily Log', icon: Utensils, badge: `${foodItems.length}` },
    { id: 'main-log' as ScreenType, label: 'Quick Log', icon: PlusCircle },
    { id: 'recipes' as ScreenType, label: 'Recipes', icon: ChefHat },
    { id: 'grocery' as ScreenType, label: 'Grocery', icon: ShoppingCart },
    { id: 'diet-plan' as ScreenType, label: 'Diet Plan', icon: Compass },
    { id: 'hydration' as ScreenType, label: 'Hydration', icon: Droplets, badge: `${dailyStats.waterGlasses} gl` },
    { id: 'history' as ScreenType, label: 'Streaks', icon: Flame, badge: `${streakAnalysis.currentStreak}d` },
    { id: 'profile' as ScreenType, label: 'Profile', icon: Scale },
  ];

  const quickTools = [
    {
      name: 'Barcode Scanner',
      icon: Barcode,
      action: () => setIsBarcodeModalOpen(true),
      title: 'Scan Barcode (Open Food Facts API)',
      badge: 'OFF'
    },
    {
      name: 'Voice Meal Logger',
      icon: Mic,
      action: () => setIsVoiceModalOpen(true),
      title: 'Voice Meal Logger (Web Speech API)',
      badge: 'AI'
    },
    {
      name: 'Recipe Builder',
      icon: ChefHat,
      action: () => setActiveScreen('recipes'),
      title: 'Recipe Builder & Batch Macros',
      badge: 'PRO'
    },
    {
      name: 'Smart Grocery Sync',
      icon: ShoppingCart,
      action: () => setActiveScreen('grocery'),
      title: 'Smart Grocery Sync & Pantry Checklist',
      badge: 'SYNC'
    },
  ];

  return (
    <div className="min-h-screen text-slate-800 flex flex-col relative z-10 selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveScreen('daily-log')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition">
              <Target className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>VibeDiet 3D</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                  AI Pro
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-medium hidden sm:block">
                3D Plate Vision &bull; Nutrition Intelligence
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-2xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveScreen(item.id)}
                  className={`btn-tactile px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* Right Action: Quick Tools & User Auth */}
          <div className="flex items-center gap-3">
            {/* Real Quick Action Tools */}
            <div className="hidden lg:flex items-center gap-1 border-r border-slate-200 pr-3">
              {quickTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <motion.button
                    key={tool.name}
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={tool.action}
                    className="btn-tactile p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer relative group"
                    title={tool.title}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="sr-only">{tool.name}</span>
                    <span className="absolute -top-0.5 -right-0.5 text-[8px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 rounded-full">
                      {tool.badge}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-2.5">
              {/* Streak Quick-Pill */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveScreen('history')}
                className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 transition cursor-pointer shadow-2xs"
                title="View Streak & Calendar History"
              >
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-black font-mono">{streakAnalysis.currentStreak}d</span>
                {streakAnalysis.isGraceActive && (
                  <span title="1-Day Grace Active">
                    <Shield className="w-3 h-3 text-amber-600" />
                  </span>
                )}
              </motion.button>

              {/* Gemini AI Key Quick Config */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsApiKeyModalOpen(true)}
                className={`btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-2xs ${
                  hasGeminiApiKey()
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                }`}
                title={hasGeminiApiKey() ? 'Gemini AI Key Connected (Click to change)' : 'Connect Free Gemini AI Key'}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-mono">
                  {hasGeminiApiKey() ? 'AI Active' : 'Set AI Key'}
                </span>
                <span className={`w-2 h-2 rounded-full ${hasGeminiApiKey() ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              </motion.button>

              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.displayName || 'Active Athlete'}
                </span>
                <span className="text-[10px] text-emerald-600 font-mono font-medium">
                  {userProfile.targetCalories} kcal target
                </span>
              </div>

              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover bg-slate-100"
                />
              )}

              <button
                type="button"
                onClick={logOut}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-Header Mobile / Tablet Nav Strip */}
      <div className="lg:hidden border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 overflow-x-auto scrollbar-none flex items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveScreen(item.id)}
              className={`btn-tactile px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-mono px-1 rounded bg-slate-200 text-slate-700">
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
        {/* Quick Tools on mobile */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsBarcodeModalOpen(true)}
          className="btn-tactile px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 bg-slate-100 text-emerald-700 border border-slate-200 flex items-center gap-1 cursor-pointer"
        >
          <Barcode className="w-3 h-3" />
          <span>Barcode</span>
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsVoiceModalOpen(true)}
          className="btn-tactile px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 bg-slate-100 text-emerald-700 border border-slate-200 flex items-center gap-1 cursor-pointer"
        >
          <Mic className="w-3 h-3" />
          <span>Voice</span>
        </motion.button>
      </div>

      {/* Main Content Area with Subtle Motion Screen Transitions */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 mb-16 lg:mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {activeScreen === 'profile' && <ProfileScreen />}
            {activeScreen === 'main-log' && <MainLogScreen />}
            {activeScreen === 'daily-log' && <DailyLogScreen />}
            {activeScreen === 'recipes' && (
              <RecipeBuilder onFoodLogged={() => setActiveScreen('daily-log')} />
            )}
            {activeScreen === 'grocery' && <SmartGroceryList />}
            {activeScreen === 'diet-plan' && <DietPlanScreen />}
            {activeScreen === 'hydration' && <HydrationScreen />}
            {activeScreen === 'history' && <StreakCalendarView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Functional Interactive Modals */}
      <VoiceMealLoggerModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      <LogFoodModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        initialTab="barcode"
        dailyJunkCount={0}
        onFoodLogged={() => {
          setIsBarcodeModalOpen(false);
          setActiveScreen('daily-log');
        }}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
