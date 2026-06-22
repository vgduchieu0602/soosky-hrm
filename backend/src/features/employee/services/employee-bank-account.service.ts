import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { employeeBankAccountRepository } from '@features/employee/repositories/employee-bank-account.repository';
import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '@features/employee/dto/sub-resource.dto';

export const employeeBankAccountService = {
  async list(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    return employeeBankAccountRepository.listByEmployee(employeeId);
  },

  async create(employeeId: string, input: CreateBankAccountDto, auditUserId: string) {
    const emp = await employeeRepository.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.isPrimary) {
      await employeeBankAccountRepository.clearPrimary(employeeId);
    }
    const acct = await employeeBankAccountRepository.create({
      ...input,
      employeeId: new Types.ObjectId(employeeId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeBankAccount',
      action: 'create',
      resourceId: acct._id.toString(),
    });
    return acct.toJSON();
  },

  async update(
    employeeId: string,
    accountId: string,
    input: UpdateBankAccountDto,
    auditUserId: string,
  ) {
    if (input.isPrimary) {
      await employeeBankAccountRepository.clearPrimary(employeeId);
    }
    const updated = await employeeBankAccountRepository.updateById(accountId, input);
    if (!updated) throw new HttpError(404, 'Bank account not found', 'EMP_005');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeBankAccount',
      action: 'update',
      resourceId: accountId,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },

  async remove(employeeId: string, accountId: string, auditUserId: string) {
    const deleted = await employeeBankAccountRepository.deleteById(accountId);
    if (!deleted) throw new HttpError(404, 'Bank account not found', 'EMP_005');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeBankAccount',
      action: 'delete',
      resourceId: accountId,
    });
    return { deleted: true };
  },
};
