// Public surface of the performance feature (Clean Architecture).
export { default as performanceRouter } from '@features/performance/interfaces/http/performance.routes';

// Evaluation use-cases re-exported under the legacy service name for
// cross-feature/test callers (payroll consumes finalized evaluations).
export { evaluationUseCases as evaluationService } from '@features/performance/container';

// Pure ratio helper (used by unit tests / callers that only need the math).
export { computeEvaluationRatio, type ScoreInput } from '@features/performance/domain/evaluation-ratio';
