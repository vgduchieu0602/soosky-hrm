import { Types, type ClientSession } from 'mongoose';
import { Session } from '@modules/auth/adapters/persistence/models/session.model';
import { hashRefreshToken } from '@shared/crypto/hash.util';
import type { SessionRepository, Id, Tx } from '@modules/auth/core/app/ports';

export class MongooseSessionRepository implements SessionRepository {
  newSessionId(): Id {
    return new Types.ObjectId().toString();
  }

  async create(input: {
    sessionId: Id; userId: Id; refreshToken: string; userAgent?: string; ip?: string; expiresAt: Date;
  }): Promise<void> {
    await Session.create({
      _id: new Types.ObjectId(input.sessionId),
      userId: new Types.ObjectId(input.userId),
      refreshTokenHash: hashRefreshToken(input.refreshToken),
      userAgent: input.userAgent ?? '',
      ip: input.ip ?? '',
      expiresAt: input.expiresAt,
    });
  }

  async findActiveByIdAndHash(sessionId: Id, refreshTokenHash: string): Promise<{ _id: string } | null> {
    const s = await Session.findOne({
      _id: new Types.ObjectId(sessionId),
      refreshTokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    return s ? { _id: String(s._id) } : null;
  }

  async rotate(sessionId: Id, newRefreshToken: string, newExpiresAt: Date): Promise<void> {
    await Session.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { refreshTokenHash: hashRefreshToken(newRefreshToken), expiresAt: newExpiresAt } },
    );
  }

  async revoke(sessionId: Id): Promise<void> {
    await Session.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeAllForUser(userId: Id, tx?: Tx): Promise<void> {
    const session = tx as ClientSession | undefined;
    await Session.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
      session ? { session } : {},
    );
  }

  async revokeAllForUserExcept(userId: Id, exceptSessionId: Id): Promise<void> {
    await Session.updateMany(
      {
        userId: new Types.ObjectId(userId),
        _id: { $ne: new Types.ObjectId(exceptSessionId) },
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
    );
  }
}
