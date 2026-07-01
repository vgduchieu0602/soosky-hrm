import { Types, type ClientSession } from 'mongoose';
import { Department, type IDepartment } from '@shared/models/department.model';

export const departmentRepository = {
  findAll() {
    return Department.find({}).sort({ code: 1 }).lean();
  },

  findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Department.findById(id).populate({ path: 'managerId', select: 'employeeCode status' });
  },

  findByCode(code: string) {
    return Department.findOne({ code: code.trim().toUpperCase() });
  },

  findChildren(parentId: string) {
    if (!Types.ObjectId.isValid(parentId)) return Promise.resolve([]);
    return Department.find({ parentDepartmentId: new Types.ObjectId(parentId) }).lean();
  },

  create(input: Partial<IDepartment>) {
    return Department.create(input);
  },

  updateById(id: string, patch: Partial<IDepartment>, session?: ClientSession) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Department.findByIdAndUpdate(id, patch, { new: true, session });
  },

  deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Department.findByIdAndDelete(id);
  },
};
