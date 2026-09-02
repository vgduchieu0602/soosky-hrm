import { Types, type PipelineStage } from 'mongoose';
import { User } from '@modules/iam/adapters/persistence/models/user.model';
import { isEmailIdentifier, MAX_FAILED_ATTEMPTS } from '@modules/iam/core/domain/policy';
import type { UserRepository, AuthUserRecord, Id } from '@modules/iam/core/app/ports';

function toAuthRecord(u: {
  _id: unknown; username: string; email: string; password: string; status: string; mustChangePassword: boolean;
}): AuthUserRecord {
  return {
    id: String(u._id),
    username: u.username,
    email: u.email,
    password: u.password,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
  };
}

export class MongooseUserRepository implements UserRepository {
  async findByIdentifier(identifier: string): Promise<AuthUserRecord | null> {
    const trimmed = identifier.trim();
    const query = isEmailIdentifier(trimmed)
      ? { email: trimmed.toLowerCase() }
      : { username: trimmed };
    const u = await User.findOne(query).select('+password');
    return u ? toAuthRecord(u as never) : null;
  }

  async findAuthById(id: Id): Promise<AuthUserRecord | null> {
    const u = await User.findById(id).select('+password');
    return u ? toAuthRecord(u as never) : null;
  }

  async findPublicById(id: Id): Promise<Record<string, unknown> | null> {
    const u = await User.findById(id);
    return u ? (u.toJSON() as unknown as Record<string, unknown>) : null;
  }

  async findConflict(username: string, email: string): Promise<{ username: string } | null> {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    return existing ? { username: existing.username } : null;
  }

  async create(input: {
    username: string; email: string; password: string; employeeId?: string | null;
  }): Promise<{ id: Id; doc: Record<string, unknown> }> {
    const user = await User.create({
      username: input.username,
      email: input.email,
      password: input.password,
      employeeId: input.employeeId ? new Types.ObjectId(input.employeeId) : null,
      status: 'active',
      mustChangePassword: true,
      failedLoginAttempts: 0,
    });
    return { id: user._id.toString(), doc: user.toJSON() as unknown as Record<string, unknown> };
  }

  list(filter: { status?: string; search?: string }): Promise<Record<string, unknown>[]> {
    const match: Record<string, unknown> = {};
    if (filter.status) match.status = filter.status;

    const fullName = {
      $trim: {
        input: {
          $concat: [
            { $ifNull: ['$_profile.lastName', ''] }, ' ',
            { $ifNull: ['$_profile.middleName', ''] }, ' ',
            { $ifNull: ['$_profile.firstName', ''] },
          ],
        },
      },
    };

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $project: { password: 0 } },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: '_emp' } },
      { $unwind: { path: '$_emp', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'employeeProfiles', localField: '_emp._id', foreignField: 'employeeId', as: '_profile' } },
      { $unwind: { path: '$_profile', preserveNullAndEmptyArrays: true } },
      { $addFields: { employeeCode: '$_emp.employeeCode', employeeName: fullName } },
    ];

    // Search spans username, email, employee name and employee code.
    if (filter.search) {
      const rx = { $regex: filter.search, $options: 'i' };
      pipeline.push({
        $match: { $or: [{ username: rx }, { email: rx }, { employeeName: rx }, { employeeCode: rx }] },
      });
    }

    pipeline.push({ $project: { _emp: 0, _profile: 0 } }, { $sort: { created_at: -1 } });
    return User.aggregate(pipeline);
  }

  async updateById(id: Id, patch: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const user = await User.findByIdAndUpdate(id, patch, { new: true });
    return user ? (user.toJSON() as unknown as Record<string, unknown>) : null;
  }

  async incrementFailedAttempts(id: Id): Promise<{ attempts: number; locked: boolean }> {
    const updated = await User.findByIdAndUpdate(
      id,
      { $inc: { failedLoginAttempts: 1 } },
      { new: true, projection: { failedLoginAttempts: 1, status: 1 } },
    );
    if (!updated) return { attempts: 0, locked: false };

    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS && updated.status === 'active') {
      await User.updateOne({ _id: id }, { $set: { status: 'locked' } });
      return { attempts: updated.failedLoginAttempts, locked: true };
    }
    return { attempts: updated.failedLoginAttempts, locked: updated.status === 'locked' };
  }

  async resetLoginState(id: Id): Promise<void> {
    await User.updateOne({ _id: id }, { $set: { failedLoginAttempts: 0, lastLoginAt: new Date() } });
  }

  async setPassword(id: Id, passwordHash: string): Promise<boolean> {
    const res = await User.findByIdAndUpdate(id, { password: passwordHash, mustChangePassword: false });
    return !!res;
  }

  async setPasswordViaToken(id: Id, passwordHash: string): Promise<string | null> {
    const user = await User.findById(id).select('status');
    if (!user) return null;
    const patch: Record<string, unknown> = {
      password: passwordHash,
      mustChangePassword: false,
      failedLoginAttempts: 0,
    };
    if (user.status === 'locked') patch.status = 'active';
    await User.updateOne({ _id: id }, { $set: patch });
    return String(user._id);
  }

  async findPasswordById(id: Id): Promise<{ id: string; password: string } | null> {
    const u = await User.findById(id).select('+password');
    return u ? { id: String(u._id), password: u.password } : null;
  }
}
