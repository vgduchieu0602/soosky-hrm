import { Types, type PipelineStage, type ProjectionType } from 'mongoose';
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

  // Detail read with department/position/manager names resolved (for deep-link
  // detail pages). Kept separate from findById so existence-check callers that
  // rely on bare ObjectId fields are unaffected.
  findByIdPopulated(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Employee.findById(id)
      .populate('departmentId', 'name code')
      .populate('positionId', 'title code level')
      .populate({
        path: 'managerId',
        select: 'employeeCode',
      });
  },

  findByCode(code: string) {
    return Employee.findOne({ employeeCode: code.trim() });
  },

  findByUserId(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return null;
    return Employee.findOne({ userId });
  },

  async paginate({ page, limit, sort, filter }: PaginateOpts) {
    const match = buildFilter(filter);
    // Lookups attach the 1–1 profile, department/position names and the
    // manager's display name so the list is render-ready without N extra calls.
    const lookups: PipelineStage[] = [
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
        $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: 'positions', localField: 'positionId', foreignField: '_id', as: 'position' },
      },
      { $unwind: { path: '$position', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees',
          let: { mgrId: '$managerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$mgrId'] } } },
            {
              $lookup: {
                from: 'employeeProfiles',
                localField: '_id',
                foreignField: 'employeeId',
                as: 'profile',
              },
            },
            { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
            { $project: { employeeCode: 1, 'profile.firstName': 1, 'profile.middleName': 1, 'profile.lastName': 1 } },
          ],
          as: 'manager',
        },
      },
      { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
    ];

    const search = buildSearchMatch(filter.q);
    const searchStages: PipelineStage[] = search ? [{ $match: search }] : [];

    const project: PipelineStage = {
      $project: {
        employeeCode: 1,
        fingerprintId: 1,
        userId: 1,
        employeeType: 1,
        status: 1,
        salaryZone: 1,
        hireDate: 1,
        terminationDate: 1,
        created_at: 1,
        updated_at: 1,
        departmentId: {
          _id: '$department._id',
          name: '$department.name',
          code: '$department.code',
        },
        positionId: {
          _id: '$position._id',
          title: '$position.title',
          code: '$position.code',
          level: '$position.level',
        },
        managerId: {
          $cond: [
            { $ifNull: ['$manager._id', false] },
            {
              _id: '$manager._id',
              employeeCode: '$manager.employeeCode',
              profile: {
                firstName: '$manager.profile.firstName',
                middleName: '$manager.profile.middleName',
                lastName: '$manager.profile.lastName',
              },
            },
            null,
          ],
        },
        profile: {
          firstName: '$profile.firstName',
          middleName: '$profile.middleName',
          lastName: '$profile.lastName',
          email: '$profile.email',
          workEmail: '$profile.workEmail',
          phone: '$profile.phone',
          avatarUrl: '$profile.avatarUrl',
          gender: '$profile.gender',
          maritalStatus: '$profile.maritalStatus',
          nationality: '$profile.nationality',
        },
      },
    };

    const dataPipeline: PipelineStage[] = [
      { $match: match },
      ...lookups,
      ...searchStages,
      { $sort: sort ?? { created_at: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      project,
    ];

    const countPipeline: PipelineStage[] = [
      { $match: match },
      ...lookups,
      ...searchStages,
      { $count: 'total' },
    ];

    const [items, countRes] = await Promise.all([
      Employee.aggregate(dataPipeline),
      Employee.aggregate<{ total: number }>(countPipeline),
    ]);
    return { items, total: countRes[0]?.total ?? 0 };
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
  if (f.status) {
    // Supports single (`active`) or multi-value (`active,on_leave`) filters.
    const values = f.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (values.length === 1) out.status = values[0];
    else if (values.length > 1) out.status = { $in: values };
  }
  if (f.employeeType) out.employeeType = f.employeeType;
  if (f.managerId && Types.ObjectId.isValid(f.managerId)) {
    out.managerId = new Types.ObjectId(f.managerId);
  }
  return out;
}

/**
 * Full-text-ish search applied AFTER profile/position lookups so it can match
 * the employee name, code, fingerprint, position title or company email.
 */
function buildSearchMatch(q?: string): Record<string, unknown> | null {
  if (!q || !q.trim()) return null;
  const rx = { $regex: q.trim(), $options: 'i' };
  return {
    $or: [
      { employeeCode: rx },
      { fingerprintId: rx },
      { 'profile.firstName': rx },
      { 'profile.middleName': rx },
      { 'profile.lastName': rx },
      { 'profile.email': rx },
      { 'profile.workEmail': rx },
      { 'position.title': rx },
    ],
  };
}
