import { Types } from 'mongoose';
import { PayrollPeriod, type IPayrollPeriod } from '@shared/models/payroll-period.model';

export const payrollPeriodRepository = {
  list() {
    return PayrollPeriod.find().sort({ startDate: -1 }).lean();
  },

  findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return PayrollPeriod.findById(id);
  },

  findByName(name: string) {
    return PayrollPeriod.findOne({ name: name.trim() }).lean();
  },

  create(input: Partial<IPayrollPeriod>) {
    return PayrollPeriod.create(input);
  },

  updateById(id: string, patch: Partial<IPayrollPeriod>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return PayrollPeriod.findByIdAndUpdate(id, patch, { new: true });
  },
};
