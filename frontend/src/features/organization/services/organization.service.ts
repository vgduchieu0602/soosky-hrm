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

// Raw department record as returned by create/update endpoints (no tree/headcount)
export interface DepartmentRecord {
  id: string;
  _id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  managerId: string | null;
  description: string;
  status: "active" | "archived";
  createdAt: string;
}

interface DepartmentCollectionResponse {
  departments: Array<Omit<DepartmentNode, "headcount" | "children"> & { children?: DepartmentCollectionResponse["departments"] }>;
}

interface PositionResponse {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  level: number;
  description: string;
  status: "active" | "archived";
  createdAt: string;
}

function toDepartmentNode(department: DepartmentCollectionResponse["departments"][number]): DepartmentNode {
  return {
    ...department,
    headcount: 0,
    children: (department.children ?? []).map(toDepartmentNode),
  };
}

function toPosition(position: PositionResponse): Position {
  return {
    ...position,
    _id: position.id,
  };
}

async function getDepartment(id: string): Promise<DepartmentRecord> {
  const { data } = await api.get<DepartmentRecord>(`/department/departments/${id}`);
  return { ...data, _id: data.id };
}

async function getPosition(id: string): Promise<Position> {
  const { data } = await api.get<PositionResponse>(`/department/positions/${id}`);
  return toPosition(data);
}

function unavailable(capability: string): never {
  throw new Error(`${capability} is not available in the backend v1 contract`);
}

export const organizationService = {
  async departmentsTree(): Promise<DepartmentNode[]> {
    const { data } = await api.get<DepartmentCollectionResponse>("/department/departments?tree=true");
    return data.departments.map(toDepartmentNode);
  },

  async departmentsFlat(): Promise<DepartmentNode[]> {
    const { data } = await api.get<DepartmentCollectionResponse>("/department/departments");
    return data.departments.map(toDepartmentNode);
  },

  async createDepartment(input: CreateDepartmentInput): Promise<DepartmentRecord> {
    const { data } = await api.post<{ departmentId: string }>("/department/departments", input);
    return getDepartment(data.departmentId);
  },

  async updateDepartment(
    id: string,
    input: UpdateDepartmentInput,
  ): Promise<DepartmentRecord> {
    await api.patch(`/department/departments/${id}`, input);
    return getDepartment(id);
  },

  /** Hard-delete a department. Server returns 409 (ORG_DEPT_HAS_DATA) if any
   *  employee / position / sub-department still references it. */
  async deleteDepartment(id: string): Promise<{ id: string; deleted: boolean }> {
    await api.delete(`/department/departments/${id}`);
    return { id, deleted: true };
  },

  // UC-06/07 — assign or remove the department head.
  async assignHead(id: string, managerId: string | null): Promise<DepartmentRecord> {
    await api.patch(`/department/departments/${id}/head`, { managerId });
    return getDepartment(id);
  },

  // UC-08 — move a department to a new parent.
  async moveDepartment(
    id: string,
    parentDepartmentId: string | null,
  ): Promise<DepartmentRecord> {
    await api.patch(`/department/departments/${id}/parent`, { parentDepartmentId });
    return getDepartment(id);
  },

  // UC-09 — bulk-transfer employees to another department.
  async transferEmployees(
    id: string,
    input: TransferEmployeesInput,
  ): Promise<{ transferred: number }> {
    void id;
    void input;
    return unavailable("Employee transfer between departments");
  },

  // UC-10 — merge a department into a target, then archive it.
  async mergeDepartment(
    id: string,
    targetDepartmentId: string,
  ): Promise<DepartmentRecord> {
    void id;
    void targetDepartmentId;
    return unavailable("Department merge");
  },

  // UC-11 — organization-change timeline for a department.
  async departmentHistory(id: string): Promise<DepartmentHistoryEntry[]> {
    void id;
    return unavailable("Department history");
  },

  async positionsByDept(departmentId: string): Promise<Position[]> {
    const { data } = await api.get<{ positions: PositionResponse[] }>("/department/positions", { params: { departmentId } });
    return data.positions.map(toPosition);
  },

  async positions(): Promise<Position[]> {
    const { data } = await api.get<{ positions: PositionResponse[] }>("/department/positions");
    return data.positions.map(toPosition);
  },

  async createPosition(input: CreatePositionInput): Promise<Position> {
    const { data } = await api.post<{ positionId: string }>("/department/positions", input);
    return getPosition(data.positionId);
  },

  async updatePosition(id: string, input: UpdatePositionInput): Promise<Position> {
    await api.patch(`/department/positions/${id}`, input);
    return getPosition(id);
  },

  /** Archive (soft): DELETE marks the position archived, keeping it referenced. */
  async archivePosition(id: string): Promise<void> {
    await api.post(`/department/positions/${id}/archive`);
  },
};
