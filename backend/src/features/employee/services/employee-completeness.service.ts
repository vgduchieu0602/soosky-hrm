import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { EmployeeContact } from '@shared/models/employee-contact.model';
import { EmployeeBankAccount } from '@shared/models/employee-bank-account.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeDocumentModel } from '@shared/models/employee-document.model';

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

/**
 * Onboarding completeness: derive a checklist from the existing sub-resources so
 * HR can see at a glance what a new hire's record is still missing.
 */
export const employeeCompletenessService = {
  async forEmployee(employeeId: string): Promise<{ percent: number; items: ChecklistItem[] }> {
    if (!Types.ObjectId.isValid(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    const employee = await Employee.findById(employeeId).select('userId').lean();
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const eid = new Types.ObjectId(employeeId);
    const [profile, contacts, banks, contracts, docs] = await Promise.all([
      EmployeeProfile.findOne({ employeeId: eid }).lean(),
      EmployeeContact.countDocuments({ employeeId: eid }),
      EmployeeBankAccount.countDocuments({ employeeId: eid }),
      EmployeeContractModel.countDocuments({ employeeId: eid }),
      EmployeeDocumentModel.countDocuments({ employeeId: eid }),
    ]);

    const items: ChecklistItem[] = [
      { key: 'personalInfo', label: 'Thông tin cá nhân (ngày sinh, SĐT)', done: !!(profile?.dateOfBirth && profile?.phone), required: true },
      { key: 'personalEmail', label: 'Email cá nhân', done: !!profile?.email, required: true },
      { key: 'address', label: 'Địa chỉ thường trú', done: !!profile?.address, required: false },
      { key: 'emergencyContact', label: 'Người liên hệ khẩn cấp', done: contacts > 0, required: true },
      { key: 'bankAccount', label: 'Tài khoản ngân hàng', done: banks > 0, required: true },
      { key: 'contract', label: 'Hợp đồng lao động', done: contracts > 0, required: true },
      { key: 'loginAccount', label: 'Tài khoản đăng nhập', done: !!employee.userId, required: false },
      { key: 'documents', label: 'Tài liệu đính kèm', done: docs > 0, required: false },
    ];

    const done = items.filter((i) => i.done).length;
    const percent = items.length ? Math.round((done / items.length) * 100) : 0;
    return { percent, items };
  },
};
