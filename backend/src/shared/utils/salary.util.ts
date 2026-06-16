/**
 * Salary calculation helpers for the 20/60/20 effective-base-salary formula.
 *
 *   effectiveBase = attendanceComponent + performanceComponent + goalComponent
 *
 *   attendanceComponent  = (wAttendance/100)  * baseSalary * attendanceRatio   // attendanceRatio: 0–1
 *   performanceComponent = (wPerformance/100) * baseSalary * (performanceRatio/100)
 *   goalComponent        = (wGoal/100)        * baseSalary * (goalRatio/100)
 *
 * All money values are plain numbers (VND, rounded to integer). Convert to/from
 * Decimal128 at the model boundary.
 */

export interface SalaryComponentWeights {
  /** percent, e.g. 20 */
  attendance: number;
  /** percent, e.g. 60 */
  performance: number;
  /** percent, e.g. 20 */
  goal: number;
}

export const DEFAULT_COMPONENT_WEIGHTS: SalaryComponentWeights = {
  attendance: 20,
  performance: 60,
  goal: 20,
};

export interface CriterionScoreInput {
  /** weight in percent */
  weight: number;
  /** score 0–100 */
  score: number;
}

/**
 * Weighted average of criterion scores, returned as a ratio in 0–100.
 * With equal weights this is the simple average. Returns 0 when there are no
 * criteria or total weight is 0.
 */
export function computePerformanceRatio(scores: CriterionScoreInput[]): number {
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
  return weighted / totalWeight;
}

export interface EffectiveBaseInput {
  baseSalary: number;
  /** actualWorkDays / standardWorkDays, 0–1 */
  attendanceRatio: number;
  /** 0–100 */
  performanceRatio: number;
  /** 0–100 */
  goalRatio: number;
  weights?: SalaryComponentWeights;
}

export interface EffectiveBaseResult {
  attendanceComponent: number;
  performanceComponent: number;
  goalComponent: number;
  proRatedBaseSalary: number;
}

/** attendanceRatio from raw work days; safe against a 0 standard. */
export function computeAttendanceRatio(actualWorkDays: number, standardWorkDays: number): number {
  if (standardWorkDays <= 0) return 0;
  return actualWorkDays / standardWorkDays;
}

export function computeEffectiveBaseSalary(input: EffectiveBaseInput): EffectiveBaseResult {
  const weights = input.weights ?? DEFAULT_COMPONENT_WEIGHTS;

  const attendanceComponent = Math.round(
    (weights.attendance / 100) * input.baseSalary * input.attendanceRatio,
  );
  const performanceComponent = Math.round(
    (weights.performance / 100) * input.baseSalary * (input.performanceRatio / 100),
  );
  const goalComponent = Math.round(
    (weights.goal / 100) * input.baseSalary * (input.goalRatio / 100),
  );

  return {
    attendanceComponent,
    performanceComponent,
    goalComponent,
    proRatedBaseSalary: attendanceComponent + performanceComponent + goalComponent,
  };
}
