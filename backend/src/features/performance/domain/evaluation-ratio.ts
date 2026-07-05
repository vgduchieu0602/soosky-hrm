/**
 * Pure evaluation-ratio rules (no Express, no Mongoose).
 *
 * `performanceRatio` = weighted avg of `type=performance` criteria scores;
 * `goalRatio`        = weighted avg of `type=goal` criteria scores.
 */
import { computePerformanceRatio } from '@shared/utils/salary.util';

export interface ScoreInput {
  criterionId: string;
  score: number;
}

/** Pure: weighted average of criteria scores (0–100) by criterion weight. */
export function computeEvaluationRatio(
  scores: ScoreInput[],
  weightByCriterionId: Map<string, number>,
): number {
  const weighted = scores.map((s) => ({
    weight: weightByCriterionId.get(String(s.criterionId)) ?? 0,
    score: s.score,
  }));
  return computePerformanceRatio(weighted);
}

/** Simple average (0–100) of scores whose criterion belongs to `ids`. */
export function simpleAverage(scores: ScoreInput[], ids: Set<string>): number {
  const sel = scores.filter((s) => ids.has(String(s.criterionId)));
  if (sel.length === 0) return 0;
  return Math.round(sel.reduce((a, s) => a + s.score, 0) / sel.length);
}

/** Ids in `ids` that are missing from the scored set. */
export function unscoredIn(ids: Set<string>, scored: Set<string>): string[] {
  return [...ids].filter((id) => !scored.has(id));
}
