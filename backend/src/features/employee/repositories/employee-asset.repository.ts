import { Types } from 'mongoose';
import { EmployeeAsset, type IEmployeeAsset } from '@shared/models/employee-asset.model';

export const employeeAssetRepository = {
  listByEmployee(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) return [];
    return EmployeeAsset.find({ employeeId }).sort({ assignedDate: -1 }).lean();
  },

  create(input: Partial<IEmployeeAsset>) {
    return EmployeeAsset.create(input);
  },

  markReturned(id: string, patch: Partial<IEmployeeAsset>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeAsset.findByIdAndUpdate(id, patch, { new: true });
  },

  updateById(id: string, patch: Partial<IEmployeeAsset>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeAsset.findByIdAndUpdate(id, patch, { new: true });
  },

  deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return EmployeeAsset.findByIdAndDelete(id);
  },
};
