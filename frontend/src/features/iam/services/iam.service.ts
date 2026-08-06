import api from "@core/http/axios";
import type {
  AdminUser,
  AuditLogEntry,
  Permission,
  Role,
  UserStatus,
} from "@features/iam/types/iam.types";

interface UserDto {
  id: string;
  displayName: string;
  email: string;
  status: string;
  createdAt: string;
}

interface RoleDto {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: string;
}

interface PermissionDto {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string;
  createdAt: string;
}

interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  resource: string;
  action: string;
  resourceId: string | null;
  changes: Record<string, unknown> | null;
  occurredAt: string;
}

function toAdminUser(user: UserDto): AdminUser {
  return {
    _id: user.id,
    username: user.displayName,
    email: user.email,
    status: user.status as UserStatus,
    created_at: user.createdAt,
  };
}

function toRole(role: RoleDto): Role {
  return {
    _id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
  };
}

function toPermission(permission: PermissionDto): Permission {
  return {
    _id: permission.id,
    key: permission.key,
    resource: permission.resource,
    action: permission.action,
    description: permission.description,
  };
}

function toAuditLog(entry: AuditLogDto): AuditLogEntry {
  return {
    _id: entry.id,
    userId: entry.actorUserId,
    resource: entry.resource,
    action: entry.action,
    ...(entry.resourceId != null ? { resourceId: entry.resourceId } : {}),
    ...(entry.changes != null ? { changes: entry.changes } : {}),
    timestamp: entry.occurredAt,
  };
}

/**
 * Mã role suy từ tên hiển thị.
 *
 * BỎ DẤU trước khi lọc ký tự: cắt thẳng `[^a-z0-9]` trên tiếng Việt sẽ ăn mất
 * nguyên âm ("Trưởng nhóm" → `tr_ng_nh_m`). Tên toàn ký tự không map được thì
 * trả rỗng để backend từ chối, thay vì gửi một mã vô nghĩa.
 */
function roleKeyFrom(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const iamService = {
  /**
   * User của IAM là BẢN CHIẾU của account bên Auth (cùng id), nên bật/tắt trạng
   * thái đi qua module Auth chứ không có endpoint ghi nào ở `/iam/users`.
   */
  async listUsers(): Promise<AdminUser[]> {
    const { data } = await api.get<{ users: UserDto[] }>("/iam/users");
    return data.users.map(toAdminUser);
  },
  async updateUserStatus(id: string, status: UserStatus): Promise<void> {
    // Hai endpoint tách rời, viết thẳng đường dẫn (không ghép chuỗi) để test hợp
    // đồng đối chiếu được với bản kê route của backend.
    if (status === "active") {
      await api.post(`/auth/accounts/${id}/reactivation`, {});
      return;
    }
    await api.post(`/auth/accounts/${id}/deactivation`, {});
  },

  async listRoles(): Promise<Role[]> {
    const { data } = await api.get<{ roles: RoleDto[] }>("/iam/roles");
    return data.roles.map(toRole);
  },
  /** Role + quyền hạn của nó (hai endpoint: `RoleDTO` không nhúng danh sách quyền). */
  async getRole(id: string): Promise<Role & { permissionIds: string[] }> {
    const [roleResponse, permissionsResponse] = await Promise.all([
      api.get<{ role: RoleDto }>(`/iam/roles/${id}`),
      api.get<{ permissionIds: string[] }>(`/iam/roles/${id}/permissions`),
    ]);
    return { ...toRole(roleResponse.data.role), permissionIds: permissionsResponse.data.permissionIds };
  },
  /**
   * `key` là mã bất biến của role (backend bắt buộc); UI suy ra từ tên khi người
   * dùng không nhập, vì màn hình chỉ hỏi tên hiển thị.
   */
  async createRole(input: { name: string; key?: string; description?: string; permissionIds: string[] }): Promise<Role> {
    const key = roleKeyFrom(input.key ?? input.name);

    const { data } = await api.post<{ role: RoleDto }>("/iam/roles", {
      key,
      name: input.name,
      ...(input.description != null ? { description: input.description } : {}),
    });

    await api.put(`/iam/roles/${data.role.id}/permissions`, { permissionIds: input.permissionIds });
    return toRole(data.role);
  },
  async updateRole(id: string, input: { name?: string; description?: string; permissionIds: string[] }): Promise<Role> {
    const { data } = await api.patch<{ role: RoleDto }>(`/iam/roles/${id}`, {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.description != null ? { description: input.description } : {}),
    });

    await api.put(`/iam/roles/${id}/permissions`, { permissionIds: input.permissionIds });
    return toRole(data.role);
  },
  async deleteRole(id: string): Promise<void> {
    await api.delete(`/iam/roles/${id}`);
  },
  async listPermissions(): Promise<Permission[]> {
    const { data } = await api.get<{ permissions: PermissionDto[] }>("/iam/permissions");
    return data.permissions.map(toPermission);
  },

  /** Quyền hạn hiệu lực của chính actor — dùng để hiện đúng menu/nút. */
  async myPermissions(): Promise<string[]> {
    const { data } = await api.get<{ permissions: string[] }>("/iam/me/permissions");
    return data.permissions;
  },

  /** Vai trò đang gán cho một user. */
  async listUserRoles(userId: string): Promise<{ id: string; roleId: string; assignedAt: string }[]> {
    const { data } = await api.get<{ userRoles: { id: string; userId: string; roleId: string; assignedAt: string }[] }>(
      `/iam/users/${userId}/roles`,
    );
    return data.userRoles.map((row) => ({ id: row.id, roleId: row.roleId, assignedAt: row.assignedAt }));
  },
  async assignRole(userId: string, roleId: string): Promise<void> {
    await api.post(`/iam/users/${userId}/roles`, { roleId });
  },
  async revokeRole(userId: string, roleId: string): Promise<void> {
    await api.delete(`/iam/users/${userId}/roles/${roleId}`);
  },

  /**
   * Nhật ký audit. Backend lọc theo `resource`/`resourceId`; không có tham số
   * `limit`, nên UI tự cắt số dòng cần hiện.
   */
  async listAuditLogs(params: { resource?: string; resourceId?: string; limit?: number } = {}): Promise<AuditLogEntry[]> {
    const { data } = await api.get<{ auditLogs: AuditLogDto[] }>("/iam/audit-logs", {
      params: {
        ...(params.resource != null ? { resource: params.resource } : {}),
        ...(params.resourceId != null ? { resourceId: params.resourceId } : {}),
      },
    });
    const logs = data.auditLogs.map(toAuditLog);
    return params.limit == null ? logs : logs.slice(0, params.limit);
  },
};
