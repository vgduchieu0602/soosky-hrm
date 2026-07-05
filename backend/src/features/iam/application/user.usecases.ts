import { HttpError } from '@shared/errors/http-error';
import { logger } from '@core/logger/logger';
import type { UserRepository, PasswordHasher, AuditPort } from '@features/iam/domain/ports';

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

export class UserUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditPort,
  ) {}

  async create(input: CreateUserInput, auditUserId: string) {
    const conflict = await this.users.findConflict(input.username, input.email);
    if (conflict) {
      throw new HttpError(
        409,
        conflict.username === input.username ? 'Username already exists' : 'Email already exists',
        'IAM_004',
      );
    }

    const hashedPassword = await this.hasher.hash(input.password);
    const { id, doc } = await this.users.create({
      username: input.username.trim(),
      email: input.email.toLowerCase().trim(),
      password: hashedPassword,
      employeeId: input.employeeId ?? null,
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'user',
      action: 'create',
      resourceId: id,
      changes: { username: doc.username, email: doc.email },
    });

    log.info({ userId: id }, 'user created');
    return doc;
  }

  async findById(userId: string) {
    const user = await this.users.findPublicById(userId);
    if (!user) throw new HttpError(404, 'User not found', 'IAM_002');
    return user;
  }

  list(filter?: { status?: string; search?: string }) {
    return this.users.list(filter ?? {});
  }

  async update(userId: string, input: UpdateUserInput, auditUserId: string) {
    const user = await this.users.updateById(userId, input as Record<string, unknown>);
    if (!user) throw new HttpError(404, 'User not found', 'IAM_002');

    await this.audit.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: userId,
      changes: input as Record<string, unknown>,
    });

    log.info({ userId }, 'user updated');
    return user;
  }

  async delete(userId: string, auditUserId: string) {
    const user = await this.users.updateById(userId, { status: 'disabled' });
    if (!user) throw new HttpError(404, 'User not found', 'IAM_002');

    await this.audit.record({
      userId: auditUserId,
      resource: 'user',
      action: 'delete',
      resourceId: userId,
      changes: { status: 'disabled' },
    });

    log.info({ userId }, 'user deleted');
    return user;
  }
}
