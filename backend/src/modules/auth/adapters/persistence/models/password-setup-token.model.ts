import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';
import {
  SETUP_TOKEN_PURPOSE,
  type SetupTokenPurpose,
} from '@modules/auth/core/domain/setup-token-purpose';

const DB_NAME = 'passwordSetupToken';
const COLLECTION_NAME = 'passwordSetupTokens';


export interface IPasswordSetupToken {
  userId: Types.ObjectId;
  tokenHash: string; // sha256 of the raw token — the raw token only ever lives in the email link
  purpose: SetupTokenPurpose;
  expiresAt: Date;
  usedAt?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

const passwordSetupTokenSchema = new Schema<IPasswordSetupToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    purpose: { type: String, enum: SETUP_TOKEN_PURPOSE, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// TTL — MongoDB removes the document once expiresAt passes (auto-cleanup).
passwordSetupTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordSetupTokenDoc = HydratedDocument<IPasswordSetupToken>;
export const PasswordSetupToken = mongoose.model<IPasswordSetupToken>(
  DB_NAME,
  passwordSetupTokenSchema,
);
