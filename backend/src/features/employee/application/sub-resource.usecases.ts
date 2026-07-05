import { HttpError } from '@shared/errors/http-error';
import { isValidObjectId } from '@features/employee/domain/employee-rules';
import type { HistoryUseCases } from '@features/employee/application/history.usecases';
import type {
  EmployeeRepository,
  ContactRepository,
  BankAccountRepository,
  DocumentRepository,
  AssetRepository,
  ContractRepository,
  AuditPort,
  UnitOfWork,
} from '@features/employee/domain/ports';
import type {
  CreateContactDto,
  UpdateContactDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  CreateDocumentDto,
  UpdateDocumentDto,
  CreateAssetDto,
  ReturnAssetDto,
  UpdateAssetDto,
  CreateContractDto,
  UpdateContractDto,
} from '@features/employee/dto/sub-resource.dto';

export class ContactUseCases {
  constructor(
    private readonly repo: ContactRepository,
    private readonly employees: EmployeeRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(employeeId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    return this.repo.listByEmployee(employeeId);
  }

  async create(employeeId: string, input: CreateContactDto, auditUserId: string) {
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (input.isPrimary) await this.repo.clearPrimary(employeeId);
    const contact = await this.repo.create(employeeId, input as Record<string, unknown>);
    await this.audit.record({ userId: auditUserId, resource: 'employeeContact', action: 'create', resourceId: String(contact._id) });
    return contact;
  }

  async update(employeeId: string, contactId: string, input: UpdateContactDto, auditUserId: string) {
    if (input.isPrimary) await this.repo.clearPrimary(employeeId);
    const updated = await this.repo.updateById(employeeId, contactId, input as Record<string, unknown>);
    if (!updated) throw new HttpError(404, 'Contact not found', 'EMP_005');
    await this.audit.record({ userId: auditUserId, resource: 'employeeContact', action: 'update', resourceId: contactId, changes: input as Record<string, unknown> });
    return updated;
  }

  async remove(employeeId: string, contactId: string, auditUserId: string) {
    const deleted = await this.repo.deleteById(employeeId, contactId);
    if (!deleted) throw new HttpError(404, 'Contact not found', 'EMP_005');
    await this.audit.record({ userId: auditUserId, resource: 'employeeContact', action: 'delete', resourceId: contactId });
    return { id: contactId };
  }
}

export class BankAccountUseCases {
  constructor(
    private readonly repo: BankAccountRepository,
    private readonly employees: EmployeeRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(employeeId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    return this.repo.listByEmployee(employeeId);
  }

  async create(employeeId: string, input: CreateBankAccountDto, auditUserId: string) {
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (input.isPrimary) await this.repo.clearPrimary(employeeId);
    const acct = await this.repo.create(employeeId, input as Record<string, unknown>);
    await this.audit.record({ userId: auditUserId, resource: 'employeeBankAccount', action: 'create', resourceId: String(acct._id) });
    return acct;
  }

  async update(employeeId: string, accountId: string, input: UpdateBankAccountDto, auditUserId: string) {
    if (input.isPrimary) await this.repo.clearPrimary(employeeId);
    const updated = await this.repo.updateById(accountId, input as Record<string, unknown>);
    if (!updated) throw new HttpError(404, 'Bank account not found', 'EMP_005');
    await this.audit.record({ userId: auditUserId, resource: 'employeeBankAccount', action: 'update', resourceId: accountId, changes: input as Record<string, unknown> });
    return updated;
  }

  async remove(employeeId: string, accountId: string, auditUserId: string) {
    const deleted = await this.repo.deleteById(accountId);
    if (!deleted) throw new HttpError(404, 'Bank account not found', 'EMP_005');
    await this.audit.record({ userId: auditUserId, resource: 'employeeBankAccount', action: 'delete', resourceId: accountId });
    return { deleted: true };
  }
}

export class DocumentUseCases {
  constructor(
    private readonly repo: DocumentRepository,
    private readonly employees: EmployeeRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(employeeId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    return this.repo.listByEmployee(employeeId);
  }

  async create(employeeId: string, input: CreateDocumentDto, auditUserId: string) {
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');
    const doc = await this.repo.create(employeeId, input as Record<string, unknown>);
    await this.audit.record({ userId: auditUserId, resource: 'employeeDocument', action: 'create', resourceId: String(doc._id) });
    return doc;
  }

  async update(docId: string, input: UpdateDocumentDto, auditUserId: string) {
    const doc = await this.repo.updateById(docId, input as Record<string, unknown>);
    if (!doc) throw new HttpError(404, 'Document not found', 'EMP_005');
    await this.audit.record({ userId: auditUserId, resource: 'employeeDocument', action: 'update', resourceId: docId, changes: input as Record<string, unknown> });
    return doc;
  }

  async remove(docId: string, auditUserId: string) {
    const doc = await this.repo.deleteById(docId);
    if (!doc) throw new HttpError(404, 'Document not found', 'EMP_005');
    await this.audit.record({ userId: auditUserId, resource: 'employeeDocument', action: 'delete', resourceId: docId });
    return { id: docId };
  }
}

export class AssetUseCases {
  constructor(
    private readonly repo: AssetRepository,
    private readonly employees: EmployeeRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(employeeId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    return this.repo.listByEmployee(employeeId);
  }

  async create(employeeId: string, input: CreateAssetDto, auditUserId: string) {
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');
    const asset = await this.repo.create(employeeId, input as Record<string, unknown>);
    await this.audit.record({ userId: auditUserId, resource: 'employeeAsset', action: 'create', resourceId: String(asset._id) });
    return asset;
  }

  async markReturned(assetId: string, input: ReturnAssetDto, auditUserId: string) {
    const updated = await this.repo.markReturned(assetId, input as Record<string, unknown>);
    if (!updated) throw new HttpError(404, 'Asset not found', 'EMP_007');
    await this.audit.record({ userId: auditUserId, resource: 'employeeAsset', action: 'update', resourceId: assetId, changes: input as Record<string, unknown> });
    return updated;
  }

  async update(assetId: string, input: UpdateAssetDto, auditUserId: string) {
    const updated = await this.repo.updateById(assetId, input as Record<string, unknown>);
    if (!updated) throw new HttpError(404, 'Asset not found', 'EMP_007');
    await this.audit.record({ userId: auditUserId, resource: 'employeeAsset', action: 'update', resourceId: assetId, changes: input as Record<string, unknown> });
    return updated;
  }

  async remove(assetId: string, auditUserId: string) {
    const removed = await this.repo.deleteById(assetId);
    if (!removed) throw new HttpError(404, 'Asset not found', 'EMP_007');
    await this.audit.record({ userId: auditUserId, resource: 'employeeAsset', action: 'delete', resourceId: assetId });
    return { id: assetId };
  }
}

export class ContractUseCases {
  constructor(
    private readonly repo: ContractRepository,
    private readonly employees: EmployeeRepository,
    private readonly history: HistoryUseCases,
    private readonly audit: AuditPort,
    private readonly uow: UnitOfWork,
  ) {}

