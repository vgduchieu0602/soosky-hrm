import { Types, type PipelineStage } from 'mongoose';
import { Employee } from '@shared/models/employee.model';

export interface RosterRow {
  _id: Types.ObjectId;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  hireDate?: Date | null;
}

/**
 * Active employees with full name + department, for the admin attendance grid.
 * Vietnamese name order: lastName middleName firstName.
 */
export function rosterForGrid(filter: { departmentId?: string; q?: string }) {
  const match: Record<string, unknown> = { status: { $ne: 'terminated' } };
  if (filter.departmentId && Types.ObjectId.isValid(filter.departmentId)) {
    match.departmentId = new Types.ObjectId(filter.departmentId);
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
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
      $lookup: {
        from: 'departments',
        localField: 'departmentId',
        foreignField: '_id',
        as: 'department',
      },
    },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        employeeCode: 1,
        hireDate: 1,
        departmentName: { $ifNull: ['$department.name', ''] },
        fullName: {
          $trim: {
            input: {
              $reduce: {
                input: [
                  { $ifNull: ['$profile.lastName', ''] },
                  { $ifNull: ['$profile.middleName', ''] },
                  { $ifNull: ['$profile.firstName', ''] },
                ],
                initialValue: '',
                in: { $concat: ['$$value', ' ', '$$this'] },
              },
            },
          },
        },
      },
    },
  ];

  if (filter.q?.trim()) {
    const rx = { $regex: filter.q.trim(), $options: 'i' };
    pipeline.push({ $match: { $or: [{ employeeCode: rx }, { fullName: rx }] } });
  }
  pipeline.push({ $sort: { employeeCode: 1 } });

  return Employee.aggregate<RosterRow>(pipeline);
}
