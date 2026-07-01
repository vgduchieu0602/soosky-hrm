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
  /**
   * When true (default), the performance & goal components are ALSO scaled by
   * `attendanceRatio`, so unpaid absence reduces the whole salary proportionally
   * — an employee absent the entire month earns ~0, not 80% of base. Default
   * (false/undefined): only the 20% attendance component tracks days worked;
   * performance & goal are paid in full per their ratios.
   */
  prorateByAttendance?: boolean;
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
  // Default (business rule): ONLY the 20% attendance component tracks days
  // worked; the performance (60%) and goal (20%) components are paid in full
  // per their ratios regardless of attendance. Opt in with
  // `prorateByAttendance: true` to also scale perf/goal by attendance.
  const qualityAttendanceFactor = input.prorateByAttendance === true ? input.attendanceRatio : 1;

  const attendanceComponent = Math.round(
    (weights.attendance / 100) * input.baseSalary * input.attendanceRatio,
  );
  const performanceComponent = Math.round(
    (weights.performance / 100) * input.baseSalary * (input.performanceRatio / 100) * qualityAttendanceFactor,
  );
  const goalComponent = Math.round(
    (weights.goal / 100) * input.baseSalary * (input.goalRatio / 100) * qualityAttendanceFactor,
  );

  return {
    attendanceComponent,
    performanceComponent,
    goalComponent,
    proRatedBaseSalary: attendanceComponent + performanceComponent + goalComponent,
  };
}

// ---------------------------------------------------------------------------
// Social insurance (BHXH) · health (BHYT) · unemployment (BHTN)
//
// Contribution rates (percent of the relevant base):
//   employee:  social 8 · health 1.5 · unemployment 1                     (= 10.5%)
//   employer:  social 17 · health 3 · unemployment 1 · occupational 0.5   (= 21.5%)
//   (employer "social 17.5" in the law = 17 retirement/survivor + 0.5 TNLĐ-BNN,
//    modelled here as separate `social` and `occupational` fields.)
//
// Two separate bases, each capped:
//   - social + health base   = min(grossSalary, socialHealthCeiling)
//     ceiling = baseSalaryReference (lương cơ sở) × insuranceCeilingMultiplier (20)
//   - unemployment base       = min(grossSalary, unemploymentCeiling)
//     ceiling = regionalMinWage (lương tối thiểu vùng) × insuranceCeilingMultiplier (20)
// ---------------------------------------------------------------------------

export interface InsuranceSideRates {
  /** percent */
  social: number;
  /** percent */
  health: number;
  /** percent */
  unemployment: number;
  /** percent — occupational accident & disease (TNLĐ-BNN), employer only. */
  occupational?: number;
}

export interface InsuranceRates {
  employee: InsuranceSideRates;
  employer: InsuranceSideRates;
}

/** Statutory Vietnamese contribution rates (employee 10.5% · employer 21.5%). */
export const VN_INSURANCE_RATES: InsuranceRates = {
  employee: { social: 8, health: 1.5, unemployment: 1 },
  employer: { social: 17, health: 3, unemployment: 1, occupational: 0.5 },
};

export interface InsuranceInput {
  grossSalary: number;
  /** cap for social + health base, e.g. baseSalaryReference × 20 */
  socialHealthCeiling: number;
  /** cap for unemployment base, e.g. regionalMinWage × 20 */
  unemploymentCeiling: number;
  rates?: InsuranceRates;
}

export interface InsuranceResult {
  insuranceBase: number;
  unemploymentInsuranceBase: number;
  // employee
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  insurance: number;
  // employer
  employerSocialInsurance: number;
  employerHealthInsurance: number;
  employerUnemploymentInsurance: number;
  employerOccupationalInsurance: number;
}

