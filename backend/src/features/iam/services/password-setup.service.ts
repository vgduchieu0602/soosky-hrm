import crypto from 'node:crypto';
import { Types } from 'mongoose';

import { env } from '@config/env';
import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { HttpError } from '@shared/errors/http-error';
import { hashPassword } from '@shared/utils/hash.util';
import { User } from '@shared/models/user.model';
import {
  PasswordSetupToken,
  type SetupTokenPurpose,
} from '@shared/models/password-setup-token.model';
import { auditService } from '@features/iam/services/audit.service';

const log = logger.child({ feature: 'iam', module: 'password-setup' });

// Onboarding can be slow, so the first-time setup link lives longer than a
// security-sensitive reset link.
const TTL_MS: Record<SetupTokenPurpose, number> = {
  setup: 7 * 24 * 60 * 60 * 1000, // 7 days
  reset: 2 * 60 * 60 * 1000, // 2 hours
};

const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

/** Build the web link the recipient clicks to land on the set-password page. */
export function buildSetPasswordUrl(rawToken: string): string {
  const base = env.APP_WEB_URL.replace(/\/$/, '');
  return `${base}/auth/set-password?token=${encodeURIComponent(rawToken)}`;
}

export const passwordSetupService = {
  /**
   * Issue a single-use password setup/reset token for a user. Any outstanding
   * tokens for that user are invalidated so only the newest link works.
   * Returns the RAW token — store nothing but its hash; the raw value only
   * travels inside the emailed link.
   */
  async issue(userId: string, purpose: SetupTokenPurpose): Promise<string> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new HttpError(400, 'Invalid user id', 'IAM_002');
    }
    const userObjId = new Types.ObjectId(userId);

    // One active link at a time.
    await PasswordSetupToken.deleteMany({ userId: userObjId, usedAt: null });

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(this._now() + TTL_MS[purpose]);

    await PasswordSetupToken.create({
      userId: userObjId,
      tokenHash: hashToken(rawToken),
      purpose,
      expiresAt,
      usedAt: null,
    });

    return rawToken;
  },

  /**
   * Validate a raw token without consuming it (used by the FE to render the
   * correct page state before the user submits). Throws on invalid/expired.
   */
  async check(rawToken: string) {
    const record = await PasswordSetupToken.findOne({
      tokenHash: hashToken(rawToken),
      usedAt: null,
    });
    if (!record || record.expiresAt.getTime() <= this._now()) {
      throw new HttpError(400, 'Liên kết không hợp lệ hoặc đã hết hạn', 'IAM_011');
    }
    const user = await User.findById(record.userId).select('username email');
    if (!user) throw new HttpError(404, 'Tài khoản không tồn tại', 'IAM_002');

    return { purpose: record.purpose, username: user.username, email: user.email };
  },

  /**
   * Consume a token and set the new password. Single-use: the token is marked
   * used and all other outstanding tokens for the user are dropped.
   */
  async consume(rawToken: string, newPassword: string) {
    const record = await PasswordSetupToken.findOne({
      tokenHash: hashToken(rawToken),
      usedAt: null,
    });
    if (!record || record.expiresAt.getTime() <= this._now()) {
      throw new HttpError(400, 'Liên kết không hợp lệ hoặc đã hết hạn', 'IAM_011');
    }

    const user = await User.findById(record.userId).select('+password');
    if (!user) throw new HttpError(404, 'Tài khoản không tồn tại', 'IAM_002');

    user.password = await hashPassword(newPassword);
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    if (user.status === 'locked') user.status = 'active';
    await user.save();

    record.usedAt = new Date();
    await record.save();
    // Invalidate any sibling tokens.
    await PasswordSetupToken.deleteMany({ userId: user._id, usedAt: null });

    await auditService.record({
      userId: user._id.toString(),
      resource: 'user',
      action: 'update',
      resourceId: user._id.toString(),
      changes: { passwordSet: true, via: record.purpose },
    });

    eventBus.emit('iam.user.password-changed', { userId: user._id.toString() });
    log.info({ userId: user._id, purpose: record.purpose }, 'password set via token');

    return { userId: user._id.toString() };
  },

  // Indirection so Date.now is easy to reason about / stub in tests.
  _now(): number {
    return Date.now();
  },
};
