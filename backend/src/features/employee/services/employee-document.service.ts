import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { employeeDocumentRepository } from '@features/employee/repositories/employee-document.repository';
import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { auditService } from '@features/iam/services/audit.service';
import type { CreateDocumentDto } from '@features/employee/dto/sub-resource.dto';

export const employeeDocumentService = {
  async list(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    return employeeDocumentRepository.listByEmployee(employeeId);
  },

  async create(employeeId: string, input: CreateDocumentDto, auditUserId: string) {
    const emp = await employeeRepository.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const doc = await employeeDocumentRepository.create({
      ...input,
      employeeId: new Types.ObjectId(employeeId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeDocument',
      action: 'create',
      resourceId: doc._id.toString(),
    });
    return doc.toJSON();
  },

  async remove(docId: string, auditUserId: string) {
    const doc = await employeeDocumentRepository.deleteById(docId);
    if (!doc) throw new HttpError(404, 'Document not found', 'EMP_005');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeDocument',
      action: 'delete',
      resourceId: docId,
    });
    return { id: docId };
  },
};
