export type UserStatus = "active" | "disabled" | "locked";

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  status: UserStatus;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
  created_at?: string;
}

export interface Role {
  _id: string;
  /** Mã bất biến của role (`admin`/`hr`/`manager`/`employee`, ...). */
  key: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  /** Chỉ có khi đọc chi tiết role — danh sách role KHÔNG nhúng quyền. */
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
  /** Id người thực hiện; `null` = do hệ thống (job/event handler). */
  userId?: string | null;
  resource: string;
  action: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  timestamp: string;
}
