import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'session';
const COLLECTION_NAME = 'sessions';

export interface ISession {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
  revokedAt?: Date;
  created_at?: Date;
  updated_at?: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true }, // sha256 of refresh JWT
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date }, // set on logout/rotation/reuse-detection
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// TTL — MongoDB will remove the document once expiresAt passes.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = HydratedDocument<ISession>;
export const Session = mongoose.model<ISession>(DB_NAME, sessionSchema);
