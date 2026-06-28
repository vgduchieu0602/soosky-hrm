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

  // Scoped by employeeId so a caller can only touch contacts that actually
  // belong to the employee in the URL (prevents cross-employee id tampering).
  updateById(employeeId: string, id: string, patch: Partial<IEmployeeContact>) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(employeeId)) return null;
    return EmployeeContact.findOneAndUpdate({ _id: id, employeeId }, patch, { new: true });
  },

  deleteById(employeeId: string, id: string) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(employeeId)) return null;
    return EmployeeContact.findOneAndDelete({ _id: id, employeeId });
  },

  clearPrimary(employeeId: string) {
    return EmployeeContact.updateMany(
      { employeeId: new Types.ObjectId(employeeId), isPrimary: true },
      { $set: { isPrimary: false } },
    );
  },
};
