import { Types } from 'mongoose';
import { Allowance, type IAllowance } from '@shared/models/allowance.model';
import { Bonus, type IBonus } from '@shared/models/bonus.model';
import { Deduction, type IDeduction } from '@shared/models/deduction.model';
import {
  EmployeeTaxProfile,
  type IEmployeeTaxProfile,
} from '@shared/models/employee-tax-profile.model';

const valid = (id: string) => Types.ObjectId.isValid(id);

export const allowanceRepository = {
  listByEmployee(employeeId: string) {
    if (!valid(employeeId)) return [];
    return Allowance.find({ employeeId }).sort({ effectiveDate: -1 }).lean();
  },
  create(input: Partial<IAllowance>) {
    return Allowance.create(input);
  },
  updateById(id: string, patch: Partial<IAllowance>) {
    if (!valid(id)) return null;
    return Allowance.findByIdAndUpdate(id, patch, { new: true });
  },
  deleteById(id: string) {
    if (!valid(id)) return null;
    return Allowance.findByIdAndDelete(id);
  },
};

export const bonusRepository = {
  listByEmployee(employeeId: string) {
    if (!valid(employeeId)) return [];
    return Bonus.find({ employeeId }).sort({ created_at: -1 }).lean();
  },
  create(input: Partial<IBonus>) {
    return Bonus.create(input);
  },
  updateById(id: string, patch: Partial<IBonus>) {
    if (!valid(id)) return null;
    return Bonus.findByIdAndUpdate(id, patch, { new: true });
  },
  deleteById(id: string) {
    if (!valid(id)) return null;
    return Bonus.findByIdAndDelete(id);
  },
};

export const deductionRepository = {
  listByEmployee(employeeId: string) {
    if (!valid(employeeId)) return [];
    return Deduction.find({ employeeId }).sort({ effectiveDate: -1 }).lean();
  },
  create(input: Partial<IDeduction>) {
    return Deduction.create(input);
  },
  updateById(id: string, patch: Partial<IDeduction>) {
    if (!valid(id)) return null;
    return Deduction.findByIdAndUpdate(id, patch, { new: true });
  },
  deleteById(id: string) {
    if (!valid(id)) return null;
    return Deduction.findByIdAndDelete(id);
  },
};

export const taxProfileRepository = {
  listByEmployee(employeeId: string) {
    if (!valid(employeeId)) return [];
    return EmployeeTaxProfile.find({ employeeId }).sort({ effectiveDate: -1 }).lean();
  },
  create(input: Partial<IEmployeeTaxProfile>) {
    return EmployeeTaxProfile.create(input);
  },
};
