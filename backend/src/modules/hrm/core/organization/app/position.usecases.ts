import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import type {
  AuditPort,
  DepartmentRefGateway,
  EmployeeGateway,
  PositionRepository,
} from '@modules/hrm/core/organization/domain/ports';
import type {
  CreatePositionDto,
  UpdatePositionDto,
} from '@modules/hrm/core/organization/dto/position.dto';

const log = logger.child({ feature: 'organization', module: 'position' });

export class PositionUseCases {
  constructor(
    private readonly repo: PositionRepository,
    private readonly departments: DepartmentRefGateway,
    private readonly employees: EmployeeGateway,
    private readonly audit: AuditPort,
  ) {}

  list(filter: { departmentId?: string; status?: string }) {
    return this.repo.list(filter);
  }

  async findById(id: string) {
    const position = await this.repo.findById(id);
    if (!position) throw new HttpError(404, 'Position not found', 'ORG_005');
    return position;
  }

  async create(input: CreatePositionDto, auditUserId: string) {
    const exists = await this.departments.exists(input.departmentId);
    if (!exists) throw new HttpError(404, 'Department not found', 'ORG_001');

    const dup = await this.repo.findByCode(input.code);
    if (dup) throw new HttpError(409, 'Position code already exists', 'ORG_006');

    const position = await this.repo.create({
      ...input,
      code: input.code.trim().toUpperCase(),
      departmentId: input.departmentId,
    });
    await this.audit.record({
      userId: auditUserId,
      resource: 'position',
      action: 'create',
      resourceId: String(position._id),
    });
    log.info({ positionId: position._id }, 'position created');
    return position;
  }

  async update(id: string, input: UpdatePositionDto, auditUserId: string) {
    if (input.departmentId) {
      const exists = await this.departments.exists(input.departmentId);
      if (!exists) throw new HttpError(404, 'Department not found', 'ORG_001');
    }
    const { departmentId, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest };
    if (departmentId) patch.departmentId = departmentId;
    const updated = await this.repo.updateById(id, patch);
    if (!updated) throw new HttpError(404, 'Position not found', 'ORG_005');

    await this.audit.record({
      userId: auditUserId,
      resource: 'position',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated;
  }

  /**
   * Archive a position (soft): hide from active pickers but keep it referenced
   * by historical employee records. Allowed even when in use.
   */
  async archive(id: string, auditUserId: string) {
    const updated = await this.repo.updateById(id, { status: 'archived' });
    if (!updated) throw new HttpError(404, 'Position not found', 'ORG_005');
    await this.audit.record({
      userId: auditUserId,
      resource: 'position',
      action: 'delete',
      resourceId: id,
      changes: { status: 'archived' },
    });
    log.info({ positionId: id }, 'position archived');
    return updated;
  }

  /** Hard delete — only allowed when no employee references the position. */
  async remove(id: string, auditUserId: string) {
    const inUse = await this.employees.countByPosition(id);
    if (inUse > 0) {
      throw new HttpError(409, 'Cannot delete position assigned to employees', 'ORG_007');
    }
    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new HttpError(404, 'Position not found', 'ORG_005');
    await this.audit.record({
      userId: auditUserId,
      resource: 'position',
      action: 'delete',
      resourceId: id,
    });
    return { id };
  }
}
