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
import { calculateStreak } from '../lib/streakEngine';

export function BaselineDashboard() {
  const { user, logOut } = useAuth();
  const { activeScreen, setActiveScreen, foodItems, dailyStats, userProfile } = useStore();

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

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
    <div className="min-h-screen text-slate-100 flex flex-col relative z-10 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveScreen('daily-log')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
              <Target className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>VibeDiet 3D</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                  AI Pro
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium hidden sm:block">
                3D Plate Vision &bull; Nutrition Intelligence
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 p-1 rounded-2xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action: Quick Tools & User Auth */}
          <div className="flex items-center gap-3">
            {/* Real Quick Action Tools */}
            <div className="hidden lg:flex items-center gap-1 border-r border-slate-800 pr-3">
              {quickTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={tool.action}
                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-xl transition cursor-pointer relative group"
                    title={tool.title}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="sr-only">{tool.name}</span>
                    <span className="absolute -top-0.5 -right-0.5 text-[8px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 rounded-full">
                      {tool.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-2.5">
              {/* Streak Quick-Pill */}
              <button
                type="button"
                onClick={() => setActiveScreen('history')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition cursor-pointer"
                title="View Streak & Calendar History"
              >
                <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-black font-mono">{streakAnalysis.currentStreak}d</span>
                {streakAnalysis.isGraceActive && (
                  <span title="1-Day Grace Active">
                    <Shield className="w-3 h-3 text-amber-400" />
                  </span>
                )}
              </button>

              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight">
                  {user?.displayName || 'Active Athlete'}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-medium">
                  {userProfile.targetCalories} kcal target
                </span>
              </div>

              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-slate-800"
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
        </div>
      </header>

      {/* Sub-Header Mobile / Tablet Nav Strip */}
      <div className="lg:hidden border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-4 py-2 overflow-x-auto scrollbar-none flex items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveScreen(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-mono px-1 rounded bg-slate-950/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        {/* Quick Tools on mobile */}
        <button
          type="button"
          onClick={() => setIsBarcodeModalOpen(true)}
          className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 bg-slate-900/40 text-emerald-400/90 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
        >
          <Barcode className="w-3 h-3" />
          <span>Barcode</span>
        </button>
        <button
          type="button"
          onClick={() => setIsVoiceModalOpen(true)}
          className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 bg-slate-900/40 text-emerald-400/90 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
        >
          <Mic className="w-3 h-3" />
          <span>Voice</span>
        </button>
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
    </div>
  );
}
