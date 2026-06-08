export interface DepartmentNode {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  description?: string;
  status: "active" | "archived";
  headcount: number;
  children: DepartmentNode[];
}

export interface Position {
  _id: string;
  title: string;
  code: string;
  departmentId: string;
  level: number;
  description?: string;
}

export interface CreatePositionInput {
  title: string;
  code: string;
  departmentId: string;
  level?: number;
  description?: string;
}

export interface UpdatePositionInput {
  title?: string;
  level?: number;
  description?: string;
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  parentDepartmentId?: string | null;
  description?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  parentDepartmentId?: string | null;
  description?: string;
  status?: "active" | "archived";
}
