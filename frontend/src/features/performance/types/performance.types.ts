export type EvaluationStatus = "draft" | "approved" | "acknowledged";

export interface CriterionScore {
  criterionId: string;
  score: number;
}

export interface Evaluation {
  _id: string;
  employeeId: string;
  payrollPeriodId: string;
  managerScores: CriterionScore[];
  criteriaScores: CriterionScore[];
  performanceRatio: number;
  goalResult: number;
  goalRatio: number;
  managerId?: string | null;
  status: EvaluationStatus;
  approvedAt?: string | null;
  acknowledgedAt?: string | null;
  disputeNote?: string | null;
  note?: string | null;
  managerNote?: string | null;
  strengths?: string | null;
  improvements?: string | null;
  developmentPlan?: string | null;
}

export interface DirectEvaluateInput {
  employeeId: string;
  payrollPeriodId: string;
  criteriaScores: CriterionScore[];
  strengths?: string;
  improvements?: string;
  developmentPlan?: string;
  finalize?: boolean;
}
