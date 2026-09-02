import { HttpError } from '@shared/errors/http-error';
import { logger } from '@infra/logger/logger';
import type { RoleRepository, AuditPort } from '@modules/iam/core/app/ports';

const log = logger.child({ feature: 'iam', module: 'role' });

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleInput {
  description?: string;
  permissionIds?: string[];
}

export class RoleUseCases {
  constructor(
    private readonly roles: RoleRepository,
    private readonly audit: AuditPort,
  ) {}

  async create(input: CreateRoleInput, auditUserId: string) {
    const existing = await this.roles.findByName(input.name);
    if (existing) throw new HttpError(409, 'Role name already exists', 'IAM_006');

    const { id, doc } = await this.roles.create({
      name: input.name,
      description: input.description || '',
    });

    if (input.permissionIds?.length) {
      await this.roles.setPermissions(id, input.permissionIds);
    }

    await this.audit.record({
      userId: auditUserId,
      resource: 'role',
      action: 'create',
      resourceId: id,
      changes: { name: doc.name },
    });

    log.info({ roleId: id }, 'role created');
    return doc;
  }

  async findById(roleId: string) {
    const role = await this.roles.findById(roleId);
    if (!role) throw new HttpError(404, 'Role not found', 'IAM_007');
    const permissionIds = await this.roles.permissionIdsOf(roleId);
    return { ...role, permissionIds };
  }

  list() {
    return this.roles.list();
  }

  async update(roleId: string, input: UpdateRoleInput, auditUserId: string) {
    const current = await this.roles.findById(roleId);
    if (!current) throw new HttpError(404, 'Role not found', 'IAM_007');

    // System roles (admin/hr_manager/employee) may have their description and
    // permissions edited, but their NAME is protected — grant-login and the
    // requireRoles guards reference those names by string. Deletion stays blocked
    // (handled in `delete`).
    let role = current;
    if (input.description !== undefined) {
      role = (await this.roles.updateDescription(roleId, input.description)) ?? current;
    }

    if (input.permissionIds) {
      await this.roles.replacePermissions(roleId, input.permissionIds);
    }

    await this.audit.record({
      userId: auditUserId,
      resource: 'role',
      action: 'update',
      resourceId: roleId,
      changes: input as Record<string, unknown>,
    });

    log.info({ roleId }, 'role updated');
    return role;
  }

  async delete(roleId: string, auditUserId: string) {
    const role = await this.roles.findById(roleId);
    if (!role) throw new HttpError(404, 'Role not found', 'IAM_007');

    if (role.isSystem) {
      throw new HttpError(403, 'Cannot delete system roles', 'IAM_008');
    }

    await this.roles.deleteById(roleId);
    await this.roles.clearPermissions(roleId);

    await this.audit.record({
      userId: auditUserId,
      resource: 'role',
      action: 'delete',
      resourceId: roleId,
      changes: { name: role.name },
    });

    log.info({ roleId }, 'role deleted');
    return role;
  }
}
