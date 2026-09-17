import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { calculateStreak, buildMonthCalendar, CalendarDay, DayStatus } from '../lib/streakEngine';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  Shield,
  Trophy,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Utensils,
  Plus
} from 'lucide-react';

export function StreakCalendarView() {
  const { foodItems, setActiveScreen } = useStore();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const streakAnalysis = calculateStreak(foodItems);
  const calendarDays = buildMonthCalendar(currentYear, currentMonth, foodItems);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const getDayStatusStyle = (day: CalendarDay) => {
    if (!day.isCurrentMonth) {
      return 'opacity-30 border-slate-900 bg-slate-950/40 text-slate-600';
    }

    switch (day.status) {
      case 'logged':
        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
      case 'grace':
        return 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
      case 'today_pending':
        return 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 hover:border-cyan-400 ring-2 ring-cyan-500/20';
      case 'missed':
      default:
        return 'bg-slate-950/60 border-slate-800 text-slate-500 hover:border-slate-700';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Flame className="w-7 h-7 text-amber-400 fill-amber-400/20" />
            <span>Streak & Logging Calendar</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Build lifelong adherence with our forgiving grace period. 1 missed day is protected from resetting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('main-log')}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Quick Log Today</span>
        </button>
      </div>

      {/* Streak Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Streak */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Streak</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-4 h-4 fill-amber-400/30" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <motion.span
              key={streakAnalysis.currentStreak}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight"
            >
              {streakAnalysis.currentStreak}
            </motion.span>
            <span className="text-sm font-bold text-amber-400">days</span>
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            {streakAnalysis.isGraceActive ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                Grace Protected (1 miss spared)
              </span>
            ) : streakAnalysis.currentStreak > 0 ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active & healthy
              </span>
            ) : (
              <span>Log today to begin your streak</span>
            )}
          </div>
        </motion.div>

        {/* Longest Streak */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Best Streak</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
              {streakAnalysis.longestStreak}
            </span>
            <span className="text-sm font-bold text-purple-400">days record</span>
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-400">
            Personal consistency benchmark
          </div>
        </motion.div>

        {/* Total Logged Days */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Days Logged</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
              {streakAnalysis.totalLoggedDays}
            </span>
            <span className="text-sm font-bold text-emerald-400">days recorded</span>
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-400">
            {foodItems.length} total meals recorded in diary
          </div>
        </motion.div>
      </div>

      {/* Forgiving Grace Policy Explanation Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>Adaptive Grace-Period Rule</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 uppercase">
                Active
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Missing one single day will <strong>not</strong> reset your streak counter. We automatically protect isolated misses. Only <strong>2 or more consecutive missed days</strong> reset the counter.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono font-bold bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 text-slate-300 shrink-0">
          Grace Allowance: <span className="text-amber-400">1 Missed Day</span>
        </div>
      </div>

      {/* Interactive Calendar View */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-white tracking-tight">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <button
              type="button"
              onClick={() => {
                setCurrentYear(today.getFullYear());
                setCurrentMonth(today.getMonth());
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 transition"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-1">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* 7-column calendar day grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {calendarDays.map((day) => {
            const isSelected = selectedDay?.date === day.date;

            return (
              <motion.button
                key={day.date}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedDay(day)}
                type="button"
                className={`min-h-[58px] sm:min-h-[72px] p-2 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${getDayStatusStyle(
                  day
                )} ${isSelected ? 'ring-2 ring-emerald-400' : ''}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-black font-mono ${day.isToday ? 'text-white' : ''}`}>
                    {day.dayOfMonth}
                  </span>
                  {day.isToday && (
                    <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-300 px-1 rounded uppercase">
                      Today
                    </span>
                  )}
                  {day.status === 'grace' && day.isCurrentMonth && (
                    <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                  {day.status === 'logged' && day.isCurrentMonth && (
                    <Flame className="w-3 h-3 text-emerald-400 fill-emerald-400/30 shrink-0" />
                  )}
                </div>

                <div className="text-[10px] font-mono leading-tight mt-1">
                  {day.mealCount > 0 ? (
                    <div>
                      <span className="font-bold text-emerald-300">{day.mealCount} meals</span>
                      <div className="text-[9px] text-slate-400 hidden sm:block">
                        {day.totalCalories} kcal
                      </div>
                    </div>
                  ) : day.status === 'grace' && day.isCurrentMonth ? (
                    <span className="text-[10px] text-amber-400 font-bold">Grace Saved</span>
                  ) : day.status === 'today_pending' ? (
                    <span className="text-[10px] text-cyan-300 font-bold">Pending</span>
                  ) : (
                    <span className="text-slate-600 text-[10px]">&mdash;</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500" />
            <span className="text-slate-300">Logged Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500" />
            <span className="text-slate-300">Grace Day (Preserved)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500/30 border border-cyan-500" />
            <span className="text-slate-300">Today (Pending)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700" />
            <span className="text-slate-400">Missed Day</span>
          </div>
        </div>
      </div>

      {/* Selected Day Inspect Drawer */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                  <span>Diary Details for {selectedDay.date}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedDay.status === 'logged'
                    ? `${selectedDay.mealCount} meals recorded totaling ${selectedDay.totalCalories} kcal`
                    : selectedDay.status === 'grace'
                    ? '1-day grace period protected this missed day'
                    : selectedDay.status === 'today_pending'
                    ? 'Today has not been logged yet'
                    : 'No food entries recorded on this day'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 transition"
              >
                Close
              </button>
            </div>

            {/* List meals for this day if any */}
            {foodItems.filter((i) => i.date === selectedDay.date).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {foodItems
                  .filter((i) => i.date === selectedDay.date)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.mealType} &bull; {item.calories} kcal &bull; {item.protein}g P
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        {item.grade || 'A'}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-2">
                No individual meals recorded in local cache for {selectedDay.date}.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
