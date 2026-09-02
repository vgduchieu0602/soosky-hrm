import {
  computeAttendanceRatio,
  computeEffectiveBaseSalary,
  computeInsurance,
  computeOvertimePay,
  computeOvertimePayBreakdown,
  computePayroll,
  computePerformanceRatio,
  computeProgressiveTax,
  grossUpFromNet,
  hourlyRate,
  DEFAULT_COMPONENT_WEIGHTS,
  VN_INSURANCE_RATES,
} from './salary.util';

const VN_GROSSUP_PARAMS = {
  socialHealthCeiling: 46_800_000,
  unemploymentCeiling: 99_200_000,
  personalDeduction: 11_000_000,
  dependentDeduction: 4_400_000,
  dependentsCount: 0,
  isResident: true,
};

describe('grossUpFromNet', () => {
  it('grosses up net 6,000,000 → 6,703,911 (no PIT at this level)', () => {
    const r = grossUpFromNet(6_000_000, VN_GROSSUP_PARAMS);
    expect(r.gross).toBe(6_703_911);
    expect(r.net).toBe(6_000_000);
    expect(r.insurance).toBe(703_911); // 10.5% of gross
    expect(r.tax).toBe(0); // gross - insurance = 6m < 11m personal deduction
  });

  it('round-trips within rounding tolerance even with PIT', () => {
    const r = grossUpFromNet(25_000_000, { ...VN_GROSSUP_PARAMS, taxEnabled: true });
    expect(Math.abs(r.net - 25_000_000)).toBeLessThanOrEqual(2);
    expect(r.gross).toBeGreaterThan(25_000_000);
    expect(r.tax).toBeGreaterThan(0);
  });

  it('returns zero for non-positive net', () => {
    expect(grossUpFromNet(0, VN_GROSSUP_PARAMS).gross).toBe(0);
  });

  it('fixed BHXH base 5.5M, union fee excluded → net 6,000,000 grosses to 6,577,500', () => {
    const r = grossUpFromNet(6_000_000, { ...VN_GROSSUP_PARAMS, insuranceBaseSalary: 5_500_000 });
    expect(r.insurance).toBe(577_500); // 10.5% × 5.5M, independent of gross
    expect(r.tax).toBe(0);
    expect(r.gross).toBe(6_577_500); // net + BHXH only (union fee not part of gross↔net)
  });
});

describe('computePerformanceRatio', () => {
  it('averages 4 equal-weight criteria', () => {
    const ratio = computePerformanceRatio([
      { weight: 25, score: 80 },
      { weight: 25, score: 100 },
      { weight: 25, score: 60 },
      { weight: 25, score: 100 },
    ]);
    expect(ratio).toBe(85);
  });

  it('honours unequal weights', () => {
    const ratio = computePerformanceRatio([
      { weight: 50, score: 100 },
      { weight: 50, score: 0 },
    ]);
    expect(ratio).toBe(50);
  });

  it('returns 0 when there are no criteria', () => {
    expect(computePerformanceRatio([])).toBe(0);
  });
});

describe('computeAttendanceRatio', () => {
  it('divides actual by standard', () => {
    expect(computeAttendanceRatio(11, 22)).toBe(0.5);
  });

  it('returns 0 when standard is 0', () => {
    expect(computeAttendanceRatio(10, 0)).toBe(0);
  });
});