export function computeInsurance(input: InsuranceInput): InsuranceResult {
  const rates = input.rates ?? VN_INSURANCE_RATES;
  const insuranceBase = Math.min(input.grossSalary, input.socialHealthCeiling);
  const unemploymentInsuranceBase = Math.min(input.grossSalary, input.unemploymentCeiling);

  const socialInsurance = Math.round((insuranceBase * rates.employee.social) / 100);
  const healthInsurance = Math.round((insuranceBase * rates.employee.health) / 100);
  const unemploymentInsurance = Math.round(
    (unemploymentInsuranceBase * rates.employee.unemployment) / 100,
  );

  return {
    insuranceBase,
    unemploymentInsuranceBase,
    socialInsurance,
    healthInsurance,
    unemploymentInsurance,
    insurance: socialInsurance + healthInsurance + unemploymentInsurance,
    employerSocialInsurance: Math.round((insuranceBase * rates.employer.social) / 100),
    employerHealthInsurance: Math.round((insuranceBase * rates.employer.health) / 100),
    employerUnemploymentInsurance: Math.round(
      (unemploymentInsuranceBase * rates.employer.unemployment) / 100,
    ),
    employerOccupationalInsurance: Math.round(
      (insuranceBase * (rates.employer.occupational ?? 0)) / 100,
    ),
  };
}

// ---------------------------------------------------------------------------
// Personal income tax (TNCN) — Vietnamese progressive monthly brackets.
//
//   bracket | monthly taxable income (after deductions) | rate
//   --------|--------------------------------------------|-----
//     1     | 0 – 5,000,000                              |  5%
//     2     | 5,000,000 – 10,000,000                     | 10%
//     3     | 10,000,000 – 18,000,000                    | 15%
//     4     | 18,000,000 – 32,000,000                    | 20%
//     5     | 32,000,000 – 52,000,000                    | 25%
//     6     | 52,000,000 – 80,000,000                    | 30%
//     7     | > 80,000,000                               | 35%
// ---------------------------------------------------------------------------

export interface TaxBracket {
  /** upper bound of this bracket (VND); null = no upper bound (top bracket) */
  upTo: number | null;
  /** marginal rate, percent */
  rate: number;
}

export const VN_PIT_BRACKETS: TaxBracket[] = [
  { upTo: 5_000_000, rate: 5 },
  { upTo: 10_000_000, rate: 10 },
  { upTo: 18_000_000, rate: 15 },
  { upTo: 32_000_000, rate: 20 },
  { upTo: 52_000_000, rate: 25 },
  { upTo: 80_000_000, rate: 30 },
  { upTo: null, rate: 35 },
];

/**
 * Progressive (marginal) tax on income already net of personal & dependent
 * deductions. Negative/zero income → 0. Brackets must be sorted ascending.
 */
export function computeProgressiveTax(
  taxableIncomeAfterDeduction: number,
  brackets: TaxBracket[] = VN_PIT_BRACKETS,
): number {
  if (taxableIncomeAfterDeduction <= 0) return 0;

  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Infinity;
    if (taxableIncomeAfterDeduction <= lower) break;
    const amountInBracket = Math.min(taxableIncomeAfterDeduction, upper) - lower;
    tax += (amountInBracket * bracket.rate) / 100;
    lower = upper;
  }
  return Math.round(tax);
}

// ---------------------------------------------------------------------------
// Overtime pay — Vietnamese statutory multipliers on the hourly rate.
//
//   hourlyRate = baseSalary / (standardWorkDays × 8)
//   weekday  ×1.5 · weekend ×2.0 · holiday ×3.0
// ---------------------------------------------------------------------------

export type OvertimeDayType = 'weekday' | 'weekend' | 'holiday';

export const VN_OVERTIME_MULTIPLIER: Record<OvertimeDayType, number> = {
  weekday: 1.5,
  weekend: 2.0,
  holiday: 3.0,
};

export interface OvertimeEntry {
  hours: number;
  dayType: OvertimeDayType;
}

/** Hourly rate from monthly base salary (8h/day × standard work days). */
export function hourlyRate(baseSalary: number, standardWorkDays: number): number {
  if (standardWorkDays <= 0) return 0;
  return baseSalary / (standardWorkDays * 8);
}

/** Total overtime pay across entries, rounded to integer VND. */
export function computeOvertimePay(
  baseSalary: number,
  standardWorkDays: number,
  entries: OvertimeEntry[],
): number {
  const rate = hourlyRate(baseSalary, standardWorkDays);
  const total = entries.reduce(
    (sum, e) => sum + rate * VN_OVERTIME_MULTIPLIER[e.dayType] * e.hours,
    0,
  );
  return Math.round(total);
}

