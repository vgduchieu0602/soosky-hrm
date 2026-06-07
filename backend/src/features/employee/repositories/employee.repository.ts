import { Types, type ProjectionType } from 'mongoose';
import { Employee, type IEmployee } from '@shared/models/employee.model';

export interface ListEmployeesFilter {
  departmentId?: string;
  status?: string;
  employeeType?: string;
  managerId?: string;
  q?: string;
}

export interface PaginateOpts {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
  filter: ListEmployeesFilter;
}

export const employeeRepository = {
  findById(id: string, projection?: ProjectionType<IEmployee>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Employee.findById(id, projection);
  },

  findByCode(code: string) {
    return Employee.findOne({ employeeCode: code.trim() });
  },

  findByUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return null;
    return Employee.findOne({ userId });
  },

  async paginate({ page, limit, sort, filter }: PaginateOpts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = buildFilter(filter) as any;
    const [items, total] = await Promise.all([
      Employee.find(match)
        .sort(sort ?? { created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('departmentId', 'name code')
        .populate('positionId', 'title code level')
        .populate('managerId', 'employeeCode')
        .lean(),
      Employee.countDocuments(match),
    ]);
    return { items, total };
  },

  countByStatus() {
    return Employee.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  },

  countByDepartment() {
    return Employee.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]);
  },

  updateById(id: string, patch: Partial<IEmployee>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Employee.findByIdAndUpdate(id, patch, { new: true });
  },
};

function buildFilter(f: ListEmployeesFilter): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.departmentId && Types.ObjectId.isValid(f.departmentId)) {
    out.departmentId = new Types.ObjectId(f.departmentId);
  }
  if (f.status) out.status = f.status;
  if (f.employeeType) out.employeeType = f.employeeType;
  if (f.managerId && Types.ObjectId.isValid(f.managerId)) {
    out.managerId = new Types.ObjectId(f.managerId);
  }
  if (f.q) {
    out.employeeCode = { $regex: f.q, $options: 'i' };
  }
  return out;
}
