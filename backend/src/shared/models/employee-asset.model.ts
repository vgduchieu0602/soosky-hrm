import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeAsset';
const COLLECTION_NAME = 'employeeAssets';

export const ASSET_CONDITION = ['new', 'good', 'fair', 'damaged'] as const;
export type AssetCondition = (typeof ASSET_CONDITION)[number];

export interface IEmployeeAsset {
  employeeId: Types.ObjectId;
  assetName: string;
  assetCode: string;
  assignedDate: Date;
  returnedDate?: Date | null;
  condition: AssetCondition;
  note?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeAssetDoc = HydratedDocument<IEmployeeAsset>;

const employeeAssetSchema = new Schema<IEmployeeAsset>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    assetName: { type: String, required: true, trim: true },
    assetCode: { type: String, required: true, trim: true },
    assignedDate: { type: Date, required: true },
    returnedDate: { type: Date, default: null },
    condition: { type: String, enum: ASSET_CONDITION, default: 'good' },
    note: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

employeeAssetSchema.index({ assetCode: 1 }, { unique: true });

export const EmployeeAsset = mongoose.model<IEmployeeAsset>(DB_NAME, employeeAssetSchema);
