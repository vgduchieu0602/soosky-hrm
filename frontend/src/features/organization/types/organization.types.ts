export interface DepartmentHead {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface DepartmentNode {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  managerId?: string | null;
  head?: DepartmentHead | null;
  costCenter?: string;
  location?: string;
  email?: string;
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
  managerId?: string | null;
  costCenter?: string;
  location?: string;
  email?: string;
  description?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  parentDepartmentId?: string | null;
  managerId?: string | null;
  costCenter?: string;
  location?: string;
  email?: string;
  description?: string;
  status?: "active" | "archived";
}

/** UC-09 — bulk-transfer employees. Omit employeeIds to move everyone. */
export interface TransferEmployeesInput {
  targetDepartmentId: string;
  employeeIds?: string[];
}

/** A department change-log entry (audit log row, manager populated). */
export interface DepartmentHistoryEntry {
  _id: string;
  action: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  timestamp: string;
  userId?: { username?: string; email?: string } | null;
}