export interface OvertimePayBreakdown {
  /** Full overtime pay added to gross (taxable + nonTaxable). */
  total: number;
  /** Normal-wage equivalent (rate × 1 × hours) — this part IS subject to PIT. */
  taxable: number;
  /** Premium above the normal wage (rate × (multiplier − 1) × hours) — PIT-exempt
   *  under Vietnamese law. */
  nonTaxable: number;
}

/**
 * Overtime pay split into its taxable base and its tax-exempt premium.
 *
 * Vietnamese PIT exempts the EXTRA paid for overtime over the normal hourly
 * wage. With a ×1.5 weekday multiplier, the 1.0× portion is taxable and the
 * 0.5× portion is exempt; ×2.0 weekend → 1.0× taxable + 1.0× exempt; etc.
 */
export function computeOvertimePayBreakdown(
  baseSalary: number,
  standardWorkDays: number,
  entries: OvertimeEntry[],
): OvertimePayBreakdown {
  const rate = hourlyRate(baseSalary, standardWorkDays);
  let taxable = 0;
  let nonTaxable = 0;
  for (const e of entries) {
    const multiplier = VN_OVERTIME_MULTIPLIER[e.dayType];
    taxable += rate * 1 * e.hours;
    nonTaxable += rate * (multiplier - 1) * e.hours;
  }
  taxable = Math.round(taxable);
  nonTaxable = Math.round(nonTaxable);
  return { total: taxable + nonTaxable, taxable, nonTaxable };
}

// ---------------------------------------------------------------------------
// Full payroll assembly: effective base → gross → insurance → tax → net.
// All inputs/outputs are plain integer VND; convert at the Decimal128 boundary.
// ---------------------------------------------------------------------------

export interface ComputePayrollInput {
  baseSalary: number;
  // attendance / performance / goal (20/60/20)
  attendanceRatio: number;
  performanceRatio: number;
  goalRatio: number;
  weights?: SalaryComponentWeights;
  /** Scale performance & goal components by attendance too (default false —
   *  only the attendance component is prorated). */
  prorateByAttendance?: boolean;
  // additive gross components
  totalTaxableAllowances?: number;
  totalNonTaxableAllowances?: number;
  /** Compulsory-insurance base salary (lương đóng BHXH) — the FIXED contract
   *  salary, NOT pro-rated by attendance/performance. Defaults to the pro-rated
   *  base when omitted (back-compat). Pass 0 to exempt a month entirely. */
  insuranceBaseSalary?: number;
  /** Portion of allowances flagged `isInsuranceBase` — added to the insurance
   *  base alongside the salary. Bonuses/OT/other allowances are NOT subject to
   *  compulsory insurance. */
  insuranceBaseAllowances?: number;
  overtimePay?: number;
  /** Portion of overtimePay exempt from PIT — the premium above the normal hourly
   *  wage (see `computeOvertimePayBreakdown`). Excluded from assessable income. */
  overtimeNonTaxablePay?: number;
  totalBonuses?: number;
  /** Portion of totalBonuses that is non-taxable — excluded from assessable income. */
  totalNonTaxableBonuses?: number;
  // insurance ceilings (already multiplied by the multiplier)
  socialHealthCeiling: number;
  unemploymentCeiling: number;
  insuranceRates?: InsuranceRates;
  // tax
  personalDeduction: number;
  dependentDeduction: number;
  dependentsCount?: number;
  taxBrackets?: TaxBracket[];
  /** Tax resident → progressive + deductions; non-resident → flat rate, no deductions. Default true. */
  isResident?: boolean;
  /** Flat PIT rate for non-residents (percent). Default 20. */
  nonResidentTaxRate?: number;
  /** Union fee (đoàn phí công đoàn) — a fixed post-tax deduction. Default 0. */
  unionFee?: number;
  /** Other post-tax deductions (advance repayment, fines, …). `percentage` is
   *  a percent of gross; `fixed` is a VND amount. */
  deductions?: { type: 'fixed' | 'percentage'; amount: number }[];
}

export interface ComputePayrollResult extends EffectiveBaseResult, InsuranceResult {
  baseSalary: number;
  totalTaxableAllowances: number;
  totalNonTaxableAllowances: number;
  totalAllowances: number;
  overtimePay: number;
  overtimeNonTaxablePay: number;
  totalBonuses: number;
  grossSalary: number;
  /** Salary amount actually subject to compulsory insurance (pre-cap). */
  insurableSalary: number;
  // tax
  taxableIncome: number;
  personalDeduction: number;
  dependentDeduction: number;
  dependentsCount: number;
  taxableIncomeAfterDeduction: number;
  tax: number;
  unionFee: number;
  /** Other post-tax deductions total. */
  otherDeductions: number;
  // net
  totalDeductions: number;
  netSalary: number;
}

