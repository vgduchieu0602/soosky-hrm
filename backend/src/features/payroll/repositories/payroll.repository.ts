import { Types } from 'mongoose';
import { Payroll } from '@shared/models/payroll.model';

export interface ListPayrollFilter {
  payrollPeriodId?: string;
  employeeId?: string;
  status?: string;
}

function buildFilter(f: ListPayrollFilter): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.payrollPeriodId && Types.ObjectId.isValid(f.payrollPeriodId)) {
    out.payrollPeriodId = new Types.ObjectId(f.payrollPeriodId);
  }
  if (f.employeeId && Types.ObjectId.isValid(f.employeeId)) {
    out.employeeId = new Types.ObjectId(f.employeeId);
  }
  if (f.status) out.status = f.status;
  return out;
}

export const payrollRepository = {
  findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Payroll.findById(id).lean();
  },

  async paginate(filter: ListPayrollFilter, page: number, limit: number) {
    const match = buildFilter(filter);
    const [items, total] = await Promise.all([
      Payroll.find(match)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payroll.countDocuments(match),
    ]);
    return { items, total };
  },

  /** Summed payroll cost for a period — for the BOD fund-approval view. */
  totalsForPeriod(payrollPeriodId: string) {
    if (!Types.ObjectId.isValid(payrollPeriodId)) return Promise.resolve([]);
    return Payroll.aggregate<{ _id: string; count: number; gross: unknown; net: unknown }>([
      { $match: { payrollPeriodId: new Types.ObjectId(payrollPeriodId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          gross: { $sum: { $toDouble: '$grossSalary' } },
          net: { $sum: { $toDouble: '$netSalary' } },
        },
      },
    ]);
  },
};
