import mongoose, { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { employeeContractRepository } from '@features/employee/repositories/employee-contract.repository';
import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { employeeHistoryService } from '@features/employee/services/employee-history.service';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateContractDto,
  UpdateContractDto,
} from '@features/employee/dto/sub-resource.dto';

export const employeeContractService = {
  async list(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    return employeeContractRepository.listByEmployee(employeeId);
  },

  async create(employeeId: string, input: CreateContractDto, auditUserId: string) {
    const emp = await employeeRepository.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const dup = await EmployeeContractModel.findOne({ contractNumber: input.contractNumber });
    if (dup) throw new HttpError(409, 'Contract number already exists', 'EMP_006');

    const session = await mongoose.startSession();
    try {
      const created = await session.withTransaction(async () => {
        // Close any active contract before creating a new one
        await EmployeeContractModel.updateMany(
          { employeeId: new Types.ObjectId(employeeId), status: 'active' },
          { $set: { status: 'expired' } },
          { session },
        );

        const [contract] = await EmployeeContractModel.create(
          [
            {
              ...input,
              employeeId: new Types.ObjectId(employeeId),
              baseSalary: mongoose.Types.Decimal128.fromString(String(input.baseSalary)),
            },
          ],
          { session },
        );

        await employeeHistoryService.record({
          employeeId,
          eventType: 'contract_renew',
          toValue: { contractNumber: input.contractNumber, contractType: input.contractType },
          createdBy: auditUserId,
          effectiveDate: input.startDate,
        });

        return contract;
      });

      await auditService.record({
        userId: auditUserId,
        resource: 'employeeContract',
        action: 'create',
        resourceId: created._id.toString(),
      });

      return created.toJSON();
    } finally {
      await session.endSession();
    }
  },

  async update(contractId: string, input: UpdateContractDto, auditUserId: string) {
    const patch: Record<string, unknown> = { ...input };
    if (input.baseSalary !== undefined) {
      patch.baseSalary = mongoose.Types.Decimal128.fromString(String(input.baseSalary));
    }
    // Re-activating a contract must keep the "one active contract per employee"
    // invariant — expire any other active contract of the same employee.
    if (input.status === 'active') {
      const current = await EmployeeContractModel.findById(contractId).select('employeeId').lean();
      if (current) {
        await EmployeeContractModel.updateMany(
          { employeeId: current.employeeId, status: 'active', _id: { $ne: current._id } },
          { $set: { status: 'expired' } },
        );
      }
    }
    const updated = await employeeContractRepository.updateById(contractId, patch);
    if (!updated) throw new HttpError(404, 'Contract not found', 'EMP_006');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeContract',
      action: 'update',
      resourceId: contractId,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },
};
