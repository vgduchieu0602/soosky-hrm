import { Types } from 'mongoose';
import { User } from '@shared/models/user.model';

export const MAX_FAILED_ATTEMPTS = 5;

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const userRepository = {
  findByIdentifier(identifier: string) {
    const trimmed = identifier.trim();
    const query = isEmail(trimmed)
      ? { email: trimmed.toLowerCase() }
      : { username: trimmed };
    return User.findOne(query).select('+password');
  },

  findById(userId: string) {
    return User.findById(userId);
  },

  /**
   * Increments failedLoginAttempts. If the post-update value reaches the
   * threshold, sets status='locked'. Returns the updated counter so callers
   * can decide whether to emit `iam.user.locked`.
   */
  async incrementFailedAttempts(userId: string): Promise<{ attempts: number; locked: boolean }> {
    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { failedLoginAttempts: 1 } },
      { new: true, projection: { failedLoginAttempts: 1, status: 1 } },
    );
    if (!updated) return { attempts: 0, locked: false };

    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS && updated.status === 'active') {
      await User.updateOne({ _id: userId }, { $set: { status: 'locked' } });
      return { attempts: updated.failedLoginAttempts, locked: true };
    }
    return { attempts: updated.failedLoginAttempts, locked: updated.status === 'locked' };
  },

  resetLoginState(userId: string) {
    return User.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, lastLoginAt: new Date() } },
    );
  },

  toObjectId(id: string) {
    return new Types.ObjectId(id);
  },
};
