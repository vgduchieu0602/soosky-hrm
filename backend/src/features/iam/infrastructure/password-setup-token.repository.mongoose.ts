import { Types } from 'mongoose';
import { PasswordSetupToken } from '@shared/models/password-setup-token.model';
import type { SetupTokenPurpose } from '@features/iam/domain/setup-token-purpose';
import type { PasswordSetupTokenRepository, Id } from '@features/iam/domain/ports';

export class MongoosePasswordSetupTokenRepository implements PasswordSetupTokenRepository {
  async deleteActiveForUser(userId: Id): Promise<void> {
    await PasswordSetupToken.deleteMany({ userId: new Types.ObjectId(userId), usedAt: null });
  }

  async create(input: {
    userId: Id; tokenHash: string; purpose: SetupTokenPurpose; expiresAt: Date;
  }): Promise<void> {
    await PasswordSetupToken.create({
      userId: new Types.ObjectId(input.userId),
      tokenHash: input.tokenHash,
      purpose: input.purpose,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
  }

  async findActiveByHash(
    tokenHash: string,
  ): Promise<{ userId: string; purpose: SetupTokenPurpose; expiresAt: Date } | null> {
    const record = await PasswordSetupToken.findOne({ tokenHash, usedAt: null });
    if (!record) return null;
    return { userId: String(record.userId), purpose: record.purpose, expiresAt: record.expiresAt };
  }

  async markUsedAndClearSiblings(tokenHash: string, userId: Id): Promise<void> {
    await PasswordSetupToken.updateOne({ tokenHash }, { $set: { usedAt: new Date() } });
    await PasswordSetupToken.deleteMany({ userId: new Types.ObjectId(userId), usedAt: null });
  }
}
