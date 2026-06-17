export type UserStatus = "active" | "disabled" | "locked";

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  status: UserStatus;
  employeeId?: string | null;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  created_at?: string;
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissionIds?: string[];
}

export interface Permission {
  _id: string;
  key: string;
  resource: string;
  action: string;
  description?: string;
}

export interface AuditLogEntry {
  _id: string;
  userId?: { _id: string; username: string; email: string } | string | null;
  resource: string;
  action: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  timestamp: string;
}
