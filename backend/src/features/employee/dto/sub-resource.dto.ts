import { z } from 'zod';
import { DOCUMENT_TYPE } from '@shared/models/employee-document.model';
import { RELATIONSHIP } from '@shared/models/employee-contact.model';
import { CONTRACT_TYPE, CONTRACT_STATUS } from '@shared/models/employee-contract.model';
import { ASSET_CONDITION } from '@shared/models/employee-asset.model';

export const createDocumentDto = z
  .object({
    documentType: z.enum(DOCUMENT_TYPE),
    documentNumber: z.string().min(1).max(80).trim(),
    fileUrl: z.string().url().optional(),
    issuedDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    issuedBy: z.string().max(120).optional(),
  })
  .strict();
export type CreateDocumentDto = z.infer<typeof createDocumentDto>;

export const createContactDto = z
  .object({
    name: z.string().min(1).max(120).trim(),
    relationship: z.enum(RELATIONSHIP),
    phone: z.string().min(6).max(40).optional(),
    email: z.string().email().optional(),
    address: z.string().max(255).optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();
export type CreateContactDto = z.infer<typeof createContactDto>;

export const updateContactDto = createContactDto.partial();
export type UpdateContactDto = z.infer<typeof updateContactDto>;

export const createBankAccountDto = z
  .object({
    bankName: z.string().min(1).max(120).trim(),
    branch: z.string().max(120).optional(),
    accountNumber: z.string().min(4).max(40).trim(),
    accountHolder: z.string().min(1).max(120).trim(),
    isPrimary: z.boolean().default(false),
  })
  .strict();
export type CreateBankAccountDto = z.infer<typeof createBankAccountDto>;

export const updateBankAccountDto = createBankAccountDto.partial();
export type UpdateBankAccountDto = z.infer<typeof updateBankAccountDto>;

export const createContractDto = z
  .object({
    contractType: z.enum(CONTRACT_TYPE),
    contractNumber: z.string().min(1).max(80).trim(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    baseSalary: z.coerce.number().nonnegative(),
    currency: z.string().min(3).max(3).default('VND'),
    fileUrl: z.string().url().optional(),
    status: z.enum(CONTRACT_STATUS).default('active'),
  })
  .strict();
export type CreateContractDto = z.infer<typeof createContractDto>;

export const updateContractDto = createContractDto.partial();
export type UpdateContractDto = z.infer<typeof updateContractDto>;

export const createAssetDto = z
  .object({
    assetName: z.string().min(1).max(120).trim(),
    assetCode: z.string().min(1).max(60).trim(),
    assignedDate: z.coerce.date(),
    condition: z.enum(ASSET_CONDITION).default('good'),
    note: z.string().max(255).optional(),
  })
  .strict();
export type CreateAssetDto = z.infer<typeof createAssetDto>;

export const returnAssetDto = z
  .object({
    returnedDate: z.coerce.date().default(() => new Date()),
    condition: z.enum(ASSET_CONDITION).optional(),
    note: z.string().max(255).optional(),
  })
  .strict();
export type ReturnAssetDto = z.infer<typeof returnAssetDto>;

export const terminateEmployeeDto = z
  .object({
    terminationDate: z.coerce.date().default(() => new Date()),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type TerminateEmployeeDto = z.infer<typeof terminateEmployeeDto>;
