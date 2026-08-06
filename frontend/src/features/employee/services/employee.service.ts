import api from "@core/http/axios";
import type {
  AccountView,
  CreateEmployeeInput,
  EmployeeAssetRecord,
  EmployeeBankAccountRecord,
  NewBankAccountInput,
  EmployeeContactRecord,
  EmployeeContractRecord,
  EmployeeDocumentRecord,
  EmployeeHistoryRecord,
  EmployeeProfile,
  EmployeeRecord,
  EmployeeStats,
  ExpiryReminders,
  ImportEmployeeRow,
  ImportResult,
  GrantLoginInput,
  GrantLoginResult,
  ProfileCompleteness,
  ListEmployeesParams,
  ListMeta,
  NewAssetInput,
  NewContactInput,
  NewContractInput,
  NewDocumentInput,
  ReturnAssetInput,
  TerminateInput,
  UpdateAccountInput,
  UpdateAssetInput,
  UpdateProfileInput,
  UpdateWorkInput,
} from "@features/employee/types/employee.types";

interface EmployeeDto {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  departmentId: string;
  positionId: string;
  managerId: string | null;
  hireDate: string;
  terminationDate: string | null;
  employeeType: string;
  status: string;
  accountId: string | null;
  createdAt: string;
}

interface EmployeeProfileDto {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  dateOfBirth: string | null;
  gender: EmployeeProfile["gender"] | null;
  nationality: string | null;
  maritalStatus: EmployeeProfile["maritalStatus"] | null;
  avatarUrl: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  phone: string | null;
  address: string | null;
  socialInsuranceNo: string | null;
  taxCode: string | null;
  vehiclePlate: string | null;
}

function toEmployeeRecord(employee: EmployeeDto): EmployeeRecord {
  return {
    _id: employee.id,
    employeeCode: employee.code,
    departmentId: employee.departmentId,
    positionId: employee.positionId,
    managerId: employee.managerId,
    hireDate: employee.hireDate,
    terminationDate: employee.terminationDate,
    employeeType: employee.employeeType as EmployeeRecord["employeeType"],
    status: employee.status as EmployeeRecord["status"],
    userId: employee.accountId,
    profile: null,
    created_at: employee.createdAt,
  };
}

function toEmployeeProfile(profile: EmployeeProfileDto): EmployeeProfile {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleName: profile.middleName ?? undefined,
    dateOfBirth: profile.dateOfBirth ?? undefined,
    gender: profile.gender ?? undefined,
    nationality: profile.nationality ?? undefined,
    maritalStatus: profile.maritalStatus ?? undefined,
    avatarUrl: profile.avatarUrl ?? undefined,
    email: profile.personalEmail ?? undefined,
    workEmail: profile.workEmail ?? undefined,
    phone: profile.phone ?? undefined,
    address: profile.address ?? undefined,
    socialInsuranceNo: profile.socialInsuranceNo ?? undefined,
    taxCode: profile.taxCode ?? undefined,
    vehiclePlate: profile.vehiclePlate ?? undefined,
  };
}

function toCreatePayload(input: CreateEmployeeInput) {
  const profile = input.profile;
  return {
    code: input.employeeCode,
    name: [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" "),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.phone ? { phone: profile.phone } : {}),
    ...(profile.dateOfBirth ? { dob: profile.dateOfBirth } : {}),
    ...(profile.gender ? { gender: profile.gender } : {}),
    departmentId: input.departmentId,
    positionId: input.positionId,
    ...(input.managerId ? { managerId: input.managerId } : {}),
    hireDate: input.hireDate,
    employeeType: input.employeeType,
  };
}

function withLegacyId<T extends { id: string }>(value: T): T & { _id: string } {
  return { ...value, _id: value.id };
}

function findResource<T extends { _id: string }>(items: T[], id: string, resource: string): T {
  const item = items.find((candidate) => candidate._id === id);
  if (!item) throw new Error(`${resource} ${id} was not returned by the backend`);
  return item;
}

function unavailable(capability: string): never {
  throw new Error(`${capability} is not available in backend v1 contract`);
}

