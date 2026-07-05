import { Types, type ClientSession } from 'mongoose';
import { Employee } from '@shared/models/employee.model';
import { EmployeeHistory } from '@shared/models/employee-history.model';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import type { HeadRow } from '@features/organization/domain/department-tree';
import type {
  DepartmentRefGateway,
  EmployeeGateway,
  EmployeeHistoryGateway,
  Id,
  PositionGateway,
  TransferHistoryEntry,
  Tx,
} from '@features/organization/domain/ports';

const oid = (id: Id) => new Types.ObjectId(id);

export class MongooseEmployeeGateway implements EmployeeGateway {
  async headcountByDepartment(): Promise<{ departmentId: string; count: number }[]> {
    const counts = await Employee.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]);
    return counts.map((c) => ({ departmentId: c._id.toString(), count: c.count }));
  }

  async findHeads(managerIds: Id[]): Promise<HeadRow[]> {
    const heads = await Employee.aggregate<{
      _id: Types.ObjectId;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      avatarUrl?: string;
    }>([
      { $match: { _id: { $in: managerIds.map(oid) }, status: { $ne: 'terminated' } } },
      {
        $lookup: {
          from: 'employeeProfiles',
          localField: '_id',
          foreignField: 'employeeId',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          firstName: '$profile.firstName',
          middleName: '$profile.middleName',
          lastName: '$profile.lastName',
          avatarUrl: '$profile.avatarUrl',
        },
      },
    ]);
    return heads.map((h) => ({
      id: h._id.toString(),
      firstName: h.firstName,
      middleName: h.middleName,
      lastName: h.lastName,
      avatarUrl: h.avatarUrl,
    }));
  }

  async findEmployeeStatus(id: Id): Promise<{ status: string } | null> {
    const emp = await Employee.findById(id).lean();
    return emp ? { status: emp.status } : null;
  }

  countActiveInDepartment(deptId: Id): Promise<number> {
    return Employee.countDocuments({ departmentId: oid(deptId), status: { $ne: 'terminated' } });
  }

  countAllInDepartment(deptId: Id): Promise<number> {
    return Employee.countDocuments({ departmentId: oid(deptId) });
  }

  countByStatuses(deptId: Id, statuses: readonly string[]): Promise<number> {
    return Employee.countDocuments({
      departmentId: oid(deptId),
      status: { $in: [...statuses] as never },
    });
  }

  countByPosition(positionId: Id): Promise<number> {
    return Employee.countDocuments({ positionId: oid(positionId) });
  }

  async findTransferableIds(deptId: Id, employeeIds?: Id[]): Promise<string[]> {
    const filter: Record<string, unknown> = {
      departmentId: oid(deptId),
      status: { $ne: 'terminated' },
    };
    if (employeeIds?.length) {
      filter._id = { $in: employeeIds.map(oid) };
    }
    const emps = await Employee.find(filter).select('_id').lean();
    return emps.map((e) => String(e._id));
  }

  async moveEmployees(ids: Id[], targetDeptId: Id, tx: Tx): Promise<void> {
    await Employee.updateMany(
      { _id: { $in: ids.map(oid) } },
      { departmentId: oid(targetDeptId) },
      { session: tx as ClientSession },
    );
  }
}

export class MongooseEmployeeHistoryGateway implements EmployeeHistoryGateway {
  async recordTransfers(entries: TransferHistoryEntry[], tx: Tx): Promise<void> {
    await EmployeeHistory.create(
      entries.map((e) => ({
        employeeId: oid(e.employeeId),
        eventType: 'transfer' as const,
        fromValue: { departmentId: e.fromDepartmentId },
        toValue: { departmentId: e.toDepartmentId },
        effectiveDate: e.effectiveDate,
        note: e.note,
        createdBy: oid(e.createdBy),
      })),
      { session: tx as ClientSession },
    );
  }
}

export class MongoosePositionGateway implements PositionGateway {
  countByDepartment(deptId: Id): Promise<number> {
    return Position.countDocuments({ departmentId: oid(deptId) });
  }

  async moveAll(sourceDeptId: Id, targetDeptId: Id, tx: Tx): Promise<void> {
    await Position.updateMany(
      { departmentId: oid(sourceDeptId) },
      { departmentId: oid(targetDeptId) },
      { session: tx as ClientSession },
    );
  }
}

export class MongooseDepartmentRefGateway implements DepartmentRefGateway {
  async exists(id: Id): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    return !!(await Department.findById(id).lean());
  }
}