describe('computeEffectiveBaseSalary', () => {
  it('returns full base when every ratio is maxed (20% + 60% + 20%)', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 1,
      performanceRatio: 100,
      goalRatio: 100,
    });
    expect(result.attendanceComponent).toBe(2_000_000);
    expect(result.performanceComponent).toBe(6_000_000);
    expect(result.goalComponent).toBe(2_000_000);
    expect(result.proRatedBaseSalary).toBe(10_000_000);
  });

  it('by default only the attendance component is prorated (perf & goal paid in full)', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 0.5,
      performanceRatio: 80,
      goalRatio: 90,
    });
    expect(result.attendanceComponent).toBe(1_000_000); // 0.2 × 10m × 0.5
    expect(result.performanceComponent).toBe(4_800_000); // 0.6 × 10m × 0.8 (no attendance scaling)
    expect(result.goalComponent).toBe(1_800_000); // 0.2 × 10m × 0.9 (no attendance scaling)
    expect(result.proRatedBaseSalary).toBe(7_600_000);
  });

  it('opt-in prorateByAttendance=true scales performance & goal by attendance too', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 0.5,
      performanceRatio: 80,
      goalRatio: 90,
      prorateByAttendance: true,
    });
    expect(result.attendanceComponent).toBe(1_000_000); // 0.2 × 10m × 0.5
    expect(result.performanceComponent).toBe(2_400_000); // 0.6 × 10m × 0.8 × 0.5
    expect(result.goalComponent).toBe(900_000); // 0.2 × 10m × 0.9 × 0.5
    expect(result.proRatedBaseSalary).toBe(4_300_000);
  });

  it('zero attendance → only the 20% attendance component drops to 0 (perf/goal still paid)', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 0,
      performanceRatio: 100,
      goalRatio: 100,
    });
    expect(result.attendanceComponent).toBe(0);
    expect(result.proRatedBaseSalary).toBe(8_000_000); // 60% + 20% paid in full
  });

  it('opt-in: zero attendance → zero pay even with full performance/goal', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 0,
      performanceRatio: 100,
      goalRatio: 100,
      prorateByAttendance: true,
    });
    expect(result.proRatedBaseSalary).toBe(0);
  });

  it('uses the default 20/60/20 weights', () => {
    expect(DEFAULT_COMPONENT_WEIGHTS).toEqual({ attendance: 20, performance: 60, goal: 20 });
  });

  it('respects custom weights', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 1,
      performanceRatio: 100,
      goalRatio: 100,
      weights: { attendance: 30, performance: 50, goal: 20 },
    });
    expect(result.proRatedBaseSalary).toBe(10_000_000);
    expect(result.attendanceComponent).toBe(3_000_000);
    expect(result.performanceComponent).toBe(5_000_000);
  });
});

describe('computeInsurance', () => {
  // lương cơ sở 2,340,000 × 20 = 46,800,000 ; vùng I 4,960,000 × 20 = 99,200,000
  const socialHealthCeiling = 46_800_000;
  const unemploymentCeiling = 99_200_000;

  it('applies statutory employee + employer rates below the cap', () => {
    const r = computeInsurance({
      grossSalary: 32_730_000,
      socialHealthCeiling,
      unemploymentCeiling,
    });
    expect(r.insuranceBase).toBe(32_730_000);
    expect(r.socialInsurance).toBe(2_618_400); // 8%
    expect(r.healthInsurance).toBe(490_950); // 1.5%
    expect(r.unemploymentInsurance).toBe(327_300); // 1%
    expect(r.insurance).toBe(3_436_650);
    expect(r.employerSocialInsurance).toBe(5_564_100); // 17%
    expect(r.employerOccupationalInsurance).toBe(163_650); // 0.5% TNLĐ-BNN
    expect(r.employerHealthInsurance).toBe(981_900); // 3%
    expect(r.employerUnemploymentInsurance).toBe(327_300); // 1%
  });

  it('caps the social/health base at the ceiling for high earners', () => {
    const r = computeInsurance({
      grossSalary: 200_000_000,
      socialHealthCeiling,
      unemploymentCeiling,
    });
    expect(r.insuranceBase).toBe(46_800_000); // capped
    expect(r.unemploymentInsuranceBase).toBe(99_200_000); // capped at the higher unemployment ceiling
    expect(r.socialInsurance).toBe(Math.round(46_800_000 * 0.08));
    expect(r.unemploymentInsurance).toBe(Math.round(99_200_000 * 0.01));
  });

  it('exposes the VN statutory rates', () => {
    expect(VN_INSURANCE_RATES.employee).toEqual({ social: 8, health: 1.5, unemployment: 1 });
    expect(VN_INSURANCE_RATES.employer).toEqual({ social: 17, health: 3, unemployment: 1, occupational: 0.5 });
  });
});

describe('computeProgressiveTax', () => {
  it('returns 0 for non-positive income', () => {
    expect(computeProgressiveTax(0)).toBe(0);
    expect(computeProgressiveTax(-1_000)).toBe(0);
  });

  it('matches each bracket boundary', () => {
    expect(computeProgressiveTax(5_000_000)).toBe(250_000); // 5%
    expect(computeProgressiveTax(10_000_000)).toBe(750_000); // +5m@10%
    expect(computeProgressiveTax(18_000_000)).toBe(1_950_000); // +8m@15%
  });

  it('computes the top bracket correctly (100m taxable)', () => {
    // 250k + 500k + 1.2m + 2.8m + 5m + 8.4m + 7m
    expect(computeProgressiveTax(100_000_000)).toBe(25_150_000);
  });
});

