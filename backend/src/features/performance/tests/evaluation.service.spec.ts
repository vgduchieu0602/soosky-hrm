/// <reference types="jest" />
import { computeEvaluationRatio, type ScoreInput } from '@features/performance/services/evaluation.service';

const weights = new Map<string, number>([
  ["aaaaaaaaaaaaaaaaaaaaaaa1", 25],
  ["aaaaaaaaaaaaaaaaaaaaaaa2", 25],
  ["aaaaaaaaaaaaaaaaaaaaaaa3", 25],
  ["aaaaaaaaaaaaaaaaaaaaaaa4", 25],
]);

const scores = (vals: number[]): ScoreInput[] =>
  vals.map((score, i) => ({ criterionId: `aaaaaaaaaaaaaaaaaaaaaaa${i + 1}`, score }));

describe('computeEvaluationRatio', () => {
  it('averages equal-weight criteria', () => {
    expect(computeEvaluationRatio(scores([80, 100, 60, 100]), weights)).toBe(85);
  });

  it('honours unequal weights', () => {
    const w = new Map([
      ["aaaaaaaaaaaaaaaaaaaaaaa1", 70],
      ["aaaaaaaaaaaaaaaaaaaaaaa2", 30],
    ]);
    // 100*0.7 + 0*0.3 = 70
    expect(computeEvaluationRatio(scores([100, 0]), w)).toBe(70);
  });

  it('ignores criteria not in the weight map (weight 0)', () => {
    const w = new Map([["aaaaaaaaaaaaaaaaaaaaaaa1", 100]]);
    expect(computeEvaluationRatio(scores([90, 10]), w)).toBe(90);
  });

  it('returns 0 when no weighted criteria', () => {
    expect(computeEvaluationRatio(scores([90]), new Map())).toBe(0);
  });
});
