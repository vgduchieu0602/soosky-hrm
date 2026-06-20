import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'monthlyEvaluation';
const COLLECTION_NAME = 'monthlyEvaluations';

/**
 * Direct HR/manager evaluation (employees only view results):
 *   draft        → đã chấm, lưu nháp (sửa được, CHƯA nuôi lương)
 *   approved     → đã duyệt (payroll tiêu thụ từ trạng thái này)
 *   acknowledged → nhân viên đã xác nhận kết quả
 */
export const EVALUATION_STATUS = ['draft', 'approved', 'acknowledged'] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUS)[number];

export interface ICriterionScore {
  criterionId: Types.ObjectId;
  /** Score for this criterion, 0–100. */
  score: number;
}

export interface IMonthlyEvaluation {
  employeeId: Types.ObjectId;
  payrollPeriodId: Types.ObjectId;

  /** Điểm quản lý trực tiếp chấm. */
  managerScores: ICriterionScore[];
  managerId?: Types.ObjectId | null;
  managerNote?: string | null;
  managerSubmittedAt?: Date | null;

  /** Điểm cuối HR chốt (mặc định = managerScores). Dùng để tính performanceRatio. */
  criteriaScores: ICriterionScore[];
  /** Weighted average of criteriaScores (final), 0–100. Feeds payroll. */
  performanceRatio: number;
  /** % of monthly goal achieved, 0–100. */
  goalResult: number;
  /** Snapshot of the goal ratio used for payroll, 0–100 (defaults to goalResult). */
  goalRatio: number;

  /** HR/admin user who finalized the evaluation. */
  evaluatedBy?: Types.ObjectId | null;
  status: EvaluationStatus;
  approvedAt?: Date | null;

  // ---- Qualitative review (HR/manager) ----
  strengths?: string | null;
  improvements?: string | null;
  developmentPlan?: string | null;

  // ---- Employee acknowledgement ----
  acknowledgedAt?: Date | null;
  acknowledgedBy?: Types.ObjectId | null;
  disputeNote?: string | null;

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

    managerScores: { type: [criterionScoreSchema], default: [] },
    managerId: { type: Schema.Types.ObjectId, ref: 'employees', default: null },
    managerNote: { type: String, trim: true, default: null },
    managerSubmittedAt: { type: Date, default: null },

    criteriaScores: { type: [criterionScoreSchema], default: [] },
    performanceRatio: { type: Number, default: 0, min: 0, max: 100 },
    goalResult: { type: Number, default: 0, min: 0, max: 100 },
    goalRatio: { type: Number, default: 0, min: 0, max: 100 },

    evaluatedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    status: { type: String, enum: EVALUATION_STATUS, default: 'draft', index: true },
    approvedAt: { type: Date, default: null },

    strengths: { type: String, trim: true, default: null },
    improvements: { type: String, trim: true, default: null },
    developmentPlan: { type: String, trim: true, default: null },

    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    disputeNote: { type: String, trim: true, default: null },

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
