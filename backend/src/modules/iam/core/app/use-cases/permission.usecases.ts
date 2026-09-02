import { HttpError } from '@shared/errors/http-error';
import { logger } from '@infra/logger/logger';
import type { PermissionAction } from '@modules/iam/adapters/persistence/models/permission.model';
import type { PermissionRepository, AuditPort } from '@modules/iam/core/app/ports';

const log = logger.child({ feature: 'iam', module: 'permission' });

export interface CreatePermissionInput {
  key: string;
  resource: string;
  action: PermissionAction;
  description?: string;
}

export interface UpdatePermissionInput {
  description?: string;
}

export class PermissionUseCases {
  constructor(
    private readonly permissions: PermissionRepository,
    private readonly audit: AuditPort,
  ) {}

  async create(input: CreatePermissionInput, auditUserId: string) {
    const existing = await this.permissions.findByKey(input.key);
    if (existing) throw new HttpError(409, 'Permission key already exists', 'IAM_009');

    const { id, doc } = await this.permissions.create({
      key: input.key,
      resource: input.resource,
      action: input.action,
      description: input.description || '',
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'permission',
      action: 'create',
      resourceId: id,
      changes: { key: doc.key },
    });

    log.info({ permissionId: id }, 'permission created');
    return doc;
  }

  async findById(permissionId: string) {
    const permission = await this.permissions.findById(permissionId);
    if (!permission) throw new HttpError(404, 'Permission not found', 'IAM_010');
    return permission;
  }

  list() {
    return this.permissions.list();
  }

  async update(permissionId: string, input: UpdatePermissionInput, auditUserId: string) {
    const permission = await this.permissions.updateById(permissionId, input as Record<string, unknown>);
    if (!permission) throw new HttpError(404, 'Permission not found', 'IAM_010');

    await this.audit.record({
      userId: auditUserId,
      resource: 'permission',
      action: 'update',
      resourceId: permissionId,
      changes: input as Record<string, unknown>,
    });

    log.info({ permissionId }, 'permission updated');
    return permission;
  }

  async delete(permissionId: string, auditUserId: string) {
    const permission = await this.permissions.deleteById(permissionId);
    if (!permission) throw new HttpError(404, 'Permission not found', 'IAM_010');

    await this.audit.record({
      userId: auditUserId,
      resource: 'permission',
      action: 'delete',
      resourceId: permissionId,
      changes: { key: permission.key },
    });

    log.info({ permissionId }, 'permission deleted');
    return permission;
  }
}
