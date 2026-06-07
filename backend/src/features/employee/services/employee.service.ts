import mongoose, { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { parsePagination, buildMeta, parseSort } from '@shared/utils/pagination.util';

import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';

import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { employeeProfileRepository } from '@features/employee/repositories/employee-profile.repository';
import { employeeHistoryService } from '@features/employee/services/employee-history.service';
import { auditService } from '@features/iam/services/audit.service';

import type { CreateEmployeeDto } from '@features/employee/dto/create-employee.dto';
import type { UpdateEmployeeDto } from '@features/employee/dto/update-employee.dto';
import type { UpdateProfileDto } from '@features/employee/dto/update-profile.dto';
import type { TerminateEmployeeDto } from '@features/employee/dto/sub-resource.dto';

const log = logger.child({ feature: 'employee', module: 'employee' });

export interface ListEmployeesQuery {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  departmentId?: string;
  status?: string;
  employeeType?: string;
  managerId?: string;
  q?: string;
}

export const employeeService = {
  async create(input: CreateEmployeeDto, auditUserId: string) {
    const [dept, position] = await Promise.all([
      Department.findById(input.departmentId).lean(),
      Position.findById(input.positionId).lean(),
    ]);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!position) throw new HttpError(404, 'Position not found', 'ORG_001');

    const codeExists = await employeeRepository.findByCode(input.employeeCode);
    if (codeExists) throw new HttpError(409, 'Employee code already exists', 'EMP_002');

    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const [employee] = await Employee.create(
          [
            {
              employeeCode: input.employeeCode.trim(),
              departmentId: new Types.ObjectId(input.departmentId),
              positionId: new Types.ObjectId(input.positionId),
              managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
              hireDate: input.hireDate,
              employeeType: input.employeeType,
              salaryZone: input.salaryZone,
              status: 'onboarding',
              userId: null,
            },
          ],
          { session },
        );

        await EmployeeProfile.create(
          [
            {
              employeeId: employee._id,
              firstName: input.profile.firstName,
              lastName: input.profile.lastName,
              dateOfBirth: input.profile.dateOfBirth,
              gender: input.profile.gender ?? 'undisclosed',
              nationality: input.profile.nationality ?? 'VN',
              maritalStatus: input.profile.maritalStatus ?? 'single',
              email: input.profile.email,
              phone: input.profile.phone,
              address: input.profile.address,
            },
          ],
          { session },
        );

        await employeeHistoryService.record({
          employeeId: employee._id.toString(),
          eventType: 'hired',
          toValue: { hireDate: input.hireDate, departmentId: input.departmentId },
          note: 'Gia nhập Soosky',
          createdBy: auditUserId,
          effectiveDate: input.hireDate,
        });

        return employee;
      });

      await auditService.record({
        userId: auditUserId,
        resource: 'employee',
        action: 'create',
        resourceId: result._id.toString(),
        changes: { employeeCode: result.employeeCode },
      });

      log.info({ employeeId: result._id }, 'employee created');
      return result.toJSON();
    } finally {
      await session.endSession();
    }
  },

  async list(query: ListEmployeesQuery) {
    const { page, limit } = parsePagination({ page: query.page, limit: query.limit });
    const sort = parseSort(query.sort);
    const { items, total } = await employeeRepository.paginate({
      page,
      limit,
      sort,
      filter: {
        departmentId: query.departmentId,
        status: query.status,
        employeeType: query.employeeType,
        managerId: query.managerId,
        q: query.q,
      },
    });
    return { items, meta: buildMeta(page, limit, total) };
  },

  async findById(id: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    const profile = await employeeProfileRepository.findByEmployeeId(id);
    return { ...employee.toJSON(), profile: profile?.toJSON() ?? null };
  },

  async findMine(userId: string) {
    const employee = await Employee.findOne({ userId });
    if (!employee) throw new HttpError(404, 'Employee record not found for current user', 'EMP_001');
    const profile = await employeeProfileRepository.findByEmployeeId(employee._id.toString());
    return { ...employee.toJSON(), profile: profile?.toJSON() ?? null };
  },

  async update(id: string, input: UpdateEmployeeDto, auditUserId: string) {
    const before = await employeeRepository.findById(id);
    if (!before) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.departmentId) {
      const exists = await Department.findById(input.departmentId).lean();
      if (!exists) throw new HttpError(404, 'Department not found', 'ORG_001');
    }
    if (input.positionId) {
      const exists = await Position.findById(input.positionId).lean();
      if (!exists) throw new HttpError(404, 'Position not found', 'ORG_001');
    }

    const patch = toObjectIdFields(input);
    const updated = await employeeRepository.updateById(id, patch);
    if (!updated) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.departmentId && input.departmentId !== before.departmentId.toString()) {
      await employeeHistoryService.record({
        employeeId: id,
        eventType: 'transfer',
        fromValue: { departmentId: before.departmentId.toString() },
        toValue: { departmentId: input.departmentId },
        createdBy: auditUserId,
      });
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });

    log.info({ employeeId: id }, 'employee updated');
    return updated.toJSON();
  },

  async updateProfile(employeeId: string, input: UpdateProfileDto, auditUserId: string) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const profile = await employeeProfileRepository.upsertByEmployeeId(employeeId, input);
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeProfile',
      action: 'update',
      resourceId: employeeId,
      changes: input as Record<string, unknown>,
    });
    return profile.toJSON();
  },

  async terminate(id: string, input: TerminateEmployeeDto, auditUserId: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (employee.status === 'terminated') {
      throw new HttpError(409, 'Employee already terminated', 'EMP_004');
    }

    const updated = await employeeRepository.updateById(id, {
      status: 'terminated',
      terminationDate: input.terminationDate,
    });

    await employeeHistoryService.record({
      employeeId: id,
      eventType: 'terminated',
      fromValue: { status: employee.status },
      toValue: { status: 'terminated', terminationDate: input.terminationDate },
      note: input.reason,
      createdBy: auditUserId,
      effectiveDate: input.terminationDate,
    });

    await auditService.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: id,
      changes: { status: 'terminated', terminationDate: input.terminationDate },
    });

    log.info({ employeeId: id }, 'employee terminated');
    return updated?.toJSON();
  },

  async stats() {
    const [byStatus, byDept] = await Promise.all([
      employeeRepository.countByStatus(),
      employeeRepository.countByDepartment(),
    ]);
    const total = byStatus.reduce((s, x) => s + x.count, 0);
    const map = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    return {
      total,
      active: map.active ?? 0,
      onboarding: map.onboarding ?? 0,
      onLeave: map.on_leave ?? 0,
      terminated: map.terminated ?? 0,
      byDepartment: byDept.map((d) => ({ departmentId: d._id.toString(), count: d.count })),
    };
  },
};

function toObjectIdFields(input: UpdateEmployeeDto): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const key of ['departmentId', 'positionId', 'managerId'] as const) {
    const v = input[key];
    if (typeof v === 'string') out[key] = new Types.ObjectId(v);
    else if (v === null) out[key] = null;
  }
  return out;
}
