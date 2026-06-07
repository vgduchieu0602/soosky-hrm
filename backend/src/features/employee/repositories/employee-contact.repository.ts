import { Types } from 'mongoose';
import { EmployeeContact, type IEmployeeContact } from '@shared/models/employee-contact.model';

export const employeeContactRepository = {
  listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    return EmployeeContact.find({ employeeId }).sort({ isPrimary: -1, created_at: -1 }).lean();
  },

  create(input: Partial<IEmployeeContact>) {
    return EmployeeContact.create(input);
  },

  updateById(id: string, patch: Partial<IEmployeeContact>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeContact.findByIdAndUpdate(id, patch, { new: true });
  },

  deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeContact.findByIdAndDelete(id);
  },

  clearPrimary(employeeId: string) {
    return EmployeeContact.updateMany(
      { employeeId: new Types.ObjectId(employeeId), isPrimary: true },
      { $set: { isPrimary: false } },
    );
  },
};
