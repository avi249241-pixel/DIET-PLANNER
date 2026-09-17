import { UserProfile, FoodItem } from '../types';
import { calculateMifflinStJeor } from '../components/screens/ProfileScreen';

export interface RecalibrationResult {
  canRecalibrate: boolean;
  daysLogged: number;
  minDaysRequired: number;
  progressPercent: number;
  message: string;
  previousTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  suggestedTargets?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  deltaCalories?: number;
  avgDailyCalories?: number;
  weightDeltaKg?: number;
  realizedTdee?: number;
  rationale?: string;
}

/**
 * Calculates adaptive calorie and macronutrient recalibration based on real rolling-window diary data.
 * Requires at least minDaysRequired (default 14) distinct logged days to avoid noisy/unstable target shifts.
 */
export function calculateAdaptiveRecalibration(
  profile: UserProfile,
  foodItems: FoodItem[],
  minDaysRequired = 14,
  customWeightHistory?: Array<{ date: string; weightKg: number }>
): RecalibrationResult {
  const currentTargets = {
    calories: profile.targetCalories || 2000,
    protein: profile.targetProtein || 150,
    carbs: profile.targetCarbs || 200,
    fat: profile.targetFat || 65,
  };

  // Group food intake by distinct date
  const dailyCaloriesMap = new Map<string, number>();
  const dailyProteinMap = new Map<string, number>();

  for (const item of foodItems) {
    if (!item.date) continue;
    const currentCal = dailyCaloriesMap.get(item.date) || 0;
    dailyCaloriesMap.set(item.date, currentCal + (item.calories || 0));

    const currentProt = dailyProteinMap.get(item.date) || 0;
    dailyProteinMap.set(item.date, currentProt + (item.protein || 0));
  }

  const distinctDates = Array.from(dailyCaloriesMap.keys()).sort();
  const daysLogged = distinctDates.length;
  const progressPercent = Math.min(100, Math.round((daysLogged / minDaysRequired) * 100));

  // FAILURE MODE: Insufficient data (<14 days) must not fire
  if (daysLogged < minDaysRequired) {
    return {
      canRecalibrate: false,
      daysLogged,
      minDaysRequired,
      progressPercent,
      message: `Not enough data yet (${daysLogged}/${minDaysRequired} days logged). Adaptive recalibration requires at least ${minDaysRequired} logged days for statistical accuracy.`,
      previousTargets: currentTargets,
    };
  }

  // Calculate actual intake statistics over the rolling window
  let totalIntakeCal = 0;
  let totalIntakeProt = 0;
  for (const date of distinctDates) {
    totalIntakeCal += dailyCaloriesMap.get(date) || 0;
    totalIntakeProt += dailyProteinMap.get(date) || 0;
  }

  const avgDailyCalories = Math.round(totalIntakeCal / daysLogged);
  const avgDailyProtein = Math.round(totalIntakeProt / daysLogged);

  // Baseline Mifflin-St Jeor TDEE
  const currentWeight = profile.weightKg || 75;
  const baseline = calculateMifflinStJeor(
    currentWeight,
    profile.heightCm || 175,
    profile.age || 28,
    profile.gender || 'male',
    profile.activityLevel || 'moderately_active',
    profile.goal || 'Weight Loss',
    profile.dietaryStyle || 'Standard Balanced'
  );

  // Evaluate weight trend if recorded
  const weightHistory = customWeightHistory || profile.weightHistory || [];
  let weightDeltaKg = 0;
  let hasValidWeightTrend = false;
  let realizedTdee = baseline.tdee;

  if (weightHistory.length >= 2) {
    const sortedWeights = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
    const firstWeight = sortedWeights[0];
    const lastWeight = sortedWeights[sortedWeights.length - 1];

    const d1 = new Date(firstWeight.date).getTime();
    const d2 = new Date(lastWeight.date).getTime();
    const daySpan = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

    if (daySpan >= 7) {
      weightDeltaKg = Math.round((lastWeight.weightKg - firstWeight.weightKg) * 10) / 10;
      hasValidWeightTrend = true;
      // 1 kg body tissue ~= 7700 kcal energy surplus/deficit
      const dailySurplusKcal = (weightDeltaKg * 7700) / daySpan;
      realizedTdee = Math.round(avgDailyCalories - dailySurplusKcal);
    }
  }

  if (!hasValidWeightTrend) {
    // If no weight logging span exists, reconcile using intake consistency vs baseline TDEE
    // Realized TDEE is weighted blend between theoretical baseline and actual adherence
    realizedTdee = Math.round(avgDailyCalories * 0.65 + baseline.tdee * 0.35);
  }

  // Adjust for user's goal
  const goal = profile.goal || 'Weight Loss';
  let goalDelta = 0;
  if (goal === 'Weight Loss') goalDelta = -450;
  else if (goal === 'Muscle Gain') goalDelta = 300;
  else if (goal === 'High Protein Athletic') goalDelta = -200;
  else if (goal === 'Keto / Low Carb') goalDelta = -350;
  else if (goal === 'Clean Maintenance') goalDelta = 0;

  // Calorie floor protection: min 1200 kcal, max 4500 kcal
  const suggestedCalories = Math.max(1200, Math.min(4500, realizedTdee + goalDelta));
  const deltaCalories = suggestedCalories - currentTargets.calories;

  // Recalculate macro targets based on goal and dietary style
  const dietaryStyle = profile.dietaryStyle || 'Standard Balanced';
  let proteinPerKg = 2.0;
  if (goal === 'Muscle Gain' || goal === 'High Protein Athletic') proteinPerKg = 2.2;
  else if (goal === 'Clean Maintenance') proteinPerKg = 1.8;

  const suggestedProtein = Math.round(currentWeight * proteinPerKg);
  let suggestedFat = 0;
  let suggestedCarbs = 0;

  if (dietaryStyle === 'Keto / Low Carb') {
    suggestedFat = Math.round((suggestedCalories * 0.70) / 9);
    suggestedCarbs = Math.max(20, Math.round((suggestedCalories * 0.05) / 4));
  } else {
    suggestedFat = Math.round((suggestedCalories * 0.25) / 9);
    const calAfterProtFat = suggestedCalories - (suggestedProtein * 4 + suggestedFat * 9);
    suggestedCarbs = Math.max(30, Math.round(calAfterProtFat / 4));
  }

  // Construct transparent rationale
  let rationale = `Target calibrated from ${currentTargets.calories} to ${suggestedCalories} kcal based on your last ${daysLogged} days of intake (avg ${avgDailyCalories} kcal/day).`;
  if (hasValidWeightTrend) {
    const trendText = weightDeltaKg > 0 ? `gained ${weightDeltaKg} kg` : weightDeltaKg < 0 ? `lost ${Math.abs(weightDeltaKg)} kg` : `maintained weight`;
    rationale += ` Over this period, you ${trendText}, giving a realized expenditure of ~${realizedTdee} kcal/day.`;
  } else {
    rationale += ` Your realized expenditure tracks at ~${realizedTdee} kcal/day based on logged metabolic consistency.`;
  }

  return {
    canRecalibrate: true,
    daysLogged,
    minDaysRequired,
    progressPercent: 100,
    message: 'Adaptive recalibration recommendation ready based on rolling diary data.',
    previousTargets: currentTargets,
    suggestedTargets: {
      calories: suggestedCalories,
      protein: suggestedProtein,
      carbs: suggestedCarbs,
      fat: suggestedFat,
    },
    deltaCalories,
    avgDailyCalories,
    weightDeltaKg: hasValidWeightTrend ? weightDeltaKg : undefined,
    realizedTdee,
    rationale,
  };
}
