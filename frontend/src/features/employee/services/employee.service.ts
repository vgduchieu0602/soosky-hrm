import api from "@core/http/axios";
import type {
  AccountView,
  CreateEmployeeInput,
  EmployeeAssetRecord,
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

interface ApiEnvelope<T> {
  data: T;
  message?: string;
  meta?: ListMeta;
}

function buildQuery(params: ListEmployeesParams): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.status) sp.set("status", params.status);
  if (params.employeeType) sp.set("employeeType", params.employeeType);
  if (params.q) sp.set("q", params.q);
  if (params.sort) sp.set("sort", params.sort);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const employeeService = {
  async list(
    params: ListEmployeesParams = {},
  ): Promise<{ items: EmployeeRecord[]; meta: ListMeta }> {
    const { data } = await api.get<ApiEnvelope<EmployeeRecord[]>>(
      `/employees${buildQuery(params)}`,
    );
    return {
      items: data.data ?? [],
      meta: data.meta ?? { page: 1, limit: params.limit ?? 20, total: 0, totalPages: 1 },
    };
  },

  async stats(): Promise<EmployeeStats> {
    const { data } = await api.get<ApiEnvelope<EmployeeStats>>("/employees/stats");
    return data.data;
  },

  async reminders(withinDays = 30): Promise<ExpiryReminders> {
    const { data } = await api.get<ApiEnvelope<ExpiryReminders>>(
      `/employees/reminders?withinDays=${withinDays}`,
    );
    return data.data ?? { probation: [], contract: [] };
  },

  async getById(id: string): Promise<EmployeeRecord> {
    const { data } = await api.get<ApiEnvelope<EmployeeRecord>>(`/employees/${id}`);
    return data.data;
  },

  async importEmployees(rows: ImportEmployeeRow[]): Promise<ImportResult> {
    const { data } = await api.post<ApiEnvelope<ImportResult>>("/admin/employees/import", { rows });
    return data.data;
  },

  async create(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    const { data } = await api.post<ApiEnvelope<EmployeeRecord>>(
      "/admin/employees",
      input,
    );
    return data.data;
  },

  async updateStatus(id: string, status: string): Promise<EmployeeRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeRecord>>(
      `/admin/employees/${id}`,
      { status },
    );
    return data.data;
  },

  // Update core work info (department, position, manager, type, status, salary zone).
  async update(id: string, input: UpdateWorkInput): Promise<EmployeeRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeRecord>>(
      `/admin/employees/${id}`,
      input,
    );
    return data.data;
  },

  // Update PII profile fields.
  async updateProfile(id: string, input: UpdateProfileInput): Promise<EmployeeProfile> {
    const { data } = await api.patch<ApiEnvelope<EmployeeProfile>>(
      `/employees/${id}/profile`,
      input,
    );
    return data.data;
  },

  async terminate(id: string, input: TerminateInput = {}): Promise<EmployeeRecord> {
    const { data } = await api.post<ApiEnvelope<EmployeeRecord>>(
      `/admin/employees/${id}/terminate`,
      input,
    );
    return data.data;
  },

  async terminateMany(
    employeeIds: string[],
    input: TerminateInput = {},
  ): Promise<{ terminated: number; skipped: { id: string; reason: string }[] }> {
    const { data } = await api.post<ApiEnvelope<{ terminated: number; skipped: { id: string; reason: string }[] }>>(
      `/admin/employees/bulk/terminate`,
      { employeeIds, ...input },
    );
    return data.data;
  },

  // Hard delete (cascade) — admin & HR only.
  async remove(id: string): Promise<void> {
    await api.delete(`/admin/employees/${id}`);
  },

  async grantLogin(id: string, input: GrantLoginInput): Promise<GrantLoginResult> {
    const { data } = await api.post<ApiEnvelope<GrantLoginResult>>(
      `/admin/employees/${id}/grant-login`,
      input,
    );
    return data.data;
  },

  // ---- sub-resources (read) ----
  async contacts(id: string): Promise<EmployeeContactRecord[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeContactRecord[]>>(
      `/employees/${id}/contacts`,
    );
    return data.data ?? [];
  },

  async documents(id: string): Promise<EmployeeDocumentRecord[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeDocumentRecord[]>>(
      `/employees/${id}/documents`,
    );
    return data.data ?? [];
  },

  async contracts(id: string): Promise<EmployeeContractRecord[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeContractRecord[]>>(
      `/employees/${id}/contracts`,
    );
    return data.data ?? [];
  },

  async assets(id: string): Promise<EmployeeAssetRecord[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeAssetRecord[]>>(
      `/employees/${id}/assets`,
    );
    return data.data ?? [];
  },

  async history(id: string): Promise<EmployeeHistoryRecord[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeHistoryRecord[]>>(
      `/employees/${id}/history`,
    );
    return data.data ?? [];
  },

  // ---- sub-resources (create) ----
  async addContact(id: string, input: NewContactInput): Promise<EmployeeContactRecord> {
    const { data } = await api.post<ApiEnvelope<EmployeeContactRecord>>(
      `/employees/${id}/contacts`,
      input,
    );
    return data.data;
  },

  async addDocument(id: string, input: NewDocumentInput): Promise<EmployeeDocumentRecord> {
    const { data } = await api.post<ApiEnvelope<EmployeeDocumentRecord>>(
      `/employees/${id}/documents`,
      input,
    );
    return data.data;
  },

  async addContract(id: string, input: NewContractInput): Promise<EmployeeContractRecord> {
    const { data } = await api.post<ApiEnvelope<EmployeeContractRecord>>(
      `/admin/employees/${id}/contracts`,
      input,
    );
    return data.data;
  },

  async addAsset(id: string, input: NewAssetInput): Promise<EmployeeAssetRecord> {
    const { data } = await api.post<ApiEnvelope<EmployeeAssetRecord>>(
      `/admin/employees/${id}/assets`,
      input,
    );
    return data.data;
  },

  // ---- sub-resources (edit / delete / return) ----
  async updateContact(
    id: string,
    contactId: string,
    input: Partial<NewContactInput>,
  ): Promise<EmployeeContactRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeContactRecord>>(
      `/employees/${id}/contacts/${contactId}`,
      input,
    );
    return data.data;
  },

  async deleteContact(id: string, contactId: string): Promise<void> {
    await api.delete(`/employees/${id}/contacts/${contactId}`);
  },

  async updateDocument(
    id: string,
    docId: string,
    input: Partial<NewDocumentInput>,
  ): Promise<EmployeeDocumentRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeDocumentRecord>>(
      `/admin/employees/${id}/documents/${docId}`,
      input,
    );
    return data.data;
  },

  async deleteDocument(id: string, docId: string): Promise<void> {
    await api.delete(`/admin/employees/${id}/documents/${docId}`);
  },

  async updateContract(
    id: string,
    contractId: string,
    input: Partial<NewContractInput>,
  ): Promise<EmployeeContractRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeContractRecord>>(
      `/admin/employees/${id}/contracts/${contractId}`,
      input,
    );
    return data.data;
  },

  async returnAsset(
    id: string,
    assetId: string,
    input: ReturnAssetInput = {},
  ): Promise<EmployeeAssetRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeAssetRecord>>(
      `/admin/employees/${id}/assets/${assetId}/return`,
      input,
    );
    return data.data;
  },

  async updateAsset(
    id: string,
    assetId: string,
    input: UpdateAssetInput,
  ): Promise<EmployeeAssetRecord> {
    const { data } = await api.patch<ApiEnvelope<EmployeeAssetRecord>>(
      `/admin/employees/${id}/assets/${assetId}`,
      input,
    );
    return data.data;
  },

  async deleteAsset(id: string, assetId: string): Promise<void> {
    await api.delete(`/admin/employees/${id}/assets/${assetId}`);
  },

  // ---- account (linked user) ----
  async account(id: string): Promise<AccountView> {
    const { data } = await api.get<ApiEnvelope<AccountView>>(`/employees/${id}/account`);
    return data.data;
  },

  async resetPassword(id: string): Promise<{ linkSentTo: string }> {
    const { data } = await api.post<ApiEnvelope<{ linkSentTo: string }>>(
      `/admin/employees/${id}/reset-password`,
    );
    return data.data;
  },

  async resendInvite(id: string): Promise<{ linkSentTo: string }> {
    const { data } = await api.post<ApiEnvelope<{ linkSentTo: string }>>(
      `/admin/employees/${id}/resend-invite`,
    );
    return data.data;
  },

  async updateAccount(id: string, input: UpdateAccountInput): Promise<AccountView> {
    const { data } = await api.patch<ApiEnvelope<AccountView>>(
      `/admin/employees/${id}/account`,
      input,
    );
    return data.data;
  },

  // ---- export ----
  async exportCsv(params: ListEmployeesParams = {}): Promise<Blob> {
    const res = await api.get(`/employees/export${buildQuery(params)}`, { responseType: "blob" });
    return res.data as Blob;
  },
};