describe('computeOvertimePay', () => {
  it('derives hourly rate from base / (standardWorkDays × 8)', () => {
    expect(hourlyRate(22_000_000, 22)).toBe(125_000); // 22M / 176h
  });

  it('applies VN multipliers 1.5 / 2.0 / 3.0', () => {
    const base = 22_000_000; // hourly = 125,000
    expect(computeOvertimePay(base, 22, [{ hours: 2, dayType: 'weekday' }])).toBe(375_000); // 125k×1.5×2
    expect(computeOvertimePay(base, 22, [{ hours: 2, dayType: 'weekend' }])).toBe(500_000); // 125k×2×2
    expect(computeOvertimePay(base, 22, [{ hours: 2, dayType: 'holiday' }])).toBe(750_000); // 125k×3×2
  });

  it('sums multiple entries', () => {
    const base = 22_000_000;
    expect(
      computeOvertimePay(base, 22, [
        { hours: 2, dayType: 'weekday' },
        { hours: 1, dayType: 'holiday' },
      ]),
    ).toBe(375_000 + 375_000);
  });
});

describe('computePayroll — non-resident flat tax', () => {
  it('taxes non-residents at 20% of assessable income, no deductions', () => {
    const r = computePayroll({
      baseSalary: 30_000_000,
      attendanceRatio: 1,
      performanceRatio: 100,
      goalRatio: 100,
      socialHealthCeiling: 46_800_000,
      unemploymentCeiling: 99_200_000,
      personalDeduction: 11_000_000,
      dependentDeduction: 4_400_000,
      dependentsCount: 2,
      isResident: false,
      taxEnabled: true,
    });
    // Non-residents: insurance is NOT a deduction → taxableIncome = gross assessable.
    const expectedTax = Math.round(r.taxableIncome * 0.2);
    expect(r.taxableIncome).toBe(r.grossSalary); // no insurance/non-taxable subtracted
    expect(r.personalDeduction).toBe(0);
    expect(r.dependentDeduction).toBe(0);
    expect(r.taxableIncomeAfterDeduction).toBe(r.taxableIncome);
    expect(r.tax).toBe(expectedTax);
  });
});

describe('computePayroll — E1 parallel-run case', () => {
  // Senior engineer, full attendance & performance, 1 dependent.
  // baseSalary 30m, taxable allowance 2m, non-taxable (lunch) 730k.
  const result = computePayroll({
    baseSalary: 30_000_000,
    attendanceRatio: 1,
    performanceRatio: 100,
    goalRatio: 100,
    totalTaxableAllowances: 2_000_000,
    totalNonTaxableAllowances: 730_000,
    socialHealthCeiling: 46_800_000,
    unemploymentCeiling: 99_200_000,
    personalDeduction: 11_000_000,
    dependentDeduction: 4_400_000,
    dependentsCount: 1,
    taxEnabled: true,
  });

  it('assembles gross from effective base + allowances', () => {
    expect(result.proRatedBaseSalary).toBe(30_000_000);
    expect(result.totalAllowances).toBe(2_730_000);
    expect(result.grossSalary).toBe(32_730_000);
  });

  it('deducts employee insurance (base = pro-rated salary; allowances not flagged isInsuranceBase)', () => {
    // insurance base = 30,000,000 (no insuranceBaseAllowances) × 10.5%
    expect(result.insurance).toBe(3_150_000);
  });

  it('computes taxable income net of insurance and non-taxable allowance', () => {
    // 32,730,000 - 3,150,000 - 730,000
    expect(result.taxableIncome).toBe(28_850_000);
    // - 11,000,000 personal - 4,400,000 (1 dependent)
    expect(result.taxableIncomeAfterDeduction).toBe(13_450_000);
    expect(result.dependentDeduction).toBe(4_400_000);
  });

  it('computes progressive tax and net salary', () => {
    // 250k + 500k + 3,450,000@15% (517,500)
    expect(result.tax).toBe(1_267_500);
    expect(result.totalDeductions).toBe(4_417_500);
    expect(result.netSalary).toBe(28_312_500);
  });

  it('keeps net = gross - insurance - tax', () => {
    expect(result.netSalary).toBe(result.grossSalary - result.insurance - result.tax);
  });

  it('prorates gross down when attendance/performance drop', () => {
    const half = computePayroll({
      baseSalary: 30_000_000,
      attendanceRatio: 0.5,
      performanceRatio: 80,
      goalRatio: 90,
      socialHealthCeiling: 46_800_000,
      unemploymentCeiling: 99_200_000,
      personalDeduction: 11_000_000,
      dependentDeduction: 4_400_000,
      dependentsCount: 0,
    });
    // Only the attendance component is prorated by days worked:
    //   attendance 0.2*30m*0.5=3m ; perf 0.6*30m*0.8=14.4m ; goal 0.2*30m*0.9=5.4m
    expect(half.proRatedBaseSalary).toBe(22_800_000);
    expect(half.grossSalary).toBe(22_800_000);
  });
});

