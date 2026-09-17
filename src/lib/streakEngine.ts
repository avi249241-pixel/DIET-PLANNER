import { FoodItem } from '../types';

export type DayStatus = 'logged' | 'grace' | 'missed' | 'today_pending';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  status: DayStatus;
  mealCount: number;
  totalCalories: number;
}

export interface StreakAnalysis {
  currentStreak: number;
  longestStreak: number;
  isGraceActive: boolean; // True if current streak is actively being preserved by a 1-day grace
  graceDaysUsed: number;
  totalLoggedDays: number;
  lastLoggedDate: string | null;
  dayStatusMap: Record<string, DayStatus>;
}

// Convert YYYY-MM-DD to UTC date epoch days
export function dateStrToEpochDays(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / (1000 * 60 * 60 * 24));
}

// Convert UTC epoch days back to YYYY-MM-DD
export function epochDaysToDateStr(epochDays: number): string {
  const d = new Date(epochDays * 1000 * 60 * 60 * 24);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates current streak and longest historical streak with a forgiving 1-day grace rule.
 * 
 * EXACT GRACE RULE SPECIFICATION:
 * - A single missed day is protected by the grace period and does NOT break the active streak.
 * - Two or more consecutive missed days will break the streak.
 * - When today is not yet logged, the streak remains pending/active based on yesterday (or 1-day grace).
 */
export function calculateStreak(
  foodItems: FoodItem[],
  referenceDateStr?: string
): StreakAnalysis {
  const todayStr = referenceDateStr || getTodayStr();
  const todayEpoch = dateStrToEpochDays(todayStr);

  // Group meals by date
  const dateMealMap = new Map<string, { count: number; calories: number }>();
  for (const item of foodItems) {
    if (!item.date) continue;
    const existing = dateMealMap.get(item.date) || { count: 0, calories: 0 };
    existing.count += 1;
    existing.calories += (item.calories || 0);
    dateMealMap.set(item.date, existing);
  }

  const loggedDates = Array.from(dateMealMap.keys()).sort();
  const totalLoggedDays = loggedDates.length;
  const lastLoggedDate = loggedDates.length > 0 ? loggedDates[loggedDates.length - 1] : null;

  const dayStatusMap: Record<string, DayStatus> = {};

  if (totalLoggedDays === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      isGraceActive: false,
      graceDaysUsed: 0,
      totalLoggedDays: 0,
      lastLoggedDate: null,
      dayStatusMap: { [todayStr]: 'today_pending' }
    };
  }

  const isDateLogged = (epoch: number): boolean => {
    const str = epochDaysToDateStr(epoch);
    return dateMealMap.has(str);
  };

  // Evaluate backwards from reference date (today)
  let currentStreak = 0;
  let isGraceActive = false;
  let graceDaysUsed = 0;

  const todayLogged = isDateLogged(todayEpoch);
  const yesterdayEpoch = todayEpoch - 1;
  const yesterdayLogged = isDateLogged(yesterdayEpoch);
  const twoDaysAgoEpoch = todayEpoch - 2;
  const twoDaysAgoLogged = isDateLogged(twoDaysAgoEpoch);

  let scanEpoch: number;
  let graceAvailable = true;

  if (todayLogged) {
    currentStreak = 1;
    dayStatusMap[todayStr] = 'logged';
    scanEpoch = yesterdayEpoch;
    graceAvailable = true;
  } else {
    // Today not yet logged
    dayStatusMap[todayStr] = 'today_pending';
    if (yesterdayLogged) {
      // Streak alive through yesterday
      currentStreak = 1;
      dayStatusMap[epochDaysToDateStr(yesterdayEpoch)] = 'logged';
      scanEpoch = twoDaysAgoEpoch;
      graceAvailable = true;
    } else if (twoDaysAgoLogged) {
      // Yesterday missed, but 2 days ago logged -> 1-day grace protects yesterday!
      currentStreak = 1;
      isGraceActive = true;
      graceDaysUsed += 1;
      dayStatusMap[epochDaysToDateStr(yesterdayEpoch)] = 'grace';
      dayStatusMap[epochDaysToDateStr(twoDaysAgoEpoch)] = 'logged';
      scanEpoch = twoDaysAgoEpoch - 1;
      graceAvailable = false; // Grace was just used for yesterday
    } else {
      // 2 or more consecutive misses (yesterday + 2 days ago) -> streak is 0
      currentStreak = 0;
      scanEpoch = -1; // No active streak
    }
  }

  // Walk backwards from scanEpoch to extend current streak
  if (scanEpoch > 0) {
    let cursor = scanEpoch;
    // Walk back up to 365 days
    while (cursor >= todayEpoch - 365) {
      const dateStr = epochDaysToDateStr(cursor);
      if (isDateLogged(cursor)) {
        currentStreak += 1;
        dayStatusMap[dateStr] = 'logged';
        // Logging a day re-arms the 1-day grace allowance for earlier gaps
        graceAvailable = true;
      } else {
        // Missed day
        if (graceAvailable) {
          // Protected by 1-day grace!
          graceAvailable = false;
          graceDaysUsed += 1;
          dayStatusMap[dateStr] = 'grace';
        } else {
          // Second consecutive missed day -> streak ends!
          dayStatusMap[dateStr] = 'missed';
          break;
        }
      }
      cursor -= 1;
    }
  }

  // Calculate Longest Historical Streak across all logged dates
  let longestStreak = currentStreak;
  const allEpochs = loggedDates.map(dateStrToEpochDays).sort((a, b) => a - b);

  if (allEpochs.length > 0) {
    let windowStreak = 1;
    let windowGraceAvailable = true;

    for (let i = 1; i < allEpochs.length; i++) {
      const diff = allEpochs[i] - allEpochs[i - 1];
      if (diff === 1) {
        // Consecutive day
        windowStreak += 1;
        windowGraceAvailable = true;
      } else if (diff === 2) {
        // Exactly 1 missed day in between -> protected by grace
        if (windowGraceAvailable) {
          windowStreak += 1;
          windowGraceAvailable = false;
        } else {
          windowStreak = 1;
          windowGraceAvailable = true;
        }
      } else {
        // 2+ consecutive missed days -> streak reset
        windowStreak = 1;
        windowGraceAvailable = true;
      }

      if (windowStreak > longestStreak) {
        longestStreak = windowStreak;
      }
    }
  }

  // Fill status map for past 30 days
  for (let i = 0; i <= 30; i++) {
    const epoch = todayEpoch - i;
    const dateStr = epochDaysToDateStr(epoch);
    if (!dayStatusMap[dateStr]) {
      if (isDateLogged(epoch)) {
        dayStatusMap[dateStr] = 'logged';
      } else if (i === 0) {
        dayStatusMap[dateStr] = 'today_pending';
      } else {
        dayStatusMap[dateStr] = 'missed';
      }
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    isGraceActive,
    graceDaysUsed,
    totalLoggedDays,
    lastLoggedDate,
    dayStatusMap
  };
}

/**
 * Builds month calendar days for rendering the calendar view grid.
 */
export function buildMonthCalendar(
  year: number,
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  foodItems: FoodItem[],
  referenceDateStr?: string
): CalendarDay[] {
  const todayStr = referenceDateStr || getTodayStr();
  const analysis = calculateStreak(foodItems, todayStr);

  const mealMap = new Map<string, { count: number; calories: number }>();
  for (const item of foodItems) {
    if (!item.date) continue;
    const existing = mealMap.get(item.date) || { count: 0, calories: 0 };
    existing.count += 1;
    existing.calories += (item.calories || 0);
    mealMap.set(item.date, existing);
  }

  const days: CalendarDay[] = [];
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Determine starting weekday offset (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = firstDayOfMonth.getDay();

  // Preceding month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDay = prevMonthLastDay - i;
    const prevMonthNum = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
    const mealInfo = mealMap.get(dateStr) || { count: 0, calories: 0 };

    days.push({
      date: dateStr,
      dayOfMonth: prevDay,
      month: prevMonthNum,
      year: prevYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      status: analysis.dayStatusMap[dateStr] || (mealInfo.count > 0 ? 'logged' : 'missed'),
      mealCount: mealInfo.count,
      totalCalories: mealInfo.calories
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const mealInfo = mealMap.get(dateStr) || { count: 0, calories: 0 };
    const isToday = dateStr === todayStr;

    let status: DayStatus = 'missed';
    if (mealInfo.count > 0) {
      status = 'logged';
    } else if (isToday) {
      status = analysis.dayStatusMap[dateStr] || 'today_pending';
    } else if (analysis.dayStatusMap[dateStr] === 'grace') {
      status = 'grace';
    }

    days.push({
      date: dateStr,
      dayOfMonth: d,
      month,
      year,
      isCurrentMonth: true,
      isToday,
      status,
      mealCount: mealInfo.count,
      totalCalories: mealInfo.calories
    });
  }

  // Next month leading days to complete 35 or 42 grid cells
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonthNum = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const mealInfo = mealMap.get(dateStr) || { count: 0, calories: 0 };

    days.push({
      date: dateStr,
      dayOfMonth: d,
      month: nextMonthNum,
      year: nextYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      status: analysis.dayStatusMap[dateStr] || (mealInfo.count > 0 ? 'logged' : 'missed'),
      mealCount: mealInfo.count,
      totalCalories: mealInfo.calories
    });
  }

  return days;
}
