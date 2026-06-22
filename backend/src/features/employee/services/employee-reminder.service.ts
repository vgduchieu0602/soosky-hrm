import { type PipelineStage } from 'mongoose';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';

export interface ReminderItem {
  contractId: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  contractType: string;
  employmentStatus: string;
  contractNumber: string;
  endDate: string;
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Active contracts whose endDate falls within the next `withinDays`, joined with
 * the (non-terminated) employee + profile. Split by employmentStatus so the UI
 * can show "probation/internship ending" vs "contract expiring" separately.
 */
export const employeeReminderService = {
  async expiring(withinDays = 30): Promise<{ probation: ReminderItem[]; contract: ReminderItem[] }> {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * DAY_MS);

    const pipeline: PipelineStage[] = [
      { $match: { status: 'active', endDate: { $ne: null, $lte: horizon } } },
      {
        $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' },
      },
      { $unwind: '$employee' },
      { $match: { 'employee.status': { $ne: 'terminated' } } },
      {
        $lookup: { from: 'employeeProfiles', localField: 'employeeId', foreignField: 'employeeId', as: 'profile' },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: 'departments', localField: 'employee.departmentId', foreignField: '_id', as: 'department' },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $sort: { endDate: 1 } },
      {
        $project: {
          contractId: '$_id',
          employeeId: '$employeeId',
          employeeCode: '$employee.employeeCode',
          firstName: '$profile.firstName',
          middleName: '$profile.middleName',
          lastName: '$profile.lastName',
          departmentName: '$department.name',
          contractType: 1,
          employmentStatus: 1,
          contractNumber: 1,
          endDate: 1,
        },
      },
    ];

    type Row = {
      contractId: unknown; employeeId: unknown; employeeCode: string;
      firstName?: string; middleName?: string; lastName?: string;
      departmentName?: string; contractType: string; employmentStatus: string;
      contractNumber: string; endDate: Date;
    };
    const rows = await EmployeeContractModel.aggregate<Row>(pipeline);

    const probation: ReminderItem[] = [];
    const contract: ReminderItem[] = [];
    for (const r of rows) {
      const fullName = [r.lastName, r.middleName, r.firstName].filter(Boolean).join(' ') || r.employeeCode;
      const daysLeft = Math.ceil((new Date(r.endDate).getTime() - now.getTime()) / DAY_MS);
      const item: ReminderItem = {
        contractId: String(r.contractId),
        employeeId: String(r.employeeId),
        employeeCode: r.employeeCode,
        fullName,
        departmentName: r.departmentName ?? null,
        contractType: r.contractType,
        employmentStatus: r.employmentStatus,
        contractNumber: r.contractNumber,
        endDate: new Date(r.endDate).toISOString(),
        daysLeft,
      };
      (r.employmentStatus === 'probation' || r.employmentStatus === 'internship' ? probation : contract).push(item);
    }
    return { probation, contract };
  },
};
