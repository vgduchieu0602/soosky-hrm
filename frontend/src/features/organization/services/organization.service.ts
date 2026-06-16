import api from "@core/http/axios";
import type {
  CreateDepartmentInput,
  CreatePositionInput,
  DepartmentHistoryEntry,
  DepartmentNode,
  Position,
  TransferEmployeesInput,
  UpdateDepartmentInput,
  UpdatePositionInput,
} from "@features/organization/types/organization.types";

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

// Raw department record as returned by create/update endpoints (no tree/headcount)
export interface DepartmentRecord {
  _id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  description?: string;
  status: "active" | "archived";
}

export const organizationService = {
  async departmentsTree(): Promise<DepartmentNode[]> {
    const { data } = await api.get<ApiEnvelope<DepartmentNode[]>>(
      "/departments?tree=true",
    );
    return data.data;
  },

  async departmentsFlat(): Promise<DepartmentNode[]> {
    const { data } = await api.get<ApiEnvelope<DepartmentNode[]>>("/departments");
    return data.data;
  },

  async createDepartment(input: CreateDepartmentInput): Promise<DepartmentRecord> {
    const { data } = await api.post<ApiEnvelope<DepartmentRecord>>(
      "/admin/departments",
      input,
    );
    return data.data;
  },

  async updateDepartment(
    id: string,
    input: UpdateDepartmentInput,
  ): Promise<DepartmentRecord> {
    const { data } = await api.patch<ApiEnvelope<DepartmentRecord>>(
      `/admin/departments/${id}`,
      input,
    );
    return data.data;
  },

  async archiveDepartment(id: string): Promise<DepartmentRecord> {
    const { data } = await api.delete<ApiEnvelope<DepartmentRecord>>(
      `/admin/departments/${id}`,
    );
    return data.data;
  },

  // UC-06/07 — assign or remove the department head.
  async assignHead(id: string, managerId: string | null): Promise<DepartmentRecord> {
    const { data } = await api.patch<ApiEnvelope<DepartmentRecord>>(
      `/admin/departments/${id}/head`,
      { managerId },
    );
    return data.data;
  },

  // UC-08 — move a department to a new parent.
  async moveDepartment(
    id: string,
    parentDepartmentId: string | null,
  ): Promise<DepartmentRecord> {
    const { data } = await api.patch<ApiEnvelope<DepartmentRecord>>(
      `/admin/departments/${id}/move`,
      { parentDepartmentId },
    );
    return data.data;
  },

  // UC-09 — bulk-transfer employees to another department.
  async transferEmployees(
    id: string,
    input: TransferEmployeesInput,
  ): Promise<{ transferred: number }> {
    const { data } = await api.post<ApiEnvelope<{ transferred: number }>>(
      `/admin/departments/${id}/transfer-employees`,
      input,
    );
    return data.data;
  },

  // UC-10 — merge a department into a target, then archive it.
  async mergeDepartment(
    id: string,
    targetDepartmentId: string,
  ): Promise<DepartmentRecord> {
    const { data } = await api.post<ApiEnvelope<DepartmentRecord>>(
      `/admin/departments/${id}/merge`,
      { targetDepartmentId },
    );
    return data.data;
  },

  // UC-11 — organization-change timeline for a department.
  async departmentHistory(id: string): Promise<DepartmentHistoryEntry[]> {
    const { data } = await api.get<ApiEnvelope<DepartmentHistoryEntry[]>>(
      `/departments/${id}/history`,
    );
    return data.data;
  },

  async positionsByDept(departmentId: string): Promise<Position[]> {
    const { data } = await api.get<ApiEnvelope<Position[]>>(
      `/positions?departmentId=${departmentId}`,
    );
    return data.data;
  },

  async positions(): Promise<Position[]> {
    const { data } = await api.get<ApiEnvelope<Position[]>>("/positions");
    return data.data;
  },

  async createPosition(input: CreatePositionInput): Promise<Position> {
    const { data } = await api.post<ApiEnvelope<Position>>("/admin/positions", input);
    return data.data;
  },

  async updatePosition(id: string, input: UpdatePositionInput): Promise<Position> {
    const { data } = await api.patch<ApiEnvelope<Position>>(`/admin/positions/${id}`, input);
    return data.data;
  },

  async deletePosition(id: string): Promise<void> {
    await api.delete(`/admin/positions/${id}`);
  },
};
