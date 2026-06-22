import { Types } from 'mongoose';
import {
  EmployeeBankAccount,
  type IEmployeeBankAccount,
} from '@shared/models/employee-bank-account.model';

export const employeeBankAccountRepository = {
  listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    return EmployeeBankAccount.find({ employeeId }).sort({ isPrimary: -1, created_at: -1 }).lean();
  },

  create(input: Partial<IEmployeeBankAccount>) {
    return EmployeeBankAccount.create(input);
  },

  updateById(id: string, patch: Partial<IEmployeeBankAccount>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeBankAccount.findByIdAndUpdate(id, patch, { new: true });
  },

  deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeBankAccount.findByIdAndDelete(id);
  },

  clearPrimary(employeeId: string) {
    return EmployeeBankAccount.updateMany(
      { employeeId: new Types.ObjectId(employeeId), isPrimary: true },
      { $set: { isPrimary: false } },
    );
  },
};
