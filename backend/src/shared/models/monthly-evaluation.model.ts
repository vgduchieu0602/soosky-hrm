import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'monthlyEvaluation';
const COLLECTION_NAME = 'monthlyEvaluations';

export const EVALUATION_STATUS = ['draft', 'submitted', 'approved'] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUS)[number];

export interface ICriterionScore {
  criterionId: Types.ObjectId;
  /** Score for this criterion, 0–100. */
  score: number;
}

export interface IMonthlyEvaluation {
  employeeId: Types.ObjectId;
  payrollPeriodId: Types.ObjectId;
  criteriaScores: ICriterionScore[];
  /** Weighted average of criteriaScores, 0–100. Computed at submit time. */
  performanceRatio: number;
  /** % of monthly goal achieved, entered by the evaluator, 0–100. */
  goalResult: number;
  /** Snapshot of the goal ratio used for payroll, 0–100 (defaults to goalResult). */
  goalRatio: number;
  /** Admin/HR user who performed the monthly evaluation. */
  evaluatedBy?: Types.ObjectId | null;
  status: EvaluationStatus;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  note?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type MonthlyEvaluationDoc = HydratedDocument<IMonthlyEvaluation>;

const criterionScoreSchema = new Schema<ICriterionScore>(
  {
    criterionId: { type: Schema.Types.ObjectId, ref: 'performanceCriteria', required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const monthlyEvaluationSchema = new Schema<IMonthlyEvaluation>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    payrollPeriodId: {
      type: Schema.Types.ObjectId,
      ref: 'payrollPeriods',
      required: true,
      index: true,
    },
    criteriaScores: { type: [criterionScoreSchema], default: [] },
    performanceRatio: { type: Number, default: 0, min: 0, max: 100 },
    goalResult: { type: Number, default: 0, min: 0, max: 100 },
    goalRatio: { type: Number, default: 0, min: 0, max: 100 },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    status: { type: String, enum: EVALUATION_STATUS, default: 'draft', index: true },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    note: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

monthlyEvaluationSchema.index({ employeeId: 1, payrollPeriodId: 1 }, { unique: true });

export const MonthlyEvaluation = mongoose.model<IMonthlyEvaluation>(
  DB_NAME,
  monthlyEvaluationSchema,
);