/**
 * Pure, end-to-end monthly payroll computation. Mirrors the field layout of
 * `IPayroll` so the result can be mapped straight onto a payroll record (after
 * converting money to Decimal128).
 */
export function computePayroll(input: ComputePayrollInput): ComputePayrollResult {
  const effective = computeEffectiveBaseSalary({
    baseSalary: input.baseSalary,
    attendanceRatio: input.attendanceRatio,
    performanceRatio: input.performanceRatio,
    goalRatio: input.goalRatio,
    weights: input.weights,
    prorateByAttendance: input.prorateByAttendance,
  });

  const totalTaxableAllowances = input.totalTaxableAllowances ?? 0;
  const totalNonTaxableAllowances = input.totalNonTaxableAllowances ?? 0;
  const totalAllowances = totalTaxableAllowances + totalNonTaxableAllowances;
  const overtimePay = input.overtimePay ?? 0;
  const overtimeNonTaxablePay = Math.min(input.overtimeNonTaxablePay ?? 0, overtimePay);
  const totalBonuses = input.totalBonuses ?? 0;

  const grossSalary =
    effective.proRatedBaseSalary + totalAllowances + overtimePay + totalBonuses;

  // Compulsory-insurance base = the FIXED contract salary (insuranceBaseSalary,
  // falling back to the pro-rated salary for back-compat) + only the allowances
  // flagged `isInsuranceBase`. Bonuses/OT/ordinary allowances are excluded;
  // computeInsurance then caps it by the ceiling. Pass insuranceBaseSalary=0 to
  // exempt the month (≥14 unpaid days).
  const insurableSalary =
    (input.insuranceBaseSalary ?? effective.proRatedBaseSalary) +
    (input.insuranceBaseAllowances ?? 0);

  const insurance = computeInsurance({
    grossSalary: insurableSalary,
    socialHealthCeiling: input.socialHealthCeiling,
    unemploymentCeiling: input.unemploymentCeiling,
    rates: input.insuranceRates,
  });

  const dependentsCount = input.dependentsCount ?? 0;

  // Tax residents get personal + dependent deductions and the progressive
  // brackets. Non-residents are taxed at a flat rate on assessable income with
  // NO deductions (Vietnamese PIT rule).
  const isResident = input.isResident !== false;

  // Assessable income excludes non-taxable allowances, non-taxable bonuses and
  // the PIT-exempt overtime premium. Compulsory employee insurance is a PIT
  // relief for RESIDENTS only — non-residents are taxed on gross assessable
  // income (they still pay insurance, but it is not deductible).
  const assessableIncome =
    grossSalary -
    totalNonTaxableAllowances -
    (input.totalNonTaxableBonuses ?? 0) -
    overtimeNonTaxablePay;
  const taxableIncome = isResident ? assessableIncome - insurance.insurance : assessableIncome;
  let personalDeduction: number;
  let totalDependentDeduction: number;
  let taxableIncomeAfterDeduction: number;
  let tax: number;
  if (isResident) {
    personalDeduction = input.personalDeduction;
    totalDependentDeduction = input.dependentDeduction * dependentsCount;
    taxableIncomeAfterDeduction = Math.max(
      0,
      taxableIncome - personalDeduction - totalDependentDeduction,
    );
    tax = computeProgressiveTax(taxableIncomeAfterDeduction, input.taxBrackets);
  } else {
    personalDeduction = 0;
    totalDependentDeduction = 0;
    taxableIncomeAfterDeduction = Math.max(0, taxableIncome);
    const rate = input.nonResidentTaxRate ?? 20;
    tax = Math.round((taxableIncomeAfterDeduction * rate) / 100);
  }

  const unionFee = input.unionFee ?? 0;
  const otherDeductions = Math.round(
    (input.deductions ?? []).reduce(
      (sum, d) => sum + (d.type === 'percentage' ? (grossSalary * d.amount) / 100 : d.amount),
      0,
    ),
  );
  const totalDeductions = insurance.insurance + tax + unionFee + otherDeductions;
  // Net can never be negative: if total deductions exceed gross (e.g. an
  // over-large fixed/percentage deduction was entered), floor at 0 rather than
  // emitting a negative payslip.
  const netSalary = Math.max(0, grossSalary - insurance.insurance - tax - unionFee - otherDeductions);

  return {
    ...effective,
    ...insurance,
    insurableSalary,
    unionFee,
    baseSalary: input.baseSalary,
    totalTaxableAllowances,
    totalNonTaxableAllowances,
    totalAllowances,
    overtimePay,
    overtimeNonTaxablePay,
    totalBonuses,
    grossSalary,
    taxableIncome,
    personalDeduction,
    dependentDeduction: totalDependentDeduction,
    dependentsCount,
    taxableIncomeAfterDeduction,
    tax,
    otherDeductions,
    totalDeductions,
    netSalary,
  };
}

