import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'auditLog';
const COLLECTION_NAME = 'auditLogs';

export interface IAuditLog {
  userId?: Types.ObjectId;
  resource: string;
  action: string;
  resourceId?: Types.ObjectId;
  changes?: unknown;
  timestamp: Date;
  created_at?: Date;
  updated_at?: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'user', index: true },
    resource: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId },
    changes: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: () => new Date(), index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

auditLogSchema.index({ userId: 1, timestamp: -1 });

export type AuditLogDoc = HydratedDocument<IAuditLog>;
export const AuditLog = mongoose.model<IAuditLog>(DB_NAME, auditLogSchema);
