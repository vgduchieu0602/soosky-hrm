import api from "@core/http/axios";
import type {
  AdminUser,
  AuditLogEntry,
  Permission,
  Role,
  UserStatus,
} from "@features/iam/types/iam.types";

interface Env<T> { data: T }

export const iamService = {
  async listUsers(params: { status?: string; search?: string } = {}): Promise<AdminUser[]> {
    const sp = new URLSearchParams();
    if (params.status) sp.set("status", params.status);
    if (params.search) sp.set("search", params.search);
    const qs = sp.toString();
    const { data } = await api.get<Env<AdminUser[]>>(`/users${qs ? `?${qs}` : ""}`);
    return data.data ?? [];
  },
  async updateUserStatus(id: string, status: UserStatus): Promise<AdminUser> {
    const { data } = await api.patch<Env<AdminUser>>(`/users/${id}`, { status });
    return data.data;
  },

  async listRoles(): Promise<Role[]> {
    const { data } = await api.get<Env<Role[]>>("/roles");
    return data.data ?? [];
  },
  async getRole(id: string): Promise<Role> {
    const { data } = await api.get<Env<Role>>(`/roles/${id}`);
    return data.data;
  },
  async createRole(input: { name: string; description?: string; permissionIds: string[] }): Promise<Role> {
    const { data } = await api.post<Env<Role>>("/roles", input);
    return data.data;
  },
  async updateRole(id: string, input: { description?: string; permissionIds: string[] }): Promise<Role> {
    const { data } = await api.patch<Env<Role>>(`/roles/${id}`, input);
    return data.data;
  },
  async deleteRole(id: string): Promise<void> {
    await api.delete(`/roles/${id}`);
  },
  async listPermissions(): Promise<Permission[]> {
    const { data } = await api.get<Env<Permission[]>>("/permissions");
    return data.data ?? [];
  },

  async listAuditLogs(params: { resource?: string; limit?: number } = {}): Promise<AuditLogEntry[]> {
    const sp = new URLSearchParams();
    if (params.resource) sp.set("resource", params.resource);
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    const { data } = await api.get<Env<AuditLogEntry[]>>(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
    return data.data ?? [];
  },
};