// ---------------------------------------------------------------------------
// NET → GROSS gross-up. Given a target take-home (net) salary, find the gross
// monthly salary such that net = gross − employee insurance − PIT. Reuses
// `computePayroll` (full ratios, gross = insurance base, no allowances) so the
// insurance caps / progressive brackets / residency rules stay consistent.
// ---------------------------------------------------------------------------

export interface GrossUpParams {
  socialHealthCeiling: number;
  unemploymentCeiling: number;
  personalDeduction: number;
  dependentDeduction: number;
  dependentsCount?: number;
  isResident?: boolean;
  nonResidentTaxRate?: number;
  taxBrackets?: TaxBracket[];
  insuranceRates?: InsuranceRates;
  /** Fixed company-wide insurance contribution salary (mức đóng BHXH). */
  insuranceBaseSalary?: number;
  /** Fixed union fee deducted post-tax. */
  unionFee?: number;
}

export interface GrossUpResult {
  gross: number;
  net: number;
  insurance: number;
  tax: number;
  employerInsurance: number;
  /** Total monthly cost to the employer = gross + employer insurance. */
  employerCost: number;
}

/** Run the payroll engine treating `gross` as a pure monthly salary. */
function netAtGross(gross: number, params: GrossUpParams): ComputePayrollResult {
  return computePayroll({
    baseSalary: gross,
    attendanceRatio: 1,
    performanceRatio: 100,
    goalRatio: 100,
    // Insurance is contributed on the fixed company salary (mức đóng BHXH),
    // independent of the gross being solved for; falls back to gross if unset.
    insuranceBaseSalary: params.insuranceBaseSalary ?? gross,
    unionFee: params.unionFee,
    socialHealthCeiling: params.socialHealthCeiling,
    unemploymentCeiling: params.unemploymentCeiling,
    personalDeduction: params.personalDeduction,
    dependentDeduction: params.dependentDeduction,
    dependentsCount: params.dependentsCount,
    isResident: params.isResident,
    nonResidentTaxRate: params.nonResidentTaxRate,
    taxBrackets: params.taxBrackets,
    insuranceRates: params.insuranceRates,
  });
}

/**
 * Invert the payroll computation: find the gross salary whose net equals
 * `targetNet`. Net is monotonic increasing in gross, so a binary search
 * converges; the result is rounded to whole VND.
 */
export function grossUpFromNet(targetNet: number, params: GrossUpParams): GrossUpResult {
  if (targetNet <= 0) {
    return { gross: 0, net: 0, insurance: 0, tax: 0, employerInsurance: 0, employerCost: 0 };
  }

  let lo = targetNet; // gross is always ≥ net
  let hi = targetNet * 3 + 1_000_000; // generous upper bound even at the 35% bracket
  for (let i = 0; i < 60 && hi - lo > 1; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (netAtGross(mid, params).netSalary < targetNet) lo = mid;
    else hi = mid;
  }

  const gross = hi;
  const r = netAtGross(gross, params);
  const employerInsurance =
    r.employerSocialInsurance +
    r.employerHealthInsurance +
    r.employerUnemploymentInsurance +
    r.employerOccupationalInsurance;

  return {
    gross,
    net: r.netSalary,
    insurance: r.insurance,
    tax: r.tax,
    employerInsurance,
    employerCost: gross + employerInsurance,
  };
}
