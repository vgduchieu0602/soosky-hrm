import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { employeeContactRepository } from '@features/employee/repositories/employee-contact.repository';
import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateContactDto,
  UpdateContactDto,
} from '@features/employee/dto/sub-resource.dto';

export const employeeContactService = {
  async list(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    return employeeContactRepository.listByEmployee(employeeId);
  },

  async create(employeeId: string, input: CreateContactDto, auditUserId: string) {
    const emp = await employeeRepository.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.isPrimary) {
      await employeeContactRepository.clearPrimary(employeeId);
    }
    const contact = await employeeContactRepository.create({
      ...input,
      employeeId: new Types.ObjectId(employeeId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeContact',
      action: 'create',
      resourceId: contact._id.toString(),
    });
    return contact.toJSON();
  },

  async update(employeeId: string, contactId: string, input: UpdateContactDto, auditUserId: string) {
    if (input.isPrimary) {
      await employeeContactRepository.clearPrimary(employeeId);
    }
    const updated = await employeeContactRepository.updateById(contactId, input);
    if (!updated) throw new HttpError(404, 'Contact not found', 'EMP_005');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeContact',
      action: 'update',
      resourceId: contactId,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },

  async remove(contactId: string, auditUserId: string) {
    const deleted = await employeeContactRepository.deleteById(contactId);
    if (!deleted) throw new HttpError(404, 'Contact not found', 'EMP_005');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeContact',
      action: 'delete',
      resourceId: contactId,
    });
    return { id: contactId };
  },
};
