import { Types } from 'mongoose';
import { Department, type IDepartment } from '@shared/models/department.model';

export const departmentRepository = {
  findAll() {
    return Department.find({}).sort({ code: 1 }).lean();
  },

  findById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Department.findById(id);
  },

  findByCode(code: string) {
    return Department.findOne({ code: code.trim().toUpperCase() });
  },

  create(input: Partial<IDepartment>) {
    return Department.create(input);
  },

  updateById(id: string, patch: Partial<IDepartment>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return Department.findByIdAndUpdate(id, patch, { new: true });
  },
};
