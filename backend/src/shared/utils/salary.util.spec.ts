/// <reference types="jest" />
import {
  computeAttendanceRatio,
  computeEffectiveBaseSalary,
  computePerformanceRatio,
  DEFAULT_COMPONENT_WEIGHTS,
} from './salary.util';

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

  it('prorates each branch independently (plan verification case)', () => {
    const result = computeEffectiveBaseSalary({
      baseSalary: 10_000_000,
      attendanceRatio: 0.5,
      performanceRatio: 80,
      goalRatio: 90,
    });
    expect(result.attendanceComponent).toBe(1_000_000);
    expect(result.performanceComponent).toBe(4_800_000);
    expect(result.goalComponent).toBe(1_800_000);
    expect(result.proRatedBaseSalary).toBe(7_600_000);
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
