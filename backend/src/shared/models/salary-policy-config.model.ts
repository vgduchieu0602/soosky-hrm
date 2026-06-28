import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'salaryPolicyConfig';
const COLLECTION_NAME = 'salaryPolicyConfigs';

/** Weights (percent) for the 20/60/20 effective-base-salary formula. Should sum to 100. */
export interface ISalaryComponentWeights {
  attendance: number;
  performance: number;
  goal: number;
}

export interface ISalaryPolicyConfig {
  country: string;
  year: number;
  effectiveFrom: Date;
  baseSalary: mongoose.Types.Decimal128;
  regionalMinWage?: Record<string, unknown>;
  insuranceCeilingMultiplier: number;
  personalDeduction: mongoose.Types.Decimal128;
  dependentDeduction: mongoose.Types.Decimal128;
  nonResidentTaxRate: number;
  taxBrackets?: Record<string, unknown>[];
  insuranceRates?: Record<string, unknown>;
  /** Fixed company-wide salary the compulsory insurance is contributed on
   *  (mức lương đóng BHXH), e.g. 5,500,000 — not the employee's actual salary. */
  socialInsuranceSalary?: mongoose.Types.Decimal128;
  /** Union fee (đoàn phí công đoàn) as a percent of socialInsuranceSalary. */
  unionFeeRate: number;
  unionFeeEnabled: boolean;
  /** Probation pay as a PERCENT of contract salary (default 85). */
  probationPayRate: number;
  /** @deprecated No longer used to compute intern pay. Interns are now paid their
   *  FULL contract salary, attendance-prorated only (no perf/goal split, no
   *  compulsory insurance) — see payroll-run.service. Kept for back-compat /
   *  historical records; safe to drop in a future migration. */
  internStipend: mongoose.Types.Decimal128;
  /** Weights for the 20/60/20 effective base salary formula. */
  salaryComponentWeights: ISalaryComponentWeights;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type SalaryPolicyConfigDoc = HydratedDocument<ISalaryPolicyConfig>;

const salaryComponentWeightsSchema = new Schema<ISalaryComponentWeights>(
  {
    attendance: { type: Number, required: true, default: 20, min: 0, max: 100 },
    performance: { type: Number, required: true, default: 60, min: 0, max: 100 },
    goal: { type: Number, required: true, default: 20, min: 0, max: 100 },
  },
  { _id: false },
);

const salaryPolicyConfigSchema = new Schema<ISalaryPolicyConfig>(
  {
    country: { type: String, required: true, uppercase: true, trim: true },
    year: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true },
    baseSalary: { type: Schema.Types.Decimal128, required: true },
    regionalMinWage: { type: Schema.Types.Mixed },
    insuranceCeilingMultiplier: { type: Number, default: 20 },
    personalDeduction: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('11000000') },
    dependentDeduction: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('4400000') },
    nonResidentTaxRate: { type: Number, default: 20 },
    taxBrackets: { type: [Schema.Types.Mixed], default: [] },
    insuranceRates: { type: Schema.Types.Mixed },
    socialInsuranceSalary: { type: Schema.Types.Decimal128, default: null },
    unionFeeRate: { type: Number, default: 1 },
    unionFeeEnabled: { type: Boolean, default: true },
    probationPayRate: { type: Number, default: 85, min: 0, max: 100 },
    internStipend: { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('1500000') },
    salaryComponentWeights: {
      type: salaryComponentWeightsSchema,
      default: () => ({ attendance: 20, performance: 60, goal: 20 }),
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

salaryPolicyConfigSchema.index({ country: 1, year: 1, effectiveFrom: 1 }, { unique: true });

export const SalaryPolicyConfig = mongoose.model<ISalaryPolicyConfig>(
  DB_NAME,
  salaryPolicyConfigSchema,
);
