import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'performanceCriterion';
const COLLECTION_NAME = 'performanceCriteria';

export const CRITERION_STATUS = ['active', 'archived'] as const;
export type CriterionStatus = (typeof CRITERION_STATUS)[number];

/** Which composite ratio this sub-indicator feeds: performance (60%) or goal (20%). */
export const CRITERION_TYPE = ['performance', 'goal'] as const;
export type CriterionType = (typeof CRITERION_TYPE)[number];

export interface IPerformanceCriterion {
  key: string;
  label: string;
  description?: string;
  /** performance → 60% component · goal → 20% component. */
  type: CriterionType;
  /** Relative contribution within its own type group; must total 100 to finalize. */
  weight: number;
  order: number;
  status: CriterionStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type PerformanceCriterionDoc = HydratedDocument<IPerformanceCriterion>;

const performanceCriterionSchema = new Schema<IPerformanceCriterion>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: CRITERION_TYPE, default: 'performance', index: true },
    weight: { type: Number, default: 0, min: 0, max: 100 },
    order: { type: Number, default: 0 },
    status: { type: String, enum: CRITERION_STATUS, default: 'active', index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const PerformanceCriterion = mongoose.model<IPerformanceCriterion>(
  DB_NAME,
  performanceCriterionSchema,
);
