import api from "@core/http/axios";
import { useAuthStore } from "@core/store/auth.store";
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
} from "@features/auth/types/auth.types";

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  /** Backend tra ve true khi account con dung mat khau tam (grant-login). */
  mustChangePassword: boolean;
}

interface AccountResponse {
  account: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    mustChangePassword?: boolean;
  };
}

/**
 * Suy ra "vai trò UI" từ quyền hạn IAM thật.
 *
 * `/auth/me` chỉ trả role tầng Auth (`owner` | `admin` | `member`), KHÔNG phải
 * role nghiệp vụ (`admin`/`hr`/`manager`/`employee`) — nên gating menu theo nó
 * là sai: super admin (`owner`) sẽ bị coi như nhân viên thường, còn HR (`member`
 * ở tầng Auth) sẽ không thấy màn hình nào. Backend luôn là nơi enforce quyền;
 * đây chỉ để hiện đúng menu.
 */
function deriveUiRoles(accountRole: string, permissions: string[]): string[] {
  const roles = new Set<string>([accountRole]);
  const has = (key: string) => permissions.includes(key) || permissions.includes("*");

  if (permissions.includes("*") || has("iam:manage")) roles.add("admin");
  if (has("employee:manage") || has("payroll:prepare") || has("attendance:manage")) roles.add("hr_manager");
  if (has("employee:read:team") || has("leave:approve:team")) roles.add("manager");
  roles.add("employee");

  return [...roles];
}

function toAuthUser(account: AccountResponse["account"], permissions: string[] = []): AuthUser {
  return {
    id: account.id,
    username: account.fullName,
    email: account.email,
    roles: deriveUiRoles(account.role, permissions),
    permissions,
    mustChangePassword: account.mustChangePassword ?? false,
  };
}

/**
 * Quyền hạn của chính actor. Lỗi thì trả rỗng thay vì làm hỏng đăng nhập —
 * người dùng vẫn vào được, chỉ thấy ít menu; backend vẫn chặn đúng.
 */
async function fetchMyPermissions(accessToken?: string): Promise<string[]> {
  try {
    const { data } = await api.get<{ permissions: string[] }>(
      "/iam/me/permissions",
      accessToken == undefined ? undefined : { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data.permissions ?? [];
  } catch {
    return [];
  }
}

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { data: session } = await api.post<SessionResponse>(
      "/auth/sessions",
      { email: payload.identifier, password: payload.password },
    );
    const { data } = await api.get<AccountResponse>("/auth/me", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    // Mật khẩu tạm chặn mọi endpoint khác -> chưa đọc được quyền; đổi mật khẩu
    // xong `me()` sẽ nạp lại.
    const permissions = session.mustChangePassword ? [] : await fetchMyPermissions(session.accessToken);
    // Cờ buộc đổi mật khẩu lấy từ response đăng nhập: đó là nguồn sự thật ngay
    // tại thời điểm mở phiên (token cũng nhúng đúng cờ này).
    return {
      ...session,
      user: { ...toAuthUser(data.account, permissions), mustChangePassword: session.mustChangePassword },
    };
  },

  async verifyAccount(token: string): Promise<{ status: string }> {
    const { data } = await api.post<{ status: string }>("/auth/accounts/verification", { token });
    return data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<AccountResponse>("/auth/me");
    const permissions = data.account.mustChangePassword === true ? [] : await fetchMyPermissions();
    return toAuthUser(data.account, permissions);
  },

  async logout(): Promise<void> {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken != null) {
      await api.post("/auth/sessions/logout", { refreshToken });
    }
  },

  async refresh(): Promise<SessionResponse> {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken == null) throw new Error("Missing refresh token");
    const { data } = await api.post<SessionResponse>(
      "/auth/sessions/refresh",
      { refreshToken },
    );
    useAuthStore.getState().setSessionTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await api.put("/auth/me/password", payload);
  },
};
