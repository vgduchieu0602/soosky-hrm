import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'passwordSetupToken';
const COLLECTION_NAME = 'passwordSetupTokens';

/** 'setup' = brand-new account first password; 'reset' = forgotten/admin reset. */
export const SETUP_TOKEN_PURPOSE = ['setup', 'reset'] as const;
export type SetupTokenPurpose = (typeof SETUP_TOKEN_PURPOSE)[number];

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
