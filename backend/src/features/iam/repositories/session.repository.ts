import { Types, type ClientSession } from 'mongoose';
import { Session, type SessionDoc } from '@shared/models/session.model';
import { hashRefreshToken } from '@shared/utils/hash.util';

interface CreateSessionInput {
  sessionId: Types.ObjectId;
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
}

export const sessionRepository = {
  create(input: CreateSessionInput) {
    return Session.create({
      _id: input.sessionId,
      userId: new Types.ObjectId(input.userId),
      refreshTokenHash: hashRefreshToken(input.refreshToken),
      userAgent: input.userAgent ?? '',
      ip: input.ip ?? '',
      expiresAt: input.expiresAt,
    });
  },

  findActiveById(sessionId: string): Promise<SessionDoc | null> {
    return Session.findOne({
      _id: new Types.ObjectId(sessionId),
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
  },

  /**
   * Rotate: store the new refresh token hash + new expiry on the existing session.
   */
  rotate(sessionId: string, newRefreshToken: string, newExpiresAt: Date) {
    return Session.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      {
        $set: {
          refreshTokenHash: hashRefreshToken(newRefreshToken),
          expiresAt: newExpiresAt,
        },
      },
    );
  },

  revoke(sessionId: string) {
    return Session.updateOne(
      { _id: new Types.ObjectId(sessionId) },
      { $set: { revokedAt: new Date() } },
    );
  },

  revokeAllForUser(userId: string, session?: ClientSession) {
    return Session.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
      session ? { session } : {},
    );
  },

  /** Revoke every live session for a user except the one given (e.g. keep the
   *  current device signed in after a self-service password change). */
  revokeAllForUserExcept(userId: string, exceptSessionId: string) {
    return Session.updateMany(
      {
        userId: new Types.ObjectId(userId),
        _id: { $ne: new Types.ObjectId(exceptSessionId) },
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
    );
  },

  /**
   * Used during refresh: check that the provided refresh token hash matches
   * the session's CURRENT hash. Returns null if the session is missing,
   * revoked, expired, OR the hash has already been rotated (reuse).
   */
  findActiveByIdAndHash(sessionId: string, refreshTokenHash: string): Promise<SessionDoc | null> {
    return Session.findOne({
      _id: new Types.ObjectId(sessionId),
      refreshTokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
  },
};
