// @ts-ignore
import { describe, test, expect } from 'bun:test';
import { calculateStreak, buildMonthCalendar } from '../src/lib/streakEngine';
import { FoodItem } from '../src/types';

describe('Streak & Calendar Grace-Period Engine', () => {
  const createMockItem = (date: string): FoodItem => ({
    id: `item-${date}`,
    userId: 'test-user',
    name: 'Standard Clean Meal',
    isJunk: false,
    calories: 500,
    protein: 35,
    carbs: 45,
    fat: 15,
    grade: 'A',
    mealType: 'Lunch',
    date,
    createdAt: new Date(date).getTime()
  });

  const refDate = '2026-09-17'; // Thursday

  test('Consecutive days logging increases streak', () => {
    // Logged Sep 15, 16, 17
    const items = [
      createMockItem('2026-09-15'),
      createMockItem('2026-09-16'),
      createMockItem('2026-09-17')
    ];

    const result = calculateStreak(items, refDate);
    expect(result.currentStreak).toBe(3);
    expect(result.isGraceActive).toBe(false);
    expect(result.totalLoggedDays).toBe(3);
  });

  test('SCENARIO: Exactly 1 missed day is protected by Grace Period (streak preserved)', () => {
    // Logged Sep 15 (2 days ago), missed Sep 16 (yesterday), today Sep 17 not yet logged
    const items = [
      createMockItem('2026-09-15')
    ];

    const result = calculateStreak(items, refDate);
    // Sep 16 was missed, but exactly 1 missed day -> grace active, streak preserved!
    expect(result.currentStreak).toBe(1);
    expect(result.isGraceActive).toBe(true);
    expect(result.dayStatusMap['2026-09-16']).toBe('grace');
  });

  test('SCENARIO: Exactly 1 missed day in historical sequence preserves multi-day streak', () => {
    // Logged Sep 13, 14, 15 (3 days), missed Sep 16 (1 day grace), logged Sep 17 (today)
    const items = [
      createMockItem('2026-09-13'),
      createMockItem('2026-09-14'),
      createMockItem('2026-09-15'),
      createMockItem('2026-09-17')
    ];

    const result = calculateStreak(items, refDate);
    // 13, 14, 15 (3 days) + 16 (grace) + 17 (today) = 4 days streak!
    expect(result.currentStreak).toBe(4);
    expect(result.dayStatusMap['2026-09-16']).toBe('grace');
  });

  test('SCENARIO: 2 consecutive missed days MUST reset streak to 0', () => {
    // Logged Sep 14 (3 days ago). Missed Sep 15 and Sep 16 (2 consecutive days). Today Sep 17 not logged.
    const items = [
      createMockItem('2026-09-14')
    ];

    const result = calculateStreak(items, refDate);
    expect(result.currentStreak).toBe(0);
    expect(result.isGraceActive).toBe(false);
  });

  test('2 consecutive missed days prior to today: today logged starts new streak of 1', () => {
    // Missed Sep 15, 16. Logged Sep 17 (today).
    const items = [
      createMockItem('2026-09-14'),
      createMockItem('2026-09-17')
    ];

    const result = calculateStreak(items, refDate);
    expect(result.currentStreak).toBe(1);
  });

  test('buildMonthCalendar returns correct grid cells with status', () => {
    const items = [
      createMockItem('2026-09-15'),
      createMockItem('2026-09-17')
    ];

    const days = buildMonthCalendar(2026, 8, items, refDate); // month 8 is September
    expect(days.length).toBeGreaterThanOrEqual(30);

    const day17 = days.find((d) => d.date === '2026-09-17');
    expect(day17).toBeDefined();
    expect(day17?.status).toBe('logged');
    expect(day17?.isToday).toBe(true);

    const day16 = days.find((d) => d.date === '2026-09-16');
    expect(day16?.status).toBe('grace');
  });
});
