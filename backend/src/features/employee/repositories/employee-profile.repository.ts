import { Types } from 'mongoose';
import { EmployeeProfile, type IEmployeeProfile } from '@shared/models/employee-profile.model';

export const employeeProfileRepository = {
  findByEmployeeId(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return null;
    return EmployeeProfile.findOne({ employeeId });
  },

  create(input: IEmployeeProfile) {
    return EmployeeProfile.create(input);
  },

  upsertByEmployeeId(employeeId: string, patch: Partial<IEmployeeProfile>) {
    return EmployeeProfile.findOneAndUpdate(
      { employeeId: new Types.ObjectId(employeeId) },
      { $set: patch },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  },
};
