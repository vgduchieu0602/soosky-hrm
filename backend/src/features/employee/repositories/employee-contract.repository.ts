import { Types } from 'mongoose';
import {
  EmployeeContractModel,
  type IEmployeeContract,
} from '@shared/models/employee-contract.model';

export const employeeContractRepository = {
  listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    return EmployeeContractModel.find({ employeeId }).sort({ startDate: -1 }).lean();
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
