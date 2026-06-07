import { Types } from 'mongoose';
import { EmployeeHistory, type IEmployeeHistory } from '@shared/models/employee-history.model';

export const employeeHistoryRepository = {
  listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    return EmployeeHistory.find({ employeeId }).sort({ effectiveDate: -1 }).lean();
  },

  create(input: Partial<IEmployeeHistory>) {
    return EmployeeHistory.create(input);
  },
};
