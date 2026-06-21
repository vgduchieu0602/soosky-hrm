import { Types, type PipelineStage } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { hashPassword } from '@shared/utils/hash.util';
import { logger } from '@core/logger/logger';

import { User } from '@shared/models/user.model';
import { userRepository } from '@features/iam/repositories/user.repository';
import { auditService } from '@features/iam/services/audit.service';

const log = logger.child({ feature: 'iam', module: 'user' });

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  employeeId?: string;
}

export interface UpdateUserInput {
  email?: string;
  status?: 'active' | 'disabled' | 'locked';
  mustChangePassword?: boolean;
}

export const userService = {
  async create(input: CreateUserInput, auditUserId: string) {
    const existing = await User.findOne({
      $or: [{ username: input.username }, { email: input.email }],
    });

    if (existing) {
      throw new HttpError(
        409,
        existing.username === input.username ? 'Username already exists' : 'Email already exists',
        'IAM_004',
      );
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await User.create({
      username: input.username.trim(),
      email: input.email.toLowerCase().trim(),
      password: hashedPassword,
      employeeId: input.employeeId ? new Types.ObjectId(input.employeeId) : null,
      status: 'active',
      mustChangePassword: true,
      failedLoginAttempts: 0,
    });

    await auditService.record({
      userId: auditUserId,
      resource: 'user',
      action: 'create',
      resourceId: user._id.toString(),
      changes: { username: user.username, email: user.email },
    });

    log.info({ userId: user._id }, 'user created');
    return user.toJSON();
  },

  async findById(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, 'User not found', 'IAM_002');
    return user.toJSON();
  },

  async list(filter?: { status?: string; search?: string }) {
    const match: Record<string, unknown> = {};
    if (filter?.status) match.status = filter.status;

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
    if (filter?.search) {
      const rx = { $regex: filter.search, $options: 'i' };
      pipeline.push({
        $match: { $or: [{ username: rx }, { email: rx }, { employeeName: rx }, { employeeCode: rx }] },
      });
    }

    pipeline.push({ $project: { _emp: 0, _profile: 0 } }, { $sort: { created_at: -1 } });
    return User.aggregate(pipeline);
  },

  async update(userId: string, input: UpdateUserInput, auditUserId: string) {
    const user = await User.findByIdAndUpdate(userId, input as Record<string, unknown>, { new: true });
    if (!user) throw new HttpError(404, 'User not found', 'IAM_002');

    await auditService.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: userId,
      changes: input as Record<string, unknown>,
    });

    log.info({ userId }, 'user updated');
    return user.toJSON();
  },

  async delete(userId: string, auditUserId: string) {
    const user = await User.findByIdAndUpdate(userId, { status: 'disabled' }, { new: true });
    if (!user) throw new HttpError(404, 'User not found', 'IAM_002');

    await auditService.record({
      userId: auditUserId,
      resource: 'user',
      action: 'delete',
      resourceId: userId,
      changes: { status: 'disabled' },
    });

    log.info({ userId }, 'user deleted');
    return user.toJSON();
  },
};