export const employeeService = {
  async list(
    params: ListEmployeesParams = {},
  ): Promise<{ items: EmployeeRecord[]; meta: ListMeta }> {
    const query = {
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const { data } = await api.get<{ employees: EmployeeDto[] }>("/employee/employees", { params: query });
    return {
      items: data.employees.map(toEmployeeRecord),
      meta: { page: 1, limit: params.limit ?? data.employees.length, total: data.employees.length, totalPages: 1 },
    };
  },

  async stats(): Promise<EmployeeStats> {
    return unavailable("Employee statistics");
  },

  async reminders(_withinDays = 30): Promise<ExpiryReminders> {
    return unavailable("Employee reminders");
  },

  async getById(id: string): Promise<EmployeeRecord> {
    const { data } = await api.get<EmployeeDto>(`/employee/employees/${id}`);
    return toEmployeeRecord(data);
  },

  async completeness(_id: string): Promise<ProfileCompleteness> {
    return unavailable("Employee profile completeness");
  },

  async importEmployees(_rows: ImportEmployeeRow[]): Promise<ImportResult> {
    return unavailable("Employee import");
  },

  async create(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    const { data: created } = await api.post<{ employeeId: string }>("/employee/employees", toCreatePayload(input));
    return this.getById(created.employeeId);
  },

  async updateStatus(_id: string, _status: string): Promise<EmployeeRecord> {
    return unavailable("Direct employee status updates");
  },

  // Update core work info (department, position, manager, type, status, salary zone).
  async update(id: string, input: UpdateWorkInput): Promise<EmployeeRecord> {
    await api.patch(`/employee/employees/${id}`, {
      ...(input.employeeCode ? { code: input.employeeCode } : {}),
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.positionId ? { positionId: input.positionId } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
      ...(input.employeeType ? { employeeType: input.employeeType } : {}),
    });
    return this.getById(id);
  },

  // Update PII profile fields.
  async updateProfile(id: string, input: UpdateProfileInput): Promise<EmployeeProfile> {
    await api.put(`/employee/employees/${id}/profile`, {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.middleName !== undefined ? { middleName: input.middleName } : {}),
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality } : {}),
      ...(input.maritalStatus !== undefined ? { maritalStatus: input.maritalStatus } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.email !== undefined ? { personalEmail: input.email } : {}),
      ...(input.workEmail !== undefined ? { workEmail: input.workEmail } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.socialInsuranceNo !== undefined ? { socialInsuranceNo: input.socialInsuranceNo } : {}),
      ...(input.taxCode !== undefined ? { taxCode: input.taxCode } : {}),
      ...(input.vehiclePlate !== undefined ? { vehiclePlate: input.vehiclePlate } : {}),
    });
    const { data } = await api.get<EmployeeProfileDto>(`/employee/employees/${id}/profile`);
    return toEmployeeProfile(data);
  },

  async terminate(id: string, input: TerminateInput = {}): Promise<EmployeeRecord> {
    if (!input.terminationDate) throw new Error("terminationDate is required by the backend contract");
    await api.post(`/employee/employees/${id}/terminate`, {
      terminationDate: input.terminationDate,
      ...(input.reason !== undefined ? { note: input.reason } : {}),
    });
    return this.getById(id);
  },

  async terminateMany(
    _employeeIds: string[],
    _input: TerminateInput = {},
  ): Promise<{ terminated: number; skipped: { id: string; reason: string }[] }> {
    return unavailable("Bulk employee termination");
  },

  // Hard delete (cascade) — admin & HR only.
  async remove(_id: string): Promise<void> {
    return unavailable("Employee deletion");
  },

  async grantLogin(_id: string, _input: GrantLoginInput): Promise<GrantLoginResult> {
    return unavailable("Employee account provisioning");
  },

  // ---- sub-resources (read) ----
  async contacts(id: string): Promise<EmployeeContactRecord[]> {
    const { data } = await api.get<{ contacts: Array<EmployeeContactRecord & { id: string }> }>(`/employee/employees/${id}/contacts`);
    return data.contacts.map(withLegacyId);
  },

  async bankAccounts(id: string): Promise<EmployeeBankAccountRecord[]> {
    const { data } = await api.get<{ bankAccounts: Array<EmployeeBankAccountRecord & { id: string }> }>(`/employee/employees/${id}/bank-accounts`);
    return data.bankAccounts.map(withLegacyId);
  },
  async addBankAccount(id: string, input: NewBankAccountInput): Promise<EmployeeBankAccountRecord> {
    const payload = {
      bankName: input.bankName,
      ...(input.branch !== undefined ? { branch: input.branch } : {}),
      accountNumber: input.accountNumber,
      accountHolder: input.accountHolder,
    };
    const { data: created } = await api.post<{ bankAccountId: string }>(
      `/employee/employees/${id}/bank-accounts`,
      payload,
    );
    return findResource(await this.bankAccounts(id), created.bankAccountId, "Bank account");
  },
  async updateBankAccount(id: string, accountId: string, input: Partial<NewBankAccountInput>): Promise<EmployeeBankAccountRecord> {
    const payload = {
      ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
      ...(input.branch !== undefined ? { branch: input.branch } : {}),
      ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
      ...(input.accountHolder !== undefined ? { accountHolder: input.accountHolder } : {}),
    };
    await api.patch(`/employee/bank-accounts/${accountId}`, payload);
    return findResource(await this.bankAccounts(id), accountId, "Bank account");
  },
  async deleteBankAccount(_id: string, accountId: string): Promise<void> {
    await api.delete(`/employee/bank-accounts/${accountId}`);
  },

  async documents(id: string): Promise<EmployeeDocumentRecord[]> {
    const { data } = await api.get<{ documents: Array<EmployeeDocumentRecord & { id: string }> }>(`/employee/employees/${id}/documents`);
    return data.documents.map(withLegacyId);
  },

  async contracts(id: string): Promise<EmployeeContractRecord[]> {
    const { data } = await api.get<{ contracts: Array<EmployeeContractRecord & { id: string }> }>(`/employee/employees/${id}/contracts`);
    return data.contracts.map(withLegacyId);
  },

  async assets(id: string): Promise<EmployeeAssetRecord[]> {
    const { data } = await api.get<{ assets: Array<EmployeeAssetRecord & { id: string }> }>(`/employee/employees/${id}/assets`);
    return data.assets.map(withLegacyId);
  },

  async history(id: string): Promise<EmployeeHistoryRecord[]> {
    const { data } = await api.get<{ history: Array<EmployeeHistoryRecord & { id: string }> }>(`/employee/employees/${id}/history`);
    return data.history.map(withLegacyId);
  },

  // ---- sub-resources (create) ----
  async addContact(id: string, input: NewContactInput): Promise<EmployeeContactRecord> {
    const payload = {
      name: input.name,
      relationship: input.relationship,
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    };
    const { data: created } = await api.post<{ contactId: string }>(
      `/employee/employees/${id}/contacts`,
      payload,
    );
    return findResource(await this.contacts(id), created.contactId, "Contact");
  },

  async addDocument(id: string, input: NewDocumentInput): Promise<EmployeeDocumentRecord> {
    const { data: created } = await api.post<{ documentId: string }>(
      `/employee/employees/${id}/documents`,
      input,
    );
    return findResource(await this.documents(id), created.documentId, "Document");
  },

  async addContract(id: string, input: NewContractInput): Promise<EmployeeContractRecord> {
    const { data: created } = await api.post<{ contractId: string }>(
      `/employee/employees/${id}/contracts`,
      input,
    );
    return findResource(await this.contracts(id), created.contractId, "Contract");
  },

  async addAsset(id: string, input: NewAssetInput): Promise<EmployeeAssetRecord> {
    const { data: created } = await api.post<{ assetId: string }>(
      `/employee/employees/${id}/assets`,
      input,
    );
    return findResource(await this.assets(id), created.assetId, "Asset");
  },

  // ---- sub-resources (edit / delete / return) ----
  async updateContact(
    id: string,
    contactId: string,
    input: Partial<NewContactInput>,
  ): Promise<EmployeeContactRecord> {
    const payload = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.relationship !== undefined ? { relationship: input.relationship } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    };
    await api.patch(`/employee/contacts/${contactId}`, payload);
    return findResource(await this.contacts(id), contactId, "Contact");
  },

  async deleteContact(_id: string, contactId: string): Promise<void> {
    await api.delete(`/employee/contacts/${contactId}`);
  },

  async updateDocument(
    id: string,
    docId: string,
    input: Partial<NewDocumentInput>,
  ): Promise<EmployeeDocumentRecord> {
    await api.patch(`/employee/documents/${docId}`, input);
    return findResource(await this.documents(id), docId, "Document");
  },

  async deleteDocument(_id: string, docId: string): Promise<void> {
    await api.delete(`/employee/documents/${docId}`);
  },

  async updateContract(
    id: string,
    contractId: string,
    input: Partial<NewContractInput>,
  ): Promise<EmployeeContractRecord> {
    const { employmentStatus, endDate, baseSalary, fileUrl, status } = input;
    await api.patch(`/employee/contracts/${contractId}`, {
      ...(employmentStatus !== undefined ? { employmentStatus } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
      ...(baseSalary !== undefined ? { baseSalary } : {}),
      ...(fileUrl !== undefined ? { fileUrl } : {}),
      ...(status !== undefined ? { status } : {}),
    });
    return findResource(await this.contracts(id), contractId, "Contract");
  },

  async deleteContract(_id: string, contractId: string): Promise<void> {
    await api.delete(`/employee/contracts/${contractId}`);
  },

  async returnAsset(
    id: string,
    assetId: string,
    input: ReturnAssetInput = {},
  ): Promise<EmployeeAssetRecord> {
    await api.patch(`/employee/assets/${assetId}`, input);
    return findResource(await this.assets(id), assetId, "Asset");
  },

  async updateAsset(
    id: string,
    assetId: string,
    input: UpdateAssetInput,
  ): Promise<EmployeeAssetRecord> {
    const { returnedDate, condition, note } = input;
    await api.patch(`/employee/assets/${assetId}`, {
      ...(returnedDate !== undefined ? { returnedDate } : {}),
      ...(condition !== undefined ? { condition } : {}),
      ...(note !== undefined ? { note } : {}),
    });
    return findResource(await this.assets(id), assetId, "Asset");
  },

  async deleteAsset(_id: string, assetId: string): Promise<void> {
    await api.delete(`/employee/assets/${assetId}`);
  },

  // ---- account (linked user) ----
  async account(_id: string): Promise<AccountView> {
    return unavailable("Linked employee accounts");
  },

  async resetPassword(_id: string): Promise<{ linkSentTo: string }> {
    return unavailable("Employee password reset");
  },

  async resendInvite(_id: string): Promise<{ linkSentTo: string }> {
    return unavailable("Employee invitation resend");
  },

  async updateAccount(_id: string, _input: UpdateAccountInput): Promise<AccountView> {
    return unavailable("Linked employee account updates");
  },

  // ---- export ----
  async exportCsv(_params: ListEmployeesParams = {}): Promise<Blob> {
    return unavailable("Employee export");
  },
};
