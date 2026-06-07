import api from "@core/http/axios";
import type {
  CreateDepartmentInput,
  DepartmentNode,
  Position,
  UpdateDepartmentInput,
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
};
