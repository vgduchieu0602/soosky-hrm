import { Types } from 'mongoose';
import {
  EmployeeDocumentModel,
  type IEmployeeDocument,
} from '@shared/models/employee-document.model';

export const employeeDocumentRepository = {
  listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    return EmployeeDocumentModel.find({ employeeId }).sort({ created_at: -1 }).lean();
  },

  create(input: Partial<IEmployeeDocument>) {
    return EmployeeDocumentModel.create(input);
  },

  deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeDocumentModel.findByIdAndDelete(id);
  },
};