  async list(employeeId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    return this.repo.listByEmployee(employeeId);
  }

  async create(employeeId: string, input: CreateContractDto, auditUserId: string) {
    const emp = await this.employees.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const dup = await this.repo.findByNumber(input.contractNumber);
    if (dup) throw new HttpError(409, 'Contract number already exists', 'EMP_006');

    const created = await this.uow.withTransaction(async (tx) => {
      await this.repo.expireActive(employeeId, tx);
      const contract = await this.repo.create(employeeId, input as Record<string, unknown>, tx);
      await this.history.record({
        employeeId,
        eventType: 'contract_renew',
        toValue: { contractNumber: input.contractNumber, contractType: input.contractType },
        createdBy: auditUserId,
        effectiveDate: input.startDate,
      });
      return contract;
    });

    await this.audit.record({ userId: auditUserId, resource: 'employeeContract', action: 'create', resourceId: String(created._id) });
    return created;
  }

  async update(contractId: string, input: UpdateContractDto, auditUserId: string) {
    if (input.status === 'active') {
      const empId = await this.repo.employeeIdOf(contractId);
      if (empId) await this.repo.expireActiveExcept(empId, contractId);
    }
    const updated = await this.repo.updateById(contractId, input as Record<string, unknown>);
    if (!updated) throw new HttpError(404, 'Contract not found', 'EMP_006');
    await this.audit.record({ userId: auditUserId, resource: 'employeeContract', action: 'update', resourceId: contractId, changes: input as Record<string, unknown> });
    return updated;
  }
}
