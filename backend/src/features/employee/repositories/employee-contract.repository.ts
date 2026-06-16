import { Types } from 'mongoose';
import {
  EmployeeContractModel,
  type IEmployeeContract,
} from '@shared/models/employee-contract.model';

export const employeeContractRepository = {
  async listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    const rows = await EmployeeContractModel.find({ employeeId }).sort({ startDate: -1 }).lean();
    // Decimal128 survives `.lean()` as a BSON object — normalize to a string.
    return rows.map((r) => ({
      ...r,
      baseSalary: r.baseSalary != null ? String(r.baseSalary) : '0',
    }));
  },

  findActive(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return null;
    return EmployeeContractModel.findOne({ employeeId, status: 'active' });
  },

  create(input: Partial<IEmployeeContract>) {
    return EmployeeContractModel.create(input);
  },

  updateById(id: string, patch: Partial<IEmployeeContract>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeContractModel.findByIdAndUpdate(id, patch, { new: true });
  },
};