describe('computeOvertimePayBreakdown — VN PIT-exempt premium', () => {
  // hourly = 22M / (22 × 8) = 125,000
  const base = 22_000_000;

  it('weekday ×1.5: 1.0× taxable, 0.5× exempt', () => {
    const r = computeOvertimePayBreakdown(base, 22, [{ hours: 2, dayType: 'weekday' }]);
    expect(r.total).toBe(375_000); // 125k × 1.5 × 2
    expect(r.taxable).toBe(250_000); // 125k × 1 × 2
    expect(r.nonTaxable).toBe(125_000); // 125k × 0.5 × 2
  });

  it('weekend ×2.0 and holiday ×3.0 split correctly', () => {
    const weekend = computeOvertimePayBreakdown(base, 22, [{ hours: 1, dayType: 'weekend' }]);
    expect(weekend).toEqual({ total: 250_000, taxable: 125_000, nonTaxable: 125_000 });
    const holiday = computeOvertimePayBreakdown(base, 22, [{ hours: 1, dayType: 'holiday' }]);
    expect(holiday).toEqual({ total: 375_000, taxable: 125_000, nonTaxable: 250_000 });
  });

  it('total matches the legacy computeOvertimePay', () => {
    const entries = [
      { hours: 2, dayType: 'weekday' as const },
      { hours: 1, dayType: 'holiday' as const },
    ];
    expect(computeOvertimePayBreakdown(base, 22, entries).total).toBe(
      computeOvertimePay(base, 22, entries),
    );
  });
});

describe('computePayroll — overtime tax exemption', () => {
  it('excludes the exempt OT premium from taxable income but keeps it in gross', () => {
    const withOt = computePayroll({
      baseSalary: 20_000_000,
      attendanceRatio: 1,
      performanceRatio: 100,
      goalRatio: 100,
      overtimePay: 1_500_000,
      overtimeNonTaxablePay: 500_000, // exempt premium
      socialHealthCeiling: 46_800_000,
      unemploymentCeiling: 99_200_000,
      personalDeduction: 11_000_000,
      dependentDeduction: 4_400_000,
      dependentsCount: 0,
    });
    // gross includes full OT; taxable income excludes the 500k exempt premium
    expect(withOt.grossSalary).toBe(21_500_000);
    expect(withOt.overtimeNonTaxablePay).toBe(500_000);
    expect(withOt.taxableIncome).toBe(
      withOt.grossSalary - withOt.insurance - 500_000,
    );
  });
});

describe('attendance drives the 20% component', () => {
  it('attendanceComponent = 20% × base × ratio (perfect attendance)', () => {
    const r = computeEffectiveBaseSalary({
      baseSalary: 30_000_000, attendanceRatio: 1, performanceRatio: 0, goalRatio: 0,
    });
    expect(r.attendanceComponent).toBe(6_000_000); // 0.2 × 30m × 1
  });

  it('fewer actual work days lowers the 20% component proportionally', () => {
    // 18/22 working days → ratio ≈ 0.818
    const ratio = computeAttendanceRatio(18, 22);
    const r = computeEffectiveBaseSalary({
      baseSalary: 30_000_000, attendanceRatio: ratio, performanceRatio: 0, goalRatio: 0,
    });
    expect(r.attendanceComponent).toBe(Math.round(0.2 * 30_000_000 * (18 / 22))); // ≈ 4,909,091
  });

  it('caps the ratio at 1 — working beyond standard does not inflate the 20%', () => {
    const ratio = Math.min(1, computeAttendanceRatio(25, 22));
    const r = computeEffectiveBaseSalary({
      baseSalary: 30_000_000, attendanceRatio: ratio, performanceRatio: 0, goalRatio: 0,
    });
    expect(r.attendanceComponent).toBe(6_000_000); // not more than 20%
  });
});

describe('probation pay = (base × 85%) / standard × actual (attendance only)', () => {
  it('ignores performance/goal — 100% attendance weight on the 85% base', () => {
    const base85 = Math.round(30_000_000 * 0.85); // 25,500,000
    const ratio = computeAttendanceRatio(18, 22); // worked 18 of 22 days
    const r = computeEffectiveBaseSalary({
      baseSalary: base85,
      attendanceRatio: ratio,
      performanceRatio: 30, // must NOT affect probation pay
      goalRatio: 10,
      weights: { attendance: 100, performance: 0, goal: 0 },
    });
    expect(r.performanceComponent).toBe(0);
    expect(r.goalComponent).toBe(0);
    expect(r.proRatedBaseSalary).toBe(Math.round(base85 * (18 / 22))); // ≈ 20,863,636
  });
});
